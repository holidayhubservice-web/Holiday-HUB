import React from 'react';

// App.tsx와 완벽하게 일치하는 엄격한 타입
type ViewMode = 'intro' | 'main' | 'guess' | 'build' | 'terms' | 'privacy' | 'about' | 'contact' | 'disclosure';

interface PageProps {
  setViewMode: (mode: ViewMode) => void;
}

export default function AffiliateDisclosure({ setViewMode }: PageProps) {
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
        <div className="border-b border-gray-100 pb-8 mb-8">
          <h1 className="text-3xl md:text-4xl font-black mb-4 text-gray-900 tracking-tight">Affiliate Disclosure</h1>
          <div className="text-sm text-gray-500 flex flex-col gap-1 font-medium">
            <p>Effective Date: [To be inserted]</p>
            <p>Transparency & Trust in Our Business Model</p>
          </div>
        </div>

        {/* 🌟 창업자님의 핵심 철학 (Opening Statement) */}
        <div className="bg-slate-900 text-white p-6 md:p-8 rounded-2xl shadow-md mb-10 leading-relaxed relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-teal-500/20 rounded-full blur-3xl"></div>
          <p className="text-lg md:text-xl font-bold mb-4 relative z-10">
            "Travel recommendations should be based on what is best for you—not simply on what earns us the highest commission."
          </p>
          <p className="text-gray-300 relative z-10">
            Transparency is one of the principles we built Holiday Hub on, and this disclosure explains exactly how our affiliate relationships work. We believe trust is earned through transparency. If we receive compensation from a booking partner, we believe you deserve to know. Our goal is to help you make informed travel decisions—not simply to maximize affiliate revenue.
          </p>
        </div>

        {/* 본문 시작 (4대 질문 구조) */}
        <div className="space-y-10 text-gray-600 text-sm md:text-base leading-relaxed">
          
          <section>
            <h2 className="text-xl font-black text-gray-800 mb-3">1. Why do we use affiliate links?</h2>
            <p>Building and maintaining advanced AI travel planners, real-time map integrations, and server infrastructure requires significant resources.</p>
            <p className="mt-2">Holiday Hub uses affiliate programs as a way to sustain and continuously improve our platform <strong className="text-teal-700">without charging you extra fees</strong>. When you use our service to generate an itinerary or find a flight, and subsequently make a booking through one of our partners, you do not pay a single cent more than if you had booked directly.</p>
          </section>

          <section>
            <h2 className="text-xl font-black text-gray-800 mb-4">2. How do affiliate links work?</h2>
            <p className="mb-4">The process is simple and completely invisible to your booking experience. Here is how the structure works:</p>
            
            {/* 시각적 프로세스 플로우 */}
            <div className="flex flex-col md:flex-row items-center justify-between bg-gray-50 p-6 rounded-2xl border border-gray-100 gap-4 text-center text-sm font-bold text-gray-700">
              <div className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm text-xl border border-gray-200">🤖</div>
                <span>Holiday Hub<br/><span className="text-[10px] text-gray-400 font-normal">Plan & Find</span></span>
              </div>
              <i className="fas fa-arrow-right text-teal-300 rotate-90 md:rotate-0"></i>
              <div className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm text-xl border border-gray-200">🔗</div>
                <span>Booking Partner<br/><span className="text-[10px] text-gray-400 font-normal">e.g., Skyscanner, Klook</span></span>
              </div>
              <i className="fas fa-arrow-right text-teal-300 rotate-90 md:rotate-0"></i>
              <div className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm text-xl border border-gray-200">✅</div>
                <span>Booking<br/><span className="text-[10px] text-gray-400 font-normal">Completed</span></span>
              </div>
              <i className="fas fa-arrow-right text-teal-300 rotate-90 md:rotate-0"></i>
              <div className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 bg-teal-50 rounded-full flex items-center justify-center shadow-sm text-xl border border-teal-100">💰</div>
                <span className="text-teal-700">Commission<br/><span className="text-[10px] text-teal-600/70 font-normal">Paid to us by partner</span></span>
              </div>
            </div>
          </section>

          <section className="bg-amber-50/50 p-6 rounded-2xl border border-amber-100">
            <h2 className="text-xl font-black text-amber-900 mb-3">3. Does commission affect recommendations?</h2>
            {/* 🌟 파트너님이 직접 작성하신 법적/운영적 마스터피스 문장 */}
            <p className="font-bold text-amber-900 text-base md:text-lg mb-4 leading-snug">
              "Affiliate relationships may be one of several factors considered when presenting booking options, but they are not the sole determining factor."
            </p>
            <p className="mb-4 text-amber-800">
              We strive to present recommendations that are relevant to your travel preferences, itinerary, availability, value, and overall user experience. Our AI recommendation algorithm processes options in the following priority:
            </p>
            
            {/* 알고리즘 플로우 시각화 */}
            <div className="flex flex-wrap gap-2 text-[11px] md:text-xs font-bold text-amber-700">
              <span className="bg-white px-3 py-1.5 rounded-lg shadow-sm border border-amber-200/50">Destination Relevance</span>
              <span className="flex items-center text-amber-300">➔</span>
              <span className="bg-white px-3 py-1.5 rounded-lg shadow-sm border border-amber-200/50">User Preferences</span>
              <span className="flex items-center text-amber-300">➔</span>
              <span className="bg-white px-3 py-1.5 rounded-lg shadow-sm border border-amber-200/50">Travel Dates</span>
              <span className="flex items-center text-amber-300">➔</span>
              <span className="bg-white px-3 py-1.5 rounded-lg shadow-sm border border-amber-200/50">Availability</span>
              <span className="flex items-center text-amber-300">➔</span>
              <span className="bg-white px-3 py-1.5 rounded-lg shadow-sm border border-amber-200/50">Price</span>
              <span className="flex items-center text-amber-300">➔</span>
              <span className="bg-amber-100 px-3 py-1.5 rounded-lg shadow-sm border border-amber-300 text-amber-900">Affiliate Relationship <span className="opacity-70 font-normal">(if applicable)</span></span>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-black text-gray-800 mb-3">4. What are we responsible for?</h2>
            <p className="mb-3">Holiday Hub acts strictly as an AI travel planner and aggregator. When you click an affiliate link and are redirected to a Third-Party Service, your actual booking contract is formed exclusively between you and that provider.</p>
            <p className="font-medium text-gray-800 mb-2">Therefore, Holiday Hub is not responsible for:</p>
            <ul className="list-disc pl-5 space-y-1 text-gray-600">
              <li>Flight cancellations or delays.</li>
              <li>Refund rejections or disputes.</li>
              <li>Price changes that occur after you leave our platform.</li>
              <li>Hotel overbookings or service quality issues at the destination.</li>
            </ul>
            <p className="mt-4 text-sm">If you experience any issues with a reservation, you must contact the customer support team of the booking platform where the transaction was completed.</p>
          </section>

        </div>
      </div>
    </div>
  );
}