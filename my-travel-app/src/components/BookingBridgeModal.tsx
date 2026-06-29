// src/components/BookingBridgeModal.tsx
import { useEffect, useRef } from 'react';

interface BookingBridgeModalProps {
  isOpen: boolean;
  onClose: () => void;
  destination: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
}

export default function BookingBridgeModal({ 
  isOpen, 
  onClose, 
  destination, 
  startDate, 
  endDate 
}: BookingBridgeModalProps) {
  const widgetContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 모달이 열려있고, 위젯을 담을 그릇이 준비되었을 때만 엔진 가동
    if (!isOpen || !widgetContainerRef.current) return;

    // 기존에 그려진 위젯이 있다면 중복 방지를 위해 초기화
    widgetContainerRef.current.innerHTML = '';

    try {
      // 🚀 트래블페이아웃 공식 위젯 초기화 로직 연동
      // index.html에 심은 스크립트가 window 객체에 동적 로더를 심어둡니다.
      // @ts-ignore (전역 window 객체 타입스크립트 예외 처리)
      if (window.TP_Widgets) {
        // @ts-ignore
        window.TP_Widgets.create({
          container: widgetContainerRef.current,
          type: 'hotels', // 호텔 검색 모드 고정
          params: {
            destination: destination, // 유저가 입력한 목적지 자동 주입!
            checkIn: startDate,       // 체크인 날짜 자동 싱크!
            checkOut: endDate,        // 체크아웃 날짜 자동 싱크!
            marker: '524623',         // 파트너의 고유 수익 ID 추적 마커
            language: 'ko',           // 한국어 지원
            currency: 'aud',          // 호주 달러 혹은 유저 기본 통화 세팅
            hide_logo: true          // 트래블페이아웃 로고를 숨겨 서드파티 색채를 줄임
          }
        });
      } else {
        console.warn("⚠️ Travelpayouts script not loaded yet.");
      }
    } catch (error) {
      console.error("❌ Widget Render Error:", error);
    }
  }, [isOpen, destination, startDate, endDate]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-teal-100 overflow-hidden transform transition-all animate-scale-up">
        
        {/* 상단 띠배너: 유저에게 신뢰감을 주는 브랜딩 헤더 */}
        <div className="bg-gradient-to-r from-teal-600 to-emerald-600 px-6 py-4 text-white">
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 text-white/80 hover:text-white text-xl font-bold transition-colors"
          >
            ✕
          </button>
          <h3 className="text-lg font-black tracking-tight flex items-center gap-2">
            🏨 실시간 최저가 매칭 및 안전 예약
          </h3>
          <p className="text-[11px] text-teal-100 mt-1">
            Holiday Hub가 엄선한 {destination} 일정의 거점 숙소 공실을 확인합니다.
          </p>
        </div>

        {/* 본문: 유저 데이터 스냅샷 안내 */}
        <div className="p-6">
          <div className="mb-4 p-3 bg-teal-50/50 border border-teal-100/50 rounded-xl text-xs text-gray-600">
            <div className="flex justify-between mb-1">
              <span className="font-bold text-gray-400">목적지</span>
              <span className="font-extrabold text-teal-700">{destination}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-bold text-gray-400">일정</span>
              <span className="font-bold text-gray-700">{startDate} ~ {endDate}</span>
            </div>
          </div>

          {/* 🎯 트래블페이아웃 순정 위젯이 렌더링될 실제 그릇 */}
          <div 
            ref={widgetContainerRef} 
            className="min-h-[200px] w-full bg-gray-50 rounded-xl border border-dashed border-gray-200 flex items-center justify-center overflow-hidden"
          >
            {/* 스크립트 로딩 전 보일 스켈레톤 안내 */}
            <p className="text-xs text-gray-400 animate-pulse">호텔 검색 엔진 활성화 중...</p>
          </div>

          <p className="text-[10px] text-center text-gray-400 mt-4">
            🔒 본 위젯은 글로벌 제휴 네트워크 안전 보안 규격을 준수합니다.
          </p>
        </div>

      </div>
    </div>
  );
}