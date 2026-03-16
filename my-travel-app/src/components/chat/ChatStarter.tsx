import React, { useState } from 'react';

interface ChatStarterProps {
  onStart: (destination: string) => void;
}

export const ChatStarter: React.FC<ChatStarterProps> = ({ onStart }) => {
  const [input, setInput] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      onStart(input);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto px-4">
      <form onSubmit={handleSubmit} className="relative group">
        {/* 입력창 배경에 은은한 글로우 효과 (Spotlight 대용) */}
        <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-500"></div>
        
        <div className="relative flex items-center bg-white rounded-2xl shadow-xl p-2 border border-gray-100">
          <span className="pl-4 text-2xl">💬</span>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="예: 뉴욕으로 5일간 여행 가고 싶어..."
            className="w-full p-4 text-lg text-gray-800 placeholder-gray-400 bg-transparent border-none outline-none focus:ring-0"
            autoFocus
          />
          <button 
            type="submit"
            disabled={!input.trim()}
            className="p-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
            </svg>
          </button>
        </div>
      </form>
      
      {/* 추천 키워드 (UX 보완) */}
      <div className="mt-6 flex justify-center gap-3 text-sm text-gray-500 animate-fade-in">
        <span>추천:</span>
        {['파리 낭만 여행', '제주도 힐링', '도쿄 먹방'].map((keyword) => (
          <button 
            key={keyword}
            onClick={() => onStart(keyword)}
            className="hover:text-blue-600 hover:underline transition-colors"
          >
            #{keyword}
          </button>
        ))}
      </div>
    </div>
  );
};