import { useEffect, useRef } from 'react'; // useRef 추가
import { useMap } from '@vis.gl/react-google-maps';

declare var google: any;

interface Props {
  hotelLocation: { latitude: number; longitude: number };
  activities: any[];
}

export default function TripRouteLayer({ hotelLocation, activities }: Props) {
  const map = useMap();
  // 🟢 [추가] 이전 선을 지우기 위해 참조(ref)를 보관합니다.
  const polylineRef = useRef<any>(null);

  useEffect(() => {
    if (!map || !hotelLocation || activities.length === 0) return;

    // 1. 기존에 그려진 선이 있다면 지웁니다 (중요!)
    if (polylineRef.current) {
      polylineRef.current.setMap(null);
    }

    // 2. 경로 좌표 배열 생성 (호텔 -> 방문지들 -> 다시 호텔)
    const pathCoordinates = [
      { lat: hotelLocation.latitude, lng: hotelLocation.longitude },
      ...activities
        .filter(act => act.details?.location)
        .map(act => ({
          lat: act.details.location.latitude,
          lng: act.details.location.longitude
        })),
      { lat: hotelLocation.latitude, lng: hotelLocation.longitude } // 마지막에 호텔로 복귀
    ];

    // 3. 화살표 심볼 설정
    const lineSymbol = {
      path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
      scale: 3,
      strokeColor: "#FF5733", // 선 색상과 맞춤
    };

    // 4. 폴리라인(화살표 선) 생성
    const routePath = new google.maps.Polyline({
      path: pathCoordinates,
      icons: [{
        icon: lineSymbol,
        offset: '100%',
        repeat: '100px' // 100px마다 화살표 표시
      }],
      map: map,
      strokeColor: "#FF5733", // 주황색 계열로 가시성 확보
      strokeOpacity: 0.8,
      strokeWeight: 4,
      geodesic: true // 지구 곡률 반영 (더 자연스러운 선)
    });

    // 5. 생성된 선을 ref에 저장 (다음 업데이트 때 지우기 위함)
    polylineRef.current = routePath;

    // 클린업 함수: 컴포넌트가 사라질 때 선도 지웁니다.
    return () => {
      if (polylineRef.current) polylineRef.current.setMap(null);
    };
  }, [map, hotelLocation, activities]); // 의존성 배열

  return null;
}