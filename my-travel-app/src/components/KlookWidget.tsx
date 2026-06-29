import { useEffect, useRef } from 'react';

export default function KlookWidget() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 위젯을 담을 껍데기가 없거나, 이미 스크립트가 로딩되어 있다면 중복 실행 방지
    if (!containerRef.current || containerRef.current.hasChildNodes()) return;

    // 파트너가 복사해 온 Klook 위젯 스크립트를 리액트 친화적으로 동적 생성
    const script = document.createElement('script');
    script.async = true;
    script.src = "https://tpwidg.com/content?currency=USD&trs=524623&shmarker=724242&locale=en&city_id=2&category=4&amount=3&powered_by=true&campaign_id=137&promo_id=4497";
    script.charset = "utf-8";

    // 준비된 껍데기(div) 안에 스크립트를 삽입하여 위젯 엔진 가동
    containerRef.current.appendChild(script);
  }, []);

  return (
    <div className="w-full my-6 p-4 bg-white rounded-xl shadow-sm border border-gray-100">
      <h4 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
        🎟️ Popular Local Activities & Tours
      </h4>
      {/* 🚀 이 div 내부에서 Klook 위젯이 안전하게 렌더링됩니다 */}
      <div ref={containerRef} className="w-full min-h-[250px]" />
    </div>
  );
}
