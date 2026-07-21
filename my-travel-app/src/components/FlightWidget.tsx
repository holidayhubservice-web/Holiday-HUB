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
    // 🎨 UI 개선: 배경, 그림자, 테두리, 제목을 걷어내고 위젯이 자연스럽게 자리 잡도록 뼈대만 남깁니다.
    <div className="w-full my-6">
      {/* 강제로 크기를 고정하던 min-w-[900px]을 제거하여 반응형으로 부드럽게 줄어들게 만듭니다. */}
      <iframe
        title="Flight Search"
        srcDoc={scriptHtml}
        className="w-full min-h-[700px] border-none"
        sandbox="allow-scripts allow-forms allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"
      />
    </div>
  );
}