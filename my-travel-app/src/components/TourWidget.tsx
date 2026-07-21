import React from 'react';

export default function TourWidget() {
  const scriptHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <link rel="preconnect" href="https://tpwidg.com" />
        <style>body { margin: 0; padding: 0; background: transparent; }</style>
      </head>
      <body>
        <script async src="https://tpwidg.com/content?currency=USD&trs=524623&shmarker=724242&language=en&locale=60389&layout=responsive&cards=4&powered_by=true&campaign_id=89&promo_id=3947" charset="utf-8"></script>
      </body>
    </html>
  `;

  return (
    // 🎨 UI 개선: 시각적인 테두리, 흰 배경, 커스텀 제목을 모두 제거하고 투명한 영역만 남깁니다.
    <div className="w-full my-6">
      <iframe
        title="Tour Search"
        srcDoc={scriptHtml}
        // 위젯 자체의 높이를 충분히 주어 4개의 카드가 시원하게 보이도록 합니다.
        className="w-full min-h-[500px] border-none"
        sandbox="allow-scripts allow-forms allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"
      />
    </div>
  );
}