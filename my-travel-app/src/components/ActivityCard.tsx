import React from 'react';
// 1. 우리가 만든 비즈니스 로직 임포트
import { calculateStayDuration, type TravelIntensity } from '../utils/travelLogic';

interface ActivityCardProps {
  item: any;
  idx: number;
  intensity: TravelIntensity;
}

export const ActivityCard: React.FC<ActivityCardProps> = ({ item, idx, intensity }) => {
  // 🟢 [로직 계산부]
  if (!item || !item.details) return <div className="min-h-[100px] bg-gray-50 animate-pulse rounded-2xl" />;
  const isLandmark = item.type === 'Must-Visit';
  const category = item.details?.category || 'default'; 
  
  // 유틸 함수를 사용해 강도와 장소 유형에 따른 '진짜' 체류 시간을 계산합니다.
  const safeIntensity = intensity || 'moderate';
  const duration = calculateStayDuration(category, safeIntensity, isLandmark);
  return (
    <div className="flex flex-col w-full group">
      {/* 장소 카드 본체: duration에 따라 높이가 유동적으로 변합니다 */}
      <div className={`
        relative flex gap-4 bg-white rounded-2xl shadow-sm border transition-all duration-300
        ${isLandmark ? 'p-5 border-rose-200 ring-1 ring-rose-50' : 'p-4 border-gray-100'}
        ${duration >= 180 ? 'min-h-[180px]' : duration >= 120 ? 'min-h-[140px]' : 'min-h-[110px]'}
      `}>
        
        {/* 왼쪽 영역: 드래그 핸들 & 순서 숫자 */}
        <div className="flex flex-col items-center gap-2">
          <div className="drag-handle cursor-grab text-gray-300 hover:text-gray-500 p-1">
            ⣿
          </div>
          <div className={`
            w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shadow-sm
            ${isLandmark ? 'bg-rose-500 text-white' : 'bg-blue-600 text-white'}
          `}>
            {idx + 1}
          </div>
        </div>

        {/* 중앙 영역: 장소 상세 정보 */}
        <div className="flex-1 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              {isLandmark && (
                <span className="bg-rose-100 text-rose-600 text-[10px] px-2 py-0.5 rounded-full font-black uppercase tracking-tighter">
                  Landmark
                </span>
              )}
              <span className="text-[10px] text-gray-400 font-medium">
                {duration >= 120 ? 'Must visit schedule' : 'Flexible schedule'}
              </span>
            </div>
            <h4 className="font-bold text-gray-900 text-base leading-tight truncate max-w-[150px]">
              {item.details?.name}
            </h4>
          </div>

          {/* 체류 시간 표시 부분 */}
          <div className="flex items-center justify-between mt-4">
            <div className="flex items-center gap-1 text-blue-600">
              <span className="text-sm font-black">⏱ {duration}Min</span>
              <span className="text-[10px] text-gray-400 font-normal">Stay</span>
            </div>
            {isLandmark && (
              <span className="text-[10px] text-rose-500 font-bold bg-rose-50 px-2 py-1 rounded-md">
                Must Visit
              </span>
            )}
          </div>
        </div>

        {/* 오른쪽 영역: 썸네일 이미지 */}
        <div className={`flex-shrink-0 relative ${isLandmark ? 'w-24 h-24' : 'w-16 h-16'}`}>
          <img 
            src={item.details?.image_url || 'https://placehold.co/100x100?text=No+Image'} 
            className="w-full h-full object-cover rounded-xl bg-gray-50 border border-gray-100" 
            alt={item.details?.name}
          />
        </div>
      </div>
    </div>
  );
};