import React from 'react';

type ViewMode = 'intro' | 'main' | 'guess' | 'build' | 'terms' | 'privacy' | 'about' | 'contact' | 'disclosure';

interface PageProps {
  setViewMode: (mode: ViewMode) => void;
}

export default function PrivacyPolicy({ setViewMode }: PageProps) {
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
          <h1 className="text-3xl md:text-4xl font-black mb-4 text-gray-900 tracking-tight">Privacy Policy</h1>
          <div className="text-sm text-gray-500 flex flex-col gap-1 font-medium">
            <p>Effective Date: [To be inserted]</p>
            <p>Last Updated: [To be inserted]</p>
          </div>
        </div>

        {/* 🌟 창업자님이 가장 강조하신 핵심 신뢰 선언문 (Trust Declaration) */}
        <div className="bg-teal-50/50 p-6 rounded-2xl border border-teal-100 mb-10 text-teal-900 font-medium leading-relaxed">
          <p className="text-lg font-bold mb-2">At Holiday Hub, your trust matters as much as your journey.</p>
          <p className="mb-2">We only collect the information necessary to help you plan better trips, improve your experience, and keep your account secure.</p>
          <p className="font-black text-teal-700 decoration-teal-300 underline underline-offset-4">Holiday Hub does not sell your personal information to advertisers or data brokers.</p>
        </div>

        {/* 본문 시작 */}
        <div className="space-y-10 text-gray-600 text-sm md:text-base leading-relaxed">
          
          <section>
            <h2 className="text-xl font-black text-gray-800 mb-3">1. Introduction</h2>
            <p>This Privacy Policy explains how Holiday Hub ("we," "our," or "us") collects, uses, and protects your information when you use our website, mobile application, and AI travel planning services (collectively, the "Service"). By using Holiday Hub, you agree to the practices described in this policy.</p>
          </section>

          <section>
            <h2 className="text-xl font-black text-gray-800 mb-3">2. Information We Collect</h2>
            <p className="mb-3">To provide you with a seamless travel planning experience, we may collect the following types of information:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Login Information (via Google OAuth):</strong> Google ID, Name, Email Address, and Profile Image (optional).</li>
              <li><strong>Travel Data:</strong> Destination, budget, travel dates, number of travellers, and specific interests entered into our planner.</li>
              <li><strong>AI Usage Data:</strong> Chat prompts and inputs (e.g., "3 days in Osaka").</li>
              <li><strong>Device & Technical Information:</strong> Browser type, IP address, language preferences, and Operating System (OS).</li>
              <li><strong>Analytics Data:</strong> Interaction metrics gathered via Google Analytics, Firebase, PostHog, or Mixpanel.</li>
              <li><strong>Affiliate Event Data:</strong> Clicks and redirection events to third-party booking partners (e.g., Klook, Booking.com, Skyscanner).</li>
              <li><strong>Cookies:</strong> Data used for session management, login persistence, language, and theme preferences.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-black text-gray-800 mb-4">3. Why We Collect It</h2>
            <p className="mb-4">We believe in transparency. Here is exactly why we need your data:</p>
            <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
              <table className="w-full text-left border-collapse min-w-[500px]">
                <thead>
                  <tr className="bg-gray-50 text-gray-800 border-b border-gray-200">
                    <th className="p-4 font-bold text-sm">Data Type</th>
                    <th className="p-4 font-bold text-sm">Purpose</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  <tr><td className="p-4 font-semibold text-gray-700">Email</td><td className="p-4 text-gray-600">Account login and security.</td></tr>
                  <tr><td className="p-4 font-semibold text-gray-700">Name & Profile Image</td><td className="p-4 text-gray-600">Personalizing your profile experience.</td></tr>
                  <tr><td className="p-4 font-semibold text-gray-700">Travel Preferences</td><td className="p-4 text-gray-600">Generating accurate and tailored travel itineraries.</td></tr>
                  <tr><td className="p-4 font-semibold text-gray-700">Analytics</td><td className="p-4 text-gray-600">Improving platform features and fixing bugs.</td></tr>
                  <tr><td className="p-4 font-semibold text-gray-700">Cookies</td><td className="p-4 text-gray-600">Maintaining your login session and UI preferences.</td></tr>
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-black text-gray-800 mb-3">4. Google Login</h2>
            <p className="font-semibold text-blue-700 bg-blue-50 p-3 rounded-lg border border-blue-100">Holiday Hub only requests the minimum Google account information required to authenticate your account.</p>
            <p className="mt-3">We do not have access to your Google password or other personal files stored in your Google account.</p>
          </section>

          <section>
            <h2 className="text-xl font-black text-gray-800 mb-3">5. AI Processing</h2>
            <p className="font-semibold text-purple-700 bg-purple-50 p-3 rounded-lg border border-purple-100">Some information you provide may be processed by AI systems solely for the purpose of generating travel recommendations.</p>
            <p className="mt-3">Your personal identity (like your name or email) is stripped or decoupled before travel data is sent to our AI models for processing.</p>
          </section>

          <section>
            <h2 className="text-xl font-black text-gray-800 mb-3">6. Cookies</h2>
            <p>We use essential cookies to keep you logged in and remember your basic preferences (like language or dark mode). You can control cookie preferences through your browser settings, though disabling them may affect your ability to log in or save trips.</p>
          </section>

          <section>
            <h2 className="text-xl font-black text-gray-800 mb-3">7. Analytics</h2>
            <p>To understand how users interact with Holiday Hub and to improve our service, we use aggregated, anonymized tracking tools. This helps us know which features are loved and which need improvement.</p>
          </section>

          <section>
            <h2 className="text-xl font-black text-gray-800 mb-3">8. Affiliate Tracking</h2>
            <p>When you click on a booking link, an anonymous tracking ID may be passed to the partner site (e.g., Klook) to attribute the referral to Holiday Hub. This does not transfer your personal information to the partner.</p>
          </section>

          <section>
            <h2 className="text-xl font-black text-gray-800 mb-3">9. Third-Party Services</h2>
            <p>We do not share your personal information with third-party services except as strictly necessary to provide the Service (e.g., using secure cloud hosting or authentication providers). Once you leave Holiday Hub to make a booking, the privacy policy of the respective third-party service applies.</p>
          </section>

          <section className="bg-red-50/50 p-6 rounded-2xl border border-red-100">
            <h2 className="text-xl font-black text-red-900 mb-3">10. Data Storage & Deletion</h2>
            <p className="mb-3 text-red-800 font-medium">You have absolute control over your data lifecycle. If you choose to delete your account, we will permanently remove:</p>
            <ul className="list-disc pl-5 space-y-1 mb-3 text-red-900">
              <li>Your account credentials and personal profile.</li>
              <li>Your generated itineraries.</li>
              <li>Your saved trips and history.</li>
            </ul>
            <p className="text-sm text-red-700 opacity-90">Exceptions apply only to data we are legally required to retain for security logs, fraud prevention, or financial compliance.</p>
          </section>

          <section>
            <h2 className="text-xl font-black text-gray-800 mb-3">11. Data Security</h2>
            <p>We implement industry-standard encryption and security protocols to protect your data. However, no internet transmission is 100% secure, and we cannot guarantee absolute security.</p>
          </section>

          <section className="bg-gray-900 text-white p-6 rounded-2xl shadow-md">
            <h2 className="text-xl font-black mb-3 text-teal-300">12. Your Rights</h2>
            <p className="mb-3 text-gray-300">In alignment with global privacy standards (including GDPR, CCPA, and the Australian Privacy Act), you retain full rights over your data. You can at any time request to:</p>
            <ul className="space-y-2 mb-4 font-medium">
              <li className="flex items-center gap-2"><i className="fas fa-download text-teal-400"></i> Download a copy of your data.</li>
              <li className="flex items-center gap-2"><i className="fas fa-edit text-teal-400"></i> Edit or correct your information.</li>
              <li className="flex items-center gap-2"><i className="fas fa-trash-alt text-teal-400"></i> Delete your account and associated data.</li>
              <li className="flex items-center gap-2"><i className="fas fa-ban text-teal-400"></i> Withdraw consent for specific processing.</li>
            </ul>
            <p className="text-sm text-gray-400">To exercise these rights, simply contact our support team.</p>
          </section>

          <section>
            <h2 className="text-xl font-black text-gray-800 mb-3">13. Children's Privacy</h2>
            <p>Holiday Hub is not intended for use by individuals under the age of 13 (or the applicable age of consent in your jurisdiction). We do not knowingly collect personal information from children.</p>
          </section>

          <section>
            <h2 className="text-xl font-black text-gray-800 mb-3">14. International Transfers</h2>
            <p>Your information may be processed on servers located outside of your country of residence. By using Holiday Hub, you consent to the transfer of information to countries that may have different data protection laws than your own.</p>
          </section>

          <section>
            <h2 className="text-xl font-black text-gray-800 mb-3">15. Policy Updates</h2>
            <p>We may update this Privacy Policy as our services evolve. If material changes are made, we will notify you through the platform or via email before they take effect.</p>
          </section>

          <section>
            <h2 className="text-xl font-black text-gray-800 mb-3">16. Contact</h2>
            <p>If you have any questions or concerns regarding this Privacy Policy or your data rights, please contact our privacy team via the Legal Center contact channels.</p>
          </section>

        </div>
      </div>
    </div>
  );
}