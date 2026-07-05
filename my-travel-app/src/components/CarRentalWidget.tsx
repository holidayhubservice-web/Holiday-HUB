import React from 'react';

export default function CarRentalWidget() {
  const scriptHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <link rel="preconnect" href="https://tpwidg.com" />
        <style>body { margin: 0; padding: 0; background: transparent; }</style>
      </head>
      <body>
        <script async src="https://tpwidg.com/content?trs=524623&shmarker=724242&locale=en&powered_by=true&border_radius=5&plain=true&show_logo=true&color_background=%23ffca28&color_button=%2355a539&color_text=%23000000&color_input_text=%23000000&color_button_text=%23ffffff&promo_id=4480&campaign_id=10" charset="utf-8"></script>
      </body>
    </html>
  `;

  return (
    <div className="w-full my-6 p-6 bg-white rounded-2xl shadow-xl border border-gray-100">
      <h3 className="font-bold text-lg mb-4 text-green-600 flex items-center gap-2">
        🚗 Rent a Car for your trip
      </h3>
      {/* 렌터카 위젯은 보통 검색창 형태라 높이를 300px~400px 정도로 잡는 것이 좋습니다 */}
      <div className="w-full h-[350px] rounded-xl overflow-hidden bg-white">
        <iframe
          title="Car Rental Search"
          srcDoc={scriptHtml}
          className="w-full h-full border-none"
          sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"
        />
      </div>
    </div>
  );
}