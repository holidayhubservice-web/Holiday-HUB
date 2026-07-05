import React from 'react';

interface FooterProps {
  setViewMode: (mode: any) => void;
}

export default function Footer({ setViewMode }: FooterProps) {
  return (
    <footer className="w-full bg-gray-50 py-12 mt-auto border-t border-gray-100 text-gray-500">
      <div className="max-w-5xl mx-auto px-6 flex flex-col gap-8">
        
        {/* 상단 라인: 로고 및 링크 메뉴들 */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="flex flex-col gap-1">
            <span className="font-black text-gray-800 tracking-tight text-lg">Holiday Hub</span>
            <p className="text-xs text-gray-400">Spend less time planning. Spend more time exploring.</p>
          </div>
          
          {/* 6대 신뢰 메뉴 링크 */}
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs font-semibold">
            <button onClick={() => setViewMode('about')} className="hover:text-teal-600 transition-colors">About</button>
            <button onClick={() => setViewMode('contact')} className="hover:text-teal-600 transition-colors">Contact</button>
            <button onClick={() => setViewMode('terms')} className="hover:text-teal-600 transition-colors">Terms</button>
            <button onClick={() => setViewMode('privacy')} className="hover:text-teal-600 transition-colors">Privacy</button>
            <button onClick={() => setViewMode('disclosure')} className="hover:text-teal-600 transition-colors">Affiliate Disclosure</button>
          </div>
        </div>

        {/* 하단 라인: 상태 표시 및 카피라이트 */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pt-6 border-t border-gray-200/60 text-xs text-gray-400">
          <p>© 2026 Holiday Hub. All rights reserved.</p>
          
          {/* 🟢 유저에게 살아있는 서비스임을 알리는 신호 상태바 */}
          <div className="flex items-center gap-1.5 bg-green-50 text-green-700 px-3 py-1 rounded-full font-medium border border-green-200/50">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            All systems operational
          </div>
        </div>

      </div>
    </footer>
  );
}
