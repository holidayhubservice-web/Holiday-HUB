// src/components/SplitHomepage.tsx
import { useState } from 'react';

interface SplitHomepageProps {
  onSelectGuess: () => void;
  onSelectBuild: () => void;
}

export default function SplitHomepage({ onSelectGuess, onSelectBuild }: SplitHomepageProps) {
  const [hoveredSide, setHoveredSide] = useState<'left' | 'right' | null>(null);

  return (
    <div className="flex flex-col md:flex-row h-screen w-full overflow-hidden bg-gray-900 text-white font-sans animate-fade-in">
      
      {/* 👑 중앙 공통 로고 및 텍스트 (마우스 간섭 방지 처리) */}
      <div className="absolute top-8 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center pointer-events-none">
        <img src="/logo.png" alt="Holiday Hub Logo" className="h-10 md:h-12 w-auto mb-3 drop-shadow-md" />
        <div className="px-6 py-1.5 bg-black/40 backdrop-blur-md rounded-full border border-white/10 shadow-xl">
          <p className="text-[10px] md:text-xs font-black tracking-[0.2em] uppercase text-white/90">I want to...</p>
        </div>
      </div>

      {/* ⬅️ 왼쪽: Guess My Travel (영감 찾기) */}
      <div 
        onClick={onSelectGuess}
        onMouseEnter={() => setHoveredSide('left')}
        onMouseLeave={() => setHoveredSide(null)}
        className={`relative flex flex-col justify-center items-center h-1/2 md:h-full transition-all duration-700 ease-out cursor-pointer overflow-hidden group
          ${hoveredSide === 'left' ? 'md:w-[60%]' : hoveredSide === 'right' ? 'md:w-[40%]' : 'md:w-1/2'}
        `}
      >
        {/* 추상적 배경 (Purple/Indigo) */}
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-900 via-purple-800 to-pink-900 opacity-90 transition-transform duration-1000 group-hover:scale-105" />
        <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors duration-700" />
        
        <div className="relative z-10 text-center px-6">
          <h2 className="text-4xl md:text-5xl font-black mb-3 text-white drop-shadow-lg transition-transform duration-500 group-hover:-translate-y-2">Guess My Travel</h2>
          <p className="text-sm md:text-base font-medium text-white/70 max-w-xs mx-auto transition-colors duration-500 group-hover:text-white">
            "I need a holiday, but I don't know where to go yet."
          </p>
          {/* 마우스 올렸을 때만 스르륵 나타나는 CTA 버튼 */}
          <div className="mt-6 inline-block px-8 py-3 bg-white/10 backdrop-blur-md hover:bg-white/20 border border-white/20 rounded-full text-sm font-bold transition-all duration-500 opacity-0 group-hover:opacity-100 transform translate-y-4 group-hover:translate-y-0 shadow-lg">
            Inspire Me ✨
          </div>
        </div>
      </div>

      {/* ➡️ 오른쪽: Build My Travel (구체적 계획) */}
      <div 
        onClick={onSelectBuild}
        onMouseEnter={() => setHoveredSide('right')}
        onMouseLeave={() => setHoveredSide(null)}
        className={`relative flex flex-col justify-center items-center h-1/2 md:h-full transition-all duration-700 ease-out cursor-pointer overflow-hidden group
          ${hoveredSide === 'right' ? 'md:w-[60%]' : hoveredSide === 'left' ? 'md:w-[40%]' : 'md:w-1/2'}
        `}
      >
        {/* 구체적 배경 (Teal/Emerald - 우리 브랜드 컬러) */}
        <div className="absolute inset-0 bg-gradient-to-bl from-teal-900 via-emerald-800 to-cyan-900 opacity-90 transition-transform duration-1000 group-hover:scale-105" />
        <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors duration-700" />

        <div className="relative z-10 text-center px-6">
          <h2 className="text-4xl md:text-5xl font-black mb-3 text-white drop-shadow-lg transition-transform duration-500 group-hover:-translate-y-2">Build My Travel</h2>
          <p className="text-sm md:text-base font-medium text-white/70 max-w-xs mx-auto transition-colors duration-500 group-hover:text-white">
            "I know exactly where I want to go. Let's make the plan."
          </p>
          <div className="mt-6 inline-block px-8 py-3 bg-teal-500 hover:bg-teal-400 text-white border border-teal-400/50 rounded-full text-sm font-black shadow-xl transition-all duration-500 opacity-0 group-hover:opacity-100 transform translate-y-4 group-hover:translate-y-0">
            Plan Now ✈️
          </div>
        </div>
      </div>

    </div>
  );
}