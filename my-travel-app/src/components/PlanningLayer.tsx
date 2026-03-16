import React from 'react';
import { AdvancedMarker, Pin } from '@vis.gl/react-google-maps';
import type { HotelEntity } from '../types/travel';
import TripRouteLayer from './GoogleMapParams'; 
console.log("🕵️ 연결 확인: PlanningLayer 컴포넌트가 로드되었습니다!");
interface PlanningLayerProps {
  selectedHotel: HotelEntity | null;
  dailyPlan: any[];
}

const PlanningLayer: React.FC<PlanningLayerProps> = ({ selectedHotel, dailyPlan }) => {
  console.log("🎨 [DEBUG] PlanningLayer 렌더링됨");
  console.log("🏨 [DEBUG] 전달받은 호텔:", selectedHotel?.name);
  console.log("📌 [DEBUG] 전달받은 일정 개수:", dailyPlan?.length);
if (!dailyPlan || !Array.isArray(dailyPlan) || dailyPlan.length === 0) {
    return null; 
  }
  return (
    <>
      {/* 1. 숙소 마커: 파란색 핀 (가장 눈에 띄게) */}
      {selectedHotel?.location && (
        <AdvancedMarker
          zIndex={999}
          position={{ 
            lat: selectedHotel.location.latitude, 
            lng: selectedHotel.location.longitude 
          }}
        >
          <div style={{ fontSize: '30px' }}>🏠</div>
        </AdvancedMarker>
      )}

      {/* 2. 방문지 마커: 숫자 배지가 달린 이미지 마커 */}
      {dailyPlan.map((item, index) => {
        const position = item.details?.location ? {
            lat: item.details.location.latitude,
            lng: item.details.location.longitude
        } : null;

        if (!position) return null;

        return (
          <AdvancedMarker 
            key={item.details.id || index} 
            position={position}
            title={`${index + 1}. ${item.details.name}`}
          >
            {/* 구형 JS 로직을 React 스타일로 재현한 마커 디자인 */}
            <div style={{ position: 'relative', cursor: 'pointer' }}>
              {/* 장소 이미지 */}
              <img 
                src={item.details.image_url || 'https://placehold.co/60x60/FDD835/000?text=📍'} 
                alt={item.details.name}
                style={{
                  width: '45px',
                  height: '45px',
                  borderRadius: '50%',
                  border: '3px solid white',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                  objectFit: 'cover'
                }}
              />
              {/* 숫자 배지 */}
              <div style={{
                position: 'absolute',
                top: '-5px',
                right: '-5px',
                backgroundColor: '#00a09a',
                color: 'white',
                width: '22px',
                height: '22px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                fontWeight: 'bold',
                border: '2px solid white'
              }}>
                {index + 1}
              </div>
            </div>
          </AdvancedMarker>
        );
      })}

      {/* 3. 경로 그리기 로직 */}
      {selectedHotel && selectedHotel.location && (
        <TripRouteLayer 
          hotelLocation={{
            latitude: selectedHotel.location.latitude,
            longitude: selectedHotel.location.longitude
          }} 
          activities={dailyPlan} 
        />
      )}
    </>
  );
};

export default PlanningLayer;