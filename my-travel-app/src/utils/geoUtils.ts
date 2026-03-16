// src/utils/geoUtils.ts
// src/utils/geoUtils.ts
import type { GeoPoint } from '../types/travel';

// 1. 두 지점 간의 거리 계산 (Haversine 공식 간소화 - 유클리드 거리)
// 실제 프로덕션에서는 'haversine' 라이브러리 사용 권장
export const calculateDistance = (p1: GeoPoint, p2: GeoPoint): number => {
  const R = 6371; // 지구 반지름 (km)
  const dLat = ((p2.lat - p1.lat) * Math.PI) / 180;
  const dLon = ((p2.lng - p1.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((p1.lat * Math.PI) / 180) *
      Math.cos((p2.lat * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// 2. 여러 지점의 기하학적 중심(Centroid) 계산
export const calculateCentroid = (points: GeoPoint[]): GeoPoint => {
  if (points.length === 0) return { lat: 0, lng: 0 };

  const total = points.reduce(
    (acc, curr) => ({ lat: acc.lat + curr.lat, lng: acc.lng + curr.lng }),
    { lat: 0, lng: 0 }
  );

  return {
    lat: total.lat / points.length,
    lng: total.lng / points.length,
  };
};

// 3. 클러스터 중심 찾기 (가장 밀집된 곳의 핵심 포인트 찾기)
// 다른 모든 점들과의 거리 합이 가장 작은 점을 반환
export const findBestClusterPoint = (points: GeoPoint[]): GeoPoint => {
  if (points.length === 0) return { lat: 0, lng: 0 };
  
  let bestPoint = points[0];
  let minTotalDist = Infinity;

  points.forEach((p1) => {
    const currentTotalDist = points.reduce((sum, p2) => sum + calculateDistance(p1, p2), 0);
    if (currentTotalDist < minTotalDist) {
      minTotalDist = currentTotalDist;
      bestPoint = p1;
    }
  });

  return bestPoint;}