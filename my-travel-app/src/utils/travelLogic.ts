// src/utils/travelLogic.ts

export type TravelIntensity = 'relaxed' | 'moderate' | 'active';

interface IntensityConfig {
  placeCount: number;
  durationMultiplier: number;
  label: string;
}

// 1. 강도별 설정 정의 (파트너의 설계 반영)
export const INTENSITY_SETTINGS: Record<TravelIntensity, IntensityConfig> = {
  relaxed: { placeCount: 5, durationMultiplier: 1.0, label: '여유롭게' },
  moderate: { placeCount: 6, durationMultiplier: 0.85, label: '적당하게' },
  active: { placeCount: 7, durationMultiplier: 0.7, label: '빡빡하게' },
};

// 2. 카테고리별 기본 체류 시간 (단위: 분)
const BASE_DURATIONS: Record<string, number> = {
  restaurant: 90,
  cafe: 60,
  park: 60,
  museum: 120,
  shopping_mall: 120,
  default: 90,
};

/**
 * 최종 체류 시간을 계산하는 로직
 * @param category 장소 카테고리
 * @param intensity 여행 강도
 * @param isMustVisit 필수 방문지 여부
 */
export const calculateStayDuration = (
  category: string,
  intensity: TravelIntensity,
  isMustVisit: boolean
): number => {
  const base = BASE_DURATIONS[category] || BASE_DURATIONS.default;
  const intensityMultiplier = INTENSITY_SETTINGS[intensity].durationMultiplier;
  const landmarkMultiplier = isMustVisit ? 3.0 : 1.0;

  return Math.round(base * intensityMultiplier * landmarkMultiplier);
};