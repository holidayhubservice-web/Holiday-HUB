import { useState, useEffect } from 'react';
import type { HotelEntity, SearchParams } from '../types/travel';
import { getRecommendedHotels } from '../domain/hotelLogic';
// 백엔드 응답 타입 정의
interface BackendResponse {
  hotels: HotelEntity[];
  error?: string;
}

export const useHotelRecommendations = (tripInfo: SearchParams | null) => {
  const [data, setData] = useState<{ recommendedHotels: HotelEntity[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
  useEffect(() => {
    // 1. 검색 조건이 없으면 아무것도 안 함
    if (!tripInfo) return;

    const fetchHotels = async () => {
      setLoading(true);
      setError(null);
      setData(null);

      try {
        console.log(`🌐 React: Asking Python Server about ${tripInfo.destination}...`);

        // 2. 파이썬 서버(5001번 포트)로 요청 전송
        const response = await fetch(`${API_BASE_URL}/find-hotels`, { 
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            destination: tripInfo.destination,
            // 필요한 경우 추가 정보를 여기에 넣습니다.
            interests: tripInfo.interests,
            budget: tripInfo.totalBudget
          }),
        });

        // 3. 응답 처리
        if (!response.ok) {
          throw new Error(`Server Error: ${response.status}`);
        }

        const result: BackendResponse = await response.json();

        if (result.error) {
          throw new Error(result.error);
        }
        const finalResult = await getRecommendedHotels(result.hotels, {
          totalBudget: tripInfo.totalBudget,
          startDate: new Date(tripInfo.startDate),
          endDate: new Date(tripInfo.endDate),
          interestLocations: [] // 현재는 비어있지만 나중에 확장 가능
        });

        

        setData({ recommendedHotels: finalResult.recommendedHotels });
        // 4. 데이터 저장
        console.log("✅ React: Received hotels from Python:", result.hotels);
        setData({ recommendedHotels: result.hotels });

      } catch (err) {
        console.error("❌ React Error:", err);
        setError(err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.");
      } finally {
        setLoading(false);
      }
    };

    fetchHotels();

  }, [tripInfo]); // tripInfo가 바뀔 때마다 실행

  return { data, loading, error };
};