// src/services/analytics.ts

// 🟢 1. TypeScript 달래기: "브라우저(window)에 gtag라는 함수가 있으니 에러 띄우지 마!" 라고 선언합니다.
declare global {
  interface Window {
    gtag: (...args: any[]) => void;
    dataLayer: any[];
  }
}

export const trackEvent = (eventName: string, params?: Record<string, any>) => {
  if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
    window.gtag('event', eventName, params);
    
    if (import.meta.env.DEV) {
      console.log(`📊 [GA4] ${eventName} 전송 성공:`, params);
    }
  } else {
    if (import.meta.env.DEV) {
      console.warn(`⚠️ [GA4] ${eventName} 전송 스킵 (gtag 미로드 혹은 광고 차단기 작동 중)`);
    }
  }
};