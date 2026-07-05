import React, { useState } from 'react';

interface ConsentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmLogin: () => void; // 동의 완료 후 실제 구글 로그인을 실행하는 함수
  setViewMode: (mode: any) => void;
}

export default function ConsentModal({ isOpen, onClose, onConfirmLogin, setViewMode }: ConsentModalProps) {
  // 체크박스 상태 관리
  const [ageChecked, setAgeChecked] = useState(false);
  const [termsChecked, setTermsChecked] = useState(false);
  const [privacyChecked, setPrivacyChecked] = useState(false);
  
  // 모든 필수 항목이 체크되었는지 확인
  const isAllRequiredChecked = ageChecked && termsChecked && privacyChecked;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-[10000] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl p-6 md:p-8 w-full max-w-md shadow-2xl relative" onClick={(e) => e.stopPropagation()}>
        
        {/* 닫기 버튼 */}
        <button onClick={onClose} className="absolute top-5 right-5 text-gray-400 hover:text-gray-600 transition-colors">
          <i className="fas fa-times text-xl"></i>
        </button>

        {/* 헤더 */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-teal-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-teal-100">
            <span className="text-2xl">🌍</span>
          </div>
          <h2 className="text-2xl font-black text-gray-800 mb-2">Welcome to Holiday Hub</h2>
          <p className="text-sm text-gray-500 font-medium">Before we start planning, please review our core principles.</p>
        </div>

        {/* 체크박스 영역 */}
        <div className="space-y-4 mb-8">
          
          {/* 1. 연령 확인 (필수) */}
          <label className="flex items-start gap-3 cursor-pointer group">
            <div className="relative flex items-center mt-0.5">
              <input type="checkbox" checked={ageChecked} onChange={(e) => setAgeChecked(e.target.checked)} className="peer sr-only" />
              <div className="w-5 h-5 border-2 border-gray-300 rounded-md peer-checked:bg-teal-600 peer-checked:border-teal-600 transition-all flex items-center justify-center">
                <i className="fas fa-check text-white text-[10px] opacity-0 peer-checked:opacity-100"></i>
              </div>
            </div>
            <div className="flex-1 text-sm text-gray-700 font-medium group-hover:text-gray-900 transition-colors">
              <span className="text-teal-600 font-bold mr-1">[Required]</span> I am 14 years of age or older.
            </div>
          </label>

          {/* 2. 이용약관 동의 (필수) */}
          <label className="flex items-start gap-3 cursor-pointer group">
            <div className="relative flex items-center mt-0.5">
              <input type="checkbox" checked={termsChecked} onChange={(e) => setTermsChecked(e.target.checked)} className="peer sr-only" />
              <div className="w-5 h-5 border-2 border-gray-300 rounded-md peer-checked:bg-teal-600 peer-checked:border-teal-600 transition-all flex items-center justify-center">
                <i className="fas fa-check text-white text-[10px] opacity-0 peer-checked:opacity-100"></i>
              </div>
            </div>
            <div className="flex-1 text-sm text-gray-700 font-medium group-hover:text-gray-900 transition-colors">
              <span className="text-teal-600 font-bold mr-1">[Required]</span> I agree to the{' '}
              <button onClick={(e) => { e.preventDefault(); setViewMode('terms'); onClose(); }} className="text-gray-500 underline hover:text-teal-600">Terms of Service</button>.
            </div>
          </label>

          {/* 3. 개인정보 및 AI 처리 동의 (필수) - 창업자님 핵심 포인트 */}
          <label className="flex items-start gap-3 cursor-pointer group">
            <div className="relative flex items-center mt-0.5">
              <input type="checkbox" checked={privacyChecked} onChange={(e) => setPrivacyChecked(e.target.checked)} className="peer sr-only" />
              <div className="w-5 h-5 border-2 border-gray-300 rounded-md peer-checked:bg-teal-600 peer-checked:border-teal-600 transition-all flex items-center justify-center">
                <i className="fas fa-check text-white text-[10px] opacity-0 peer-checked:opacity-100"></i>
              </div>
            </div>
            <div className="flex-1 text-sm text-gray-700 font-medium group-hover:text-gray-900 transition-colors leading-snug">
              <span className="text-teal-600 font-bold mr-1">[Required]</span> I agree to the{' '}
              <button onClick={(e) => { e.preventDefault(); setViewMode('privacy'); onClose(); }} className="text-gray-500 underline hover:text-teal-600">Privacy Policy</button>, 
              and acknowledge that my travel inputs may be processed by AI systems to generate recommendations.
            </div>
          </label>

        </div>

        {/* 액션 버튼 */}
        <button 
          onClick={() => {
            if (isAllRequiredChecked) {
              onConfirmLogin();
              onClose();
            }
          }}
          disabled={!isAllRequiredChecked}
          className={`w-full py-4 rounded-xl font-black text-sm transition-all flex items-center justify-center gap-2 shadow-sm ${
            isAllRequiredChecked 
              ? 'bg-gray-900 text-white hover:bg-gray-800 hover:shadow-md transform hover:-translate-y-0.5' 
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          }`}
        >
          {isAllRequiredChecked ? (
            <>
              <i className="fab fa-google text-red-500 bg-white rounded-full p-0.5"></i>
              Continue with Google
            </>
          ) : (
            'Please accept all terms to continue'
          )}
        </button>
      </div>
    </div>
  );
}