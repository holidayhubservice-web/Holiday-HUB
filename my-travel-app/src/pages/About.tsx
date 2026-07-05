import React, { useState } from 'react';

// App.tsx와 완벽하게 일치하는 엄격한 타입
type ViewMode = 'intro' | 'main' | 'guess' | 'build' | 'terms' | 'privacy' | 'about' | 'contact' | 'disclosure';

interface PageProps {
  setViewMode: (mode: ViewMode) => void;
}

// 브랜드 헌법을 위한 내부 탭 타입 정의
type AboutTab = 'story' | 'mission' | 'principles';

export default function About({ setViewMode }: PageProps) {
  const [activeTab, setActiveTab] = useState<AboutTab>('story');

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center p-6 md:p-12 animate-fade-in w-full overflow-y-auto">
      <div className="w-full max-w-4xl text-left bg-white p-8 md:p-12 rounded-3xl shadow-sm border border-gray-100 mt-10">
        
        {/* 뒤로 가기 버튼 */}
        <button 
          onClick={() => setViewMode('intro')} 
          className="mb-8 text-gray-400 hover:text-teal-600 font-bold text-sm transition-colors flex items-center gap-1"
        >
          ← Back to Home
        </button>

        {/* 문서 헤더 */}
        <div className="border-b border-gray-100 pb-6 mb-8">
          <h1 className="text-3xl md:text-4xl font-black mb-2 text-gray-900 tracking-tight">About Holiday Hub</h1>
          <p className="text-sm text-gray-500 font-medium">The Constitution of Our Brand & Philosophy</p>
        </div>

        {/* 🚀 창업자님이 제안하신 3대 핵심 서브 페이지를 위한 세련된 내부 탭 메뉴 */}
        <div className="flex border-b border-gray-200 mb-8 gap-2 overflow-x-auto no-scrollbar">
          <button 
            onClick={() => setActiveTab('story')}
            className={`pb-4 px-4 font-bold text-sm md:text-base border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'story' ? 'border-teal-600 text-teal-600' : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            About Holiday Hub
          </button>
          <button 
            onClick={() => setActiveTab('mission')}
            className={`pb-4 px-4 font-bold text-sm md:text-base border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'mission' ? 'border-teal-600 text-teal-600' : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            Our Mission & Vision
          </button>
          <button 
            onClick={() => setActiveTab('principles')}
            className={`pb-4 px-4 font-bold text-sm md:text-base border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'principles' ? 'border-teal-600 text-teal-600' : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            Our Principles
          </button>
        </div>

        {/* 탭 내부 콘텐츠 구역 */}
        <div className="text-gray-600 text-sm md:text-base leading-relaxed space-y-8">
          
          {/* TAB 1: About Holiday Hub (우리의 시작 & 이름의 의미) */}
          {activeTab === 'story' && (
            <div className="space-y-8 animate-fade-in">
              <section>
                <h3 className="text-xs font-bold tracking-widest text-teal-600 uppercase mb-2">1. The Problem</h3>
                <h2 className="text-2xl font-black text-gray-800 mb-4 tracking-tight">Our Beginning</h2>
                <p className="mb-4">Everyone dreams about travelling. But between dreaming and actually booking a trip, something happens. People get overwhelmed.</p>
                <p className="mb-4">Too many destinations. Too many booking sites. Too many decisions. Eventually, many trips stay as ideas instead of becoming memories.</p>
                <p className="font-medium text-gray-700">This is exactly why Holiday Hub exists.</p>
              </section>

              <section className="bg-teal-50/40 p-6 rounded-2xl border border-teal-100/60 my-6">
                <h3 className="text-xs font-bold tracking-widest text-teal-700 uppercase mb-2">2. Behind The Name</h3>
                <h2 className="text-xl font-black text-teal-900 mb-3 tracking-tight">Why Holiday Hub?</h2>
                <div className="space-y-2 text-teal-950">
                  <p><strong>Holiday:</strong> The essence of travel, exploration, and discovery.</p>
                  <p><strong>Hub:</strong> The central point where everything connects seamlessly.</p>
                  <p className="mt-4 font-bold border-t border-teal-200/60 pt-3 text-teal-900">
                    Holiday Hub is not simply a place to book travel. It is the place where your travel truly begins.
                  </p>
                </div>
              </section>

              <section className="border-t border-gray-100 pt-6">
                <h3 className="text-xs font-bold tracking-widest text-gray-400 uppercase mb-2">3. Our Identity</h3>
                <h2 className="text-2xl font-black text-gray-800 mb-4 tracking-tight">Who We Are</h2>
                <p>We don't simply help people plan trips. <span className="text-teal-600 font-bold underline decoration-2">We help people take the first step toward making them real.</span></p>
              </section>
            </div>
          )}

          {/* TAB 2: Our Mission & Vision (철학과 해결 과제) */}
          {activeTab === 'mission' && (
            <div className="space-y-8 animate-fade-in">
              <section>
                <h3 className="text-xs font-bold tracking-widest text-teal-600 uppercase mb-2">Our Philosophy</h3>
                <h2 className="text-2xl font-black text-gray-800 mb-4 tracking-tight">Making Travel a Reality</h2>
                <div className="p-5 bg-gray-50 rounded-2xl border border-gray-100 font-bold text-gray-800 mb-4">
                  "We are not a booking platform. We are a platform that turns travel dreams into reality."
                </div>
                <p>We focus on removing the friction between your imagination and execution. Travel should be driven by excitement, not hindered by logistical exhaustion.</p>
              </section>

              <section className="border-t border-gray-100 pt-6">
                <h3 className="text-xs font-bold tracking-widest text-gray-400 uppercase mb-2">What We Do</h3>
                <h2 className="text-xl font-black text-gray-800 mb-4 tracking-tight">Dual Planning Infrastructure</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-5 bg-white border border-gray-200 rounded-2xl shadow-sm">
                    <h4 className="font-bold text-teal-700 mb-2">💬 Guess My Travel</h4>
                    <p className="text-sm text-gray-500">Helping people discover where to go by guiding them through a tailored, contextual exploration experience.</p>
                  </div>
                  <div className="p-5 bg-white border border-gray-200 rounded-2xl shadow-sm">
                    <h4 className="font-bold text-blue-600 mb-2">🛠️ Build My Travel</h4>
                    <p className="text-sm text-gray-500">Helping people confidently turn a chosen destination into a structured, highly optimized real-world journey.</p>
                  </div>
                </div>
              </section>
            </div>
          )}

          {/* TAB 3: Our Principles (우리가 믿는 것과 약속) */}
          {activeTab === 'principles' && (
            <div className="space-y-8 animate-fade-in">
              <section>
                <h3 className="text-xs font-bold tracking-widest text-teal-600 uppercase mb-2">Core Beliefs</h3>
                <h2 className="text-2xl font-black text-gray-800 mb-4 tracking-tight">What We Believe</h2>
                <ul className="space-y-3">
                  <li className="flex items-start gap-2.5"><span className="text-teal-500 mt-1">✔</span> We believe travel should feel exciting, not overwhelming.</li>
                  <li className="flex items-start gap-2.5"><span className="text-teal-500 mt-1">✔</span> We believe good planning creates better memories.</li>
                  <li className="flex items-start gap-2.5"><span className="text-teal-500 mt-1">✔</span> We believe AI should support human decisions, not replace them.</li>
                  <li className="flex items-start gap-2.5"><span className="text-teal-500 mt-1">✔</span> We believe every great journey starts with a single idea.</li>
                </ul>
              </section>

              <section className="border-t border-gray-100 pt-6">
                <h3 className="text-xs font-bold tracking-widest text-orange-500 uppercase mb-2">Our Commitment</h3>
                <h2 className="text-xl font-black text-gray-800 mb-4 tracking-tight">Our Promise to You</h2>
                <p className="mb-3">To maintain your trust as a reliable travel partner, we will always aim to:</p>
                <ul className="list-disc pl-5 space-y-1 text-gray-600 mb-6">
                  <li>Be transparent in our services and partnerships.</li>
                  <li>Respect your privacy and data autonomy.</li>
                  <li>Clearly explain how our AI systems operate.</li>
                  <li>Recommend destinations and routes responsibly.</li>
                  <li>Improve continuously based on real user feedback.</li>
                </ul>
              </section>

              {/* 🌟 창업자님이 지시하신, 유저를 주인공으로 만드는 엔딩 크레딧 코너 */}
              <section className="bg-gradient-to-br from-gray-900 to-slate-800 p-8 rounded-3xl text-white shadow-md text-center mt-12 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-teal-500/10 rounded-full blur-3xl"></div>
                <div className="relative z-10 max-w-xl mx-auto space-y-4">
                  <p className="text-sm md:text-base text-gray-300 italic font-medium">"Every destination begins with an idea. Every journey begins with a decision."</p>
                  <p className="text-xs md:text-sm text-teal-300 font-bold border-t border-gray-700 pt-4 leading-relaxed">
                    If Holiday Hub can help make that decision just a little easier, then we've achieved what we set out to do.
                  </p>
                </div>
              </section>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}