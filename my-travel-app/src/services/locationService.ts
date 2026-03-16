import type { GeoPoint } from '../types/travel';
import { calculateCentroid, findBestClusterPoint, calculateDistance } from '../utils/geoUtils';

// [Mock] Google Places API 호출을 흉내내는 함수
// 실제 구현 시에는 Google Maps API를 호출해야 합니다.
const mockSearchNearby = async (
  center: GeoPoint,
  types: string[]
): Promise<GeoPoint | null> => {
  // TODO: 실제 API 연동
  console.log(`Searching for ${types.join(',')} near ${center.lat}, ${center.lng}`);
  // 임시: 랜덤하게 찾았다고 가정하거나 null 반환
  return null; 
};

/**
 * [핵심 로직] 계층형 앵커 전략
 * 1순위: 기하학적 중심 근처의 주요 역 (Urban)
 * 2순위: 기하학적 중심 근처의 버스 터미널 (Rural)
 * 3순위: 관심사들이 가장 많이 뭉쳐있는 곳 (Nature/Resort)
 */
export const determineSearchAnchor = async (
  interestLocations: GeoPoint[], 
  fallbackCenter?: GeoPoint // 💡 도시 중심점을 받을 수 있게 추가
): Promise<GeoPoint> => {
  if (interestLocations.length === 0) {
    console.log("⚠️ 관심사 좌표가 없어 기본 위치를 사용합니다.");
    return fallbackCenter || { lat: -34.9285, lng: 138.6007 }; // 데이터 없으면 기본 좌표라도 반환
  }

  // 0. 기하학적 중심 계산 (초기 기준점)
  const geometricCenter = calculateCentroid(interestLocations);

  // 1단계: 도심지 체크 (지하철, 기차역)
  const trainStation = await mockSearchNearby(geometricCenter, ['subway_station', 'train_station']);
  if (trainStation) {
    console.log("Anchor Found: Train Station (Urban Priority)");
    return trainStation;
  }

  // 2단계: 지방/시골 체크 (버스 터미널)
  const busTerminal = await mockSearchNearby(geometricCenter, ['bus_station', 'transit_station']);
  if (busTerminal) {
    console.log("Anchor Found: Bus Terminal (Rural Priority)");
    return busTerminal;
  }

  // 3단계: 클러스터 중심 (자연 휴양지 등)
  // 교통편이 마땅치 않으면, 내가 갈 곳들이 가장 많이 뭉친 곳을 베이스캠프로 삼음
  console.log("Anchor Found: Cluster Center (Nature Priority)");
  return findBestClusterPoint(interestLocations);
};

// 위치 점수 계산 (100점 만점)
// 기준점(anchor)에서 가까울수록 점수가 높음 (2km 이내 100점, 이후 감점)
export const calculateLocationScore = (hotelLoc: GeoPoint, anchor: GeoPoint): number => {
  const dist = calculateDistance(hotelLoc, anchor);
  if (dist <= 2.0) return 100; // 2km 이내는 만점 (도보/단거리 택시권)
  
  // 10km 넘어가면 0점 처리
  const score = 100 - ((dist - 2) * 10); 
  return Math.max(0, Math.round(score));
};