// src/domain/hotelLogic.ts
// src/domain/hotelLogic.ts
import type { HotelEntity, TripBudget, RecommendationResult, GeoPoint } from '../types/travel';
import { determineSearchAnchor, calculateLocationScore } from '../services/locationService';

// 내부적으로 사용할 타입 정의 (점수가 계산된 호텔)
type ScoredHotel = HotelEntity & { score: number };
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
// =================================================================
// Rule 1 & 2: 예산 계산 로직
// =================================================================
export const calculateBudget = (totalBudget: number, durationDays: number): TripBudget => {
  const accommodationBudget = totalBudget / 4;
  const dailyBudget = accommodationBudget / durationDays;

  return {
    totalBudget,
    accommodationBudget: Math.floor(accommodationBudget),
    dailyAccommodationBudget: Math.floor(dailyBudget),
  };
};

// =================================================================
// Rule 3: 당일치기 체크 Helper
// =================================================================
const isDayTrip = (startDate: Date, endDate: Date): boolean => {
  return startDate.toDateString() === endDate.toDateString();
};

// =================================================================
// Rule 4, 5, 6: 호텔 선별 및 트레이드오프 로직 (Final Logic)
// =================================================================
export const getRecommendedHotels = async (
  allHotels: HotelEntity[], 
  params: {
    totalBudget: number;
    startDate: Date;
    endDate: Date;
    interestLocations: GeoPoint[];
  }
): Promise<RecommendationResult> => {
  const { totalBudget, startDate, endDate, interestLocations } = params;

  // 1. 당일치기 예외 처리 (Early Return)
  if (isDayTrip(startDate, endDate)) {
    return {
      isDayTrip: true,
      searchAnchor: null,
      budgetPlan: null,
      recommendedHotels: [],
    };
  }

  // 2. 예산 수립
  // 날짜 차이 계산 (최소 1일 보장)
  const timeDiff = endDate.getTime() - startDate.getTime();
  const dayDiff = timeDiff / (1000 * 3600 * 24);
  const duration = Math.max(1, Math.ceil(dayDiff)); // 올림 처리하여 0일 방지

  const budgetPlan = calculateBudget(totalBudget, duration);
  const targetPrice = budgetPlan.dailyAccommodationBudget;

  // 3. 앵커(중심지) 설정
  const anchor = await determineSearchAnchor(interestLocations);

  // 4. 모든 호텔에 '위치 점수' 부여 및 가공
  // map 결과를 ScoredHotel[]로 명시
  const scoredHotels: ScoredHotel[] = allHotels.map((h) => ({
    ...h,
   score: calculateLocationScore(
    { lat: h.location.latitude, lng: h.location.longitude }, 
    anchor
   )
  }));

  // 5. 트레이드오프 로직: 예산 vs 위치
  const baseMax = targetPrice * 1.1; // +10%
  const extendedMax = targetPrice * 1.2; // +20% (가심비 구간)

  // 후보군 필터링
  const candidates = scoredHotels.filter((h) => {
    // A: 예산보다 쌈 (OK)
    if (h.price_Per_Night <= targetPrice) return true;
    
    // B: 예산 ~ +10% (OK)
    if (h.price_Per_Night <= baseMax) return true;
    
    // C: +10% ~ +20% (위치 점수 80점 이상만 OK)
    if (h.price_Per_Night <= extendedMax && h.score >= 80) return true;

    return false;
  });

  // 6. 그룹별 분배 정렬 함수
  // 명시적 타입(ScoredHotel) 사용으로 문법 오류 방지
  const sorter = (a: ScoredHotel, b: ScoredHotel) => {
    // 점수 차이가 10점 이상이면 점수 우선 (위치 중요)
    if (Math.abs(a.score - b.score) > 10) return b.score - a.score;
    // 비슷하면 예산에 가까운 순서 (가격 정확도 중요)
    return Math.abs(a.price_Per_Night - targetPrice) - Math.abs(b.price_Per_Night - targetPrice);
  };

  // 그룹핑
  const cheapGroup = candidates.filter(h => h.price_Per_Night < targetPrice).sort(sorter);
  const averageGroup = candidates.filter(h => h.price_Per_Night >= targetPrice && h.price_Per_Night <= baseMax).sort(sorter);
  const expensiveGroup = candidates.filter(h => h.price_Per_Night > baseMax).sort(sorter);

  // 최종 5개 슬롯 채우기
  const finalSelection: HotelEntity[] = [];

  // Slot 1: 저렴 (1개)
  if (cheapGroup.length > 0) finalSelection.push(cheapGroup[0]);

  // Slot 2,3: 평균 (2개) - 저렴 그룹 남은 것 포함
  const remainingCheap = cheapGroup.slice(1);
  const poolForAverage = [...averageGroup, ...remainingCheap].sort(sorter);
  finalSelection.push(...poolForAverage.slice(0, 2));

  // Slot 4,5: 비쌈 (2개) - 평균 그룹 남은 것 포함
  const usedIds = new Set(finalSelection.map(h => h.id));
  const remainingAverage = poolForAverage.filter(h => !usedIds.has(h.id));
  const poolForExpensive = [...expensiveGroup, ...remainingAverage].sort(sorter);
  finalSelection.push(...poolForExpensive.slice(0, 2));

  // 부족분 채우기 (Fallback)
  if (finalSelection.length < 5) {
    const currentIds = new Set(finalSelection.map(h => h.id));
    const leftovers = candidates
      .filter(h => !currentIds.has(h.id))
      .sort((a, b) => b.score - a.score); // 남은 건 위치 좋은 순
    
    const needed = 5 - finalSelection.length;
    finalSelection.push(...leftovers.slice(0, needed));
  }

  return {
    isDayTrip: false,
    searchAnchor: anchor,
    budgetPlan,
    recommendedHotels: finalSelection
  };
};
export const fetchHotelsFromApi = async (params: any) => {
  try {
    const response = await fetch(`${API_BASE_URL}/find-hotels`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      throw new Error(`Hotel API Server Error: ${response.status}`);
    }

    const data = await response.json();
    // 백엔드에서 온 데이터 형태에 따라 { recommendedHotels: data } 등으로 가공 가능
    return data; 
  } catch (error) {
    console.error("[HotelLogic Fetch Error]:", error);
    throw error;
  }
};