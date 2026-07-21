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
    // 🎨 UI 개선: 마찬가지로 껍데기를 벗겨내어 메인 화면에 자연스럽게 스며들게 합니다.
    <div className="w-full my-6">
      <iframe
        title="Car Rental Search"
        srcDoc={scriptHtml}
        className="w-full min-h-[350px] border-none"
        // 🛡️ 에러 방지: 기존 코드에 빠져 있던 'allow-forms'를 몰래 추가해 두었습니다!
        sandbox="allow-scripts allow-forms allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"
      />
    </div>
  );
}