import React from 'react';

// 🚀 1. App.tsx와 완벽하게 일치하는 엄격한 타입을 선언합니다.
type ViewMode = 'intro' | 'main' | 'guess' | 'build' | 'terms' | 'privacy' | 'about' | 'contact' | 'disclosure';

// 🚀 2. any 대신 Interface를 사용하여 Props의 규격을 명확히 정의합니다.
interface PageProps {
  setViewMode: (mode: ViewMode) => void;
}

// 🚀 3. 컴포넌트에 Interface를 적용합니다. (이름은 각 파일에 맞게 About, Contact 등으로 변경해 주세요!)
export default function About({ setViewMode }: PageProps) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center p-6 md:p-12 animate-fade-in w-full overflow-y-auto">
      <div className="w-full max-w-3xl text-left bg-white p-8 md:p-12 rounded-3xl shadow-sm border border-gray-100 mt-10">
        <button onClick={() => setViewMode('intro')} className="mb-8 text-gray-400 hover:text-teal-600 font-bold text-sm transition-colors flex items-center gap-1">
          ← Back to Home
        </button>
        <h1 className="text-3xl font-black mb-4 text-gray-900">페이지 준비 중</h1>
        <p className="text-gray-500 text-sm">내용이 곧 업데이트될 예정입니다.</p>
      </div>
    </div>
  );
}