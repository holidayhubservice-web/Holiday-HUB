import React from 'react';

export default function FlightWidget() {
  const scriptHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <link rel="preconnect" href="https://tpwidg.com" />
        <style>body { margin: 0; padding: 0; background: transparent; }</style>
      </head>
      <body>
        
        <script async src="https://tpwidg.com/content?currency=usd&trs=524623&shmarker=724242&locale=en&stops=any&show_hotels=true&powered_by=true&border_radius=0&plain=true&color_button=%2300A991&color_button_text=%23ffffff&promo_id=3414&campaign_id=111" charset="utf-8"></script>
      </body>
    </html>
  `;

  return (
    // 🚀 크기 확장: 바깥 div에 가로 스크롤을 허용하여 위젯이 숨을 쉴 수 있게 공간을 열어줍니다.
    <div className="w-full my-6 p-6 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-x-auto">
      <h3 className="font-bold text-lg mb-4 text-blue-600 flex items-center gap-2">
        ✈️ Book your flight
      </h3>
      {/* 🚀 찌그러짐 방지: iframe을 감싸는 영역이 모바일에서도 최소 800px을 유지하도록 합니다. */}
      <div className="w-full min-w-[900px] h-[700px] rounded-xl overflow-hidden bg-white">
        <iframe
          title="Flight Search"
          srcDoc={scriptHtml}
          className="w-full h-full border-none"
          sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"
        />
      </div>
    </div>
  );
}