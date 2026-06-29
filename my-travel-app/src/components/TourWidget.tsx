// src/components/TourWidget.tsx

export default function TourWidget() {
  // 🚀 예전에 성공했던 Klook(137) 스크립트를 iframe용으로 래핑합니다.
  const scriptHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>body { margin: 0; padding: 0; background: transparent; }</style>
      </head>
      <body>
        <script async src="https://tpwidg.com/content?currency=USD&trs=524623&shmarker=724242&locale=en&city_id=2&category=4&amount=3&powered_by=true&campaign_id=137&promo_id=4497" charset="utf-8"></script>
      </body>
    </html>
  `;

  return (
    <div className="w-full bg-white p-6 rounded-2xl shadow-xl border border-gray-100">
      <h3 className="font-bold text-lg mb-4 text-orange-500 flex items-center gap-2">
        🎟️ Popular Local Activities & Tours
      </h3>
      <div className="w-full h-[350px] rounded-xl overflow-hidden bg-white">
        <iframe
          title="Tour Search"
          srcDoc={scriptHtml}
          className="w-full h-full border-none"
          sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"
        />
      </div>
    </div>
  );
}