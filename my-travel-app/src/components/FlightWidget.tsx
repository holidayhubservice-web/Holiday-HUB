// src/components/FlightWidget.tsx

export default function FlightWidget() {
  // 🚀 트래블페이아웃 스크립트를 독립된 HTML 문서로 포장합니다.
  const scriptHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>body { margin: 0; padding: 0; background: transparent; }</style>
      </head>
      <body>
        <script async src="https://tpwidg.com/content?currency=usd&trs=524623&shmarker=724242&locale=en&powered_by=true&limit=4&primary_color=00AE98&results_background_color=FFFFFF&form_background_color=FFFFFF&campaign_id=111&promo_id=3411" charset="utf-8"></script>
      </body>
    </html>
  `;

  return (
    <div className="w-full bg-white p-6 rounded-2xl shadow-xl border border-gray-100">
      <h3 className="font-bold text-lg mb-4 text-blue-600 flex items-center gap-2">
        ✈️ Book your flight
      </h3>
      {/* 🚀 독립된 방(iframe) 안에서 위젯을 실행시킵니다 */}
      <div className="w-full h-[700px] rounded-xl overflow-hidden bg-white">
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