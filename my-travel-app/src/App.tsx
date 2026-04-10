import { useState, useEffect, useRef, useCallback } from 'react';
import { useHotelRecommendations } from './hook/useHotelRecommendations';
import type { HotelEntity, SearchParams } from './types/travel';
import AutocompleteInput from './components/chat/AutocompleteInput';
import logoImg from './assets/logo.png';
import { ReactSortable } from 'react-sortablejs';
import { fetchHotelsFromApi } from './domain/hotelLogic';
import { Map, AdvancedMarker, Pin, APIProvider, InfoWindow, Marker } from '@vis.gl/react-google-maps';
import PlanningLayer from './components/PlanningLayer.tsx';
import { ActivityCard } from './components/ActivityCard.tsx';
import type { TravelIntensity } from './utils/travelLogic';
// 메시지 타입 정의
interface Message {
  id: number;
  role: 'assistant' | 'user';
  text: string;
  type?: 'text' | 'date-selector' | 'interest-selector' | 'budget-selector' | 'intensity-selector' | 'hotel-list' | 'plan-result';
}

// 표준 에러 로깅 유틸리티
const logError = (error: any) => {
  console.error("[Holiday Hub Error]:", error);
};
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

console.log("🛠️ ENV Key Check:", GOOGLE_MAPS_API_KEY ? "Loaded" : "Not Found");
declare var google: any; // 전역 google 객체 선언

function App() {
  console.log("DEBUG 2 (Variable Check):", GOOGLE_MAPS_API_KEY);
  // --- 1. 상태 관리 및 참조(Ref) 선언 ---
  const [messages, setMessages] = useState<Message[]>([]);
  const routeCache = useRef<Record<string, any>>({}); // [아키텍처] 루트 캐싱 레이어
  const directionsServiceRef = useRef<any>(null);
  const directionsRendererRef = useRef<any>(null);
  const [currentDay, setCurrentDay] = useState<string>("Day 1");
  // --- 2. 핵심 비즈니스 로직: 비용 방어막(Shield) ---
  const updateRouteWithShield = useCallback((hotelLoc: any, activities: any[]) => {
    // 렌더러가 준비되지 않았으면 시도하지 않음
    if (!directionsRendererRef.current) return;

    if (!directionsServiceRef.current) {
      directionsServiceRef.current = new google.maps.DirectionsService();
    }

    const waypoints = activities
      .filter(a => a.details?.location)
      .map(a => ({
        location: { lat: a.details.location.latitude, lng: a.details.location.longitude },
        stopover: true
      }));

    // 경로의 고유 지문(Signature) 생성
    const routeKey = JSON.stringify([hotelLoc, ...waypoints.map(w => w.location)]);

    // [Step A] 캐시 확인 (비용 0원 구간)
    if (routeCache.current[routeKey]) {
      console.log("♻️ [Holiday Hub] Cache Hit! Route restored without API call.");
      directionsRendererRef.current.setDirections(routeCache.current[routeKey]);
      return;
    }

    // [Step B] 캐시 없으면 실제 API 호출 (숙소 복귀 철학 반영)
    directionsServiceRef.current.route({
      origin: hotelLoc,
      destination: hotelLoc,
      waypoints: waypoints,
      travelMode: google.maps.TravelMode.DRIVING
    }, (result: any, status: any) => {
      if (status === 'OK' && result) {
        console.log("📡 [Holiday Hub] Google API Called & Cached.");
        routeCache.current[routeKey] = result;
        directionsRendererRef.current?.setDirections(result);
      }
    });
  }, []);

  // --- 3. 대화 흐름 상태 ---
  const [currentStep, setCurrentStep] = useState<'destination' | 'dates' | 'must-visit' | 'interests' | 'intensity' | 'budget' | 'hotels' | 'planning' | 'result'>('destination');
  const [destination, setDestination] = useState('');
  const [cityAnchor, setCityAnchor] = useState<{lat: number, lng: number} | null>(null);
  const [tempInterests, setTempInterests] = useState<string[]>([]);
  const [dates, setDates] = useState({ start: '', end: '' });
  const [travelers, setTravelers] = useState({ adults: 2, children: 0 });
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [selectedIntensity, setSelectedIntensity] = useState<TravelIntensity | null>(null);
  const [budgetInfo, setBudgetInfo] = useState({ totalBudget: 2000, rooms: 1 });
  const [mustVisitPlaces, setMustVisitPlaces] = useState<{ name: string, day: number }[]>([]);
  const [tempMustVisitName, setTempMustVisitName] = useState<string | null>(null);
  const [isAskDayMode, setIsAskDayMode] = useState(false);
  const [hoveredHotel, setHoveredHotel] = useState<HotelEntity | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [tripInfo, setTripInfo] = useState<SearchParams | null>(null);
  const { data: hotelData, loading: hotelLoading } = useHotelRecommendations(tripInfo);
  const [selectedHotel, setSelectedHotel] = useState<HotelEntity | null>(null);
  const [planData, setPlanData] = useState<any>(null);
  const [selectedPlaces, setSelectedPlaces] = useState<any[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const today = new Date().toISOString().split('T')[0];
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
  const duration = (() => {
    if (!dates.start || !dates.end) return 3;
    const start = new Date(dates.start);
    const end = new Date(dates.end);
    return Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 3600 * 24)));
  })();

  
  // --- 4. 이벤트 핸들러 ---
  useEffect(() => {
    setTimeout(() => {
      setMessages([{ id: 1, role: 'assistant', text: "Hello! 👋 I'm Holiday Hub.\nWhere would you like to travel?", type: 'text' }]);
    }, 1000);
  }, []);

  useEffect(() => {
    // 메시지가 추가되거나, 플랜이 생성되거나, 호텔이 떴을 때 맨 아래로 부드럽게 스크롤
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, planData, hotelData]);

  useEffect(() => {
  // 데이터가 있고, 현재 단계가 호텔 선택 단계일 때 실행
  if (hotelData && hotelData.recommendedHotels.length > 0 && currentStep === 'hotels') {
    
    // 중복 추가 방지: 마지막 메시지가 이미 hotel-list라면 추가하지 않음
    setMessages(prev => {
      if (prev[prev.length - 1]?.type === 'hotel-list') return prev;
      
      return [...prev, {
        id: Date.now(),
        role: 'assistant',
        text: "Here are my top recommendations based on your budget:",
        type: 'hotel-list' // 이 타입이 있어야 아래 UI 로직이 발동합니다!
      }];
    });
  }
}, [hotelData, currentStep]);

  const handleChatInput = async (value: any) => {
    if (!value) return;
    if (currentStep === 'destination') {
      const destName = typeof value === 'object' ? value.name : value;
      if (typeof value === 'object' && value.coords) setCityAnchor(value.coords);
      setDestination(destName);
      setMessages(prev => [...prev, { id: Date.now(), role: 'user', text: destName }]);
      setTimeout(() => {
        setMessages(prev => [...prev, { id: Date.now() + 1, role: 'assistant', text: "Great! When are you going and who's coming?", type: 'date-selector' }]);
        setCurrentStep('dates');
      }, 600);
    } else if (currentStep === 'must-visit') {
      if (value === 'SKIP_MUST_VISIT') {
        setMessages(prev => [...prev, { id: Date.now(), role: 'user', text: "No more places." }]);
        setTimeout(() => {
          setMessages(prev => [...prev, { id: Date.now() + 1, role: 'assistant', text: "What kind of activities do you enjoy?", type: 'interest-selector' }]);
          setCurrentStep('interests');
        }, 600);
      } else if (!isAskDayMode) {
        const placeName = typeof value === 'object' ? value.name : value;
        setMessages(prev => [...prev, { id: Date.now(), role: 'user', text: placeName }]);
        setTempMustVisitName(placeName);
        setIsAskDayMode(true);
        setTimeout(() => {
          setMessages(prev => [...prev, { id: Date.now() + 1, role: 'assistant', text: `Which day would you visit ${placeName}?`, type: 'text' }]);
        }, 500);
      } else {
        const day = value;
        setMessages(prev => [...prev, { id: Date.now(), role: 'user', text: `Day ${day}` }]);
        setMustVisitPlaces(prev => [...prev, { name: tempMustVisitName!, day: day }]);
        setTempMustVisitName(null);
        setIsAskDayMode(false);
        setTimeout(() => {
          setMessages(prev => [...prev, { id: Date.now() + 1, role: 'assistant', text: "Saved! Any other MUST-VISIT places? (Or Skip)", type: 'text' }]);
        }, 600);
      }
    }
  };
    const handleBudgetSubmit = async (finalBudget: number) => {
      // 1. UI에 검색 시작 알림
      setMessages(prev => [...prev, { 
        id: Date.now(), 
        role: 'assistant', 
        text: "Searching for the perfect hotels... 🏨" 
      }]);

      const tripParams = {
        destination,
        startDate: dates.start,
        endDate: dates.end,
        totalBudget: budgetInfo.totalBudget,
        interests: selectedInterests,
        travelers,
        rooms: budgetInfo.rooms
      };

      try {
        // 2. [교체 완료] 도메인 로직 호출
        setTripInfo(tripParams);
        setCurrentStep('hotels');
      } catch (err) {
        logError(err); // 18번 줄에 정의된 유틸리티 사용
      }
};

  const handleDateTravelerSubmit = () => {
    if (!dates.start || !dates.end) return alert("Please select dates!");
    setMessages(prev => [...prev, { id: Date.now(), role: 'user', text: `${dates.start} ~ ${dates.end} (${travelers.adults + travelers.children} travelers)` }]);
    setTimeout(() => {
      setMessages(prev => [...prev, { id: Date.now() + 1, role: 'assistant', text: "Understood. Is there any specific place you MUST visit?", type: 'text' }]);
      setCurrentStep('must-visit');
    }, 600);
  };

  const handleInterestsSubmit = (interests: string[]) => {
    setSelectedInterests(interests);
    const locations = interests.map(() => ({
    lat: cityAnchor?.lat || 0,
    lng: cityAnchor?.lng || 0
  }));
    setMessages(prev => [...prev, { id: Date.now(), role: 'user', text: interests.join(', ') }]);
    setTimeout(() => {
      setMessages(prev => [...prev, { id: Date.now() + 1, role: 'assistant', text: "How fast-paced should this trip be?", type: 'intensity-selector' }]);
      setCurrentStep('intensity');
    }, 600);
  };

  const handleIntensitySubmit = (intensity: TravelIntensity) => {
  setSelectedIntensity(intensity);
  setMessages(prev => [...prev, { id: Date.now(), role: 'user', text: intensity }]);
  setTimeout(() => {
    setMessages(prev => [...prev, { id: Date.now() + 1, role: 'assistant', text: "What's your budget?", type: 'budget-selector' }]);
    setCurrentStep('budget');
  }, 600);
};

const handleHotelSelect = async (hotel: HotelEntity) => {
  setSelectedHotel(hotel);
  setCurrentStep('planning'); // 🟢 먼저 단계를 바꿔서 UI 레이아웃을 '지도+리스트' 모드로 전환합니다.
  setIsLoading(true); //
  try {
    const response = await fetch(`${API_BASE_URL}/create-plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        destination, 
        interests: selectedInterests, 
        hotel_location: hotel.location, 
        duration, 
        budget: budgetInfo.totalBudget, 
        mustVisitPlaces, 
        travelIntensity: selectedIntensity
      })
    });

    const result = await response.json();

    if (result.daily_plan) {
      setPlanData(result.daily_plan);
      setMessages(prev => [...prev, { id: Date.now() + 2, role: 'assistant', text: "Your customized plan is ready! 👇", type: 'plan-result' }]);
      
      const firstDay = Object.keys(result.daily_plan)[0];
      if (hotel.location) {
        updateRouteWithShield(
          { lat: hotel.location.latitude, lng: hotel.location.longitude }, 
          result.daily_plan[firstDay]
        );
      }
    }
  } catch (error) {
    logError(error);
    alert("일정 생성 중 오류가 발생했습니다 파트너!");
  } finally {
    setIsLoading(false); // 🟢 [추가] 성공하든 실패하든 로딩 종료!
  }
};

const onListSorted = (dayKey: string, newOrderItems: any[]) => {
  setPlanData((prev: any) => ({ ...prev, [dayKey]: newOrderItems }));
  
  // 💡 3. 정렬 시 selectedHotel이 있는지, 아이템이 있는지 안전하게 체크
  if (selectedHotel?.location && newOrderItems.length > 0) {
    updateRouteWithShield(
      { lat: selectedHotel.location.latitude, lng: selectedHotel.location.longitude }, 
      newOrderItems
    );
  }
};

const handleDayChange = (dayKey: string) => {
  console.log(`📅 [DEBUG] 날짜 변경: ${dayKey}`);
  console.log("📍 [DEBUG] 현재 일차의 장소 데이터:", planData[dayKey]);
  setCurrentDay(dayKey);
  if (selectedHotel && planData[dayKey]) {
    // 해당 날짜의 경로를 지도에 업데이트 (비용 방어막 적용)
    updateRouteWithShield(
      { lat: selectedHotel.location.latitude, lng: selectedHotel.location.longitude },
      planData[dayKey]
    );
  }
};


const handleDestinationSelect = async (selected: any) => {
  if (!selected || !selected.place_id) return;

  setDestination(selected.description);

  try {
    // 백엔드 API 호출
    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
    const res = await fetch(`${API_BASE_URL}/place-details?place_id=${selected.place_id}`);
    if (!res.ok) throw new Error(`Server responded with status: ${res.status}`);

    const data = await res.json();
    console.log("📡 [DEBUG] 수신된 장소 데이터:", data); // 데이터 구조 확인용

    // 🟢 [수정 포인트] 구글 순정 API와 우리 백엔드 API 응답 구조를 모두 대응하는 안전한 추출
    // 보통 우리 백엔드 응답은 data.result 안에 들어있거나, data 자체가 결과일 수 있습니다.
    const result = data.result || data;
    
    // 위치 정보 찾기 (우리 백엔드에서 location으로 보냈는지 확인)
    const location = result.geometry?.location || result.location;

    if (location) {
      const coords = {
        lat: typeof location.lat === 'function' ? location.lat() : (location.lat || location.latitude),
        lng: typeof location.lng === 'function' ? location.lng() : (location.lng || location.longitude)
      };
      
      setCityAnchor(coords);
      setMessages(prev => [...prev, { id: Date.now(), role: 'user', text: selected.description }]);

      setTimeout(() => {
        setMessages(prev => [...prev, { 
          id: Date.now() + 1, 
          role: 'assistant', 
          text: "Great! When are you going and who's coming?", 
          type: 'date-selector' 
        }]);
        setCurrentStep('dates'); 
      }, 500);

    } else {
      console.error("❌ 데이터 구조 이상:", data);
      throw new Error("Invalid data structure: 'location' 정보를 찾을 수 없습니다.");
    }
  } catch (err) {
    logError(err);
    alert("도시의 위치 정보를 가져오지 못했습니다. 다시 시도해 주세요.");
  }
};

const handleMustVisitSelect = (selected: any) => {

if (!selected) return;
 
setTempMustVisitName(selected.description);

setMessages(prev => [...prev, { id: Date.now(), role: 'user', text: selected.description }]);


// 🟢 '며칠째에 방문하시나요?' 질문 단계로 진입

setIsAskDayMode(true);

setTimeout(() => {

setMessages(prev => [...prev, {

id: Date.now() + 1,

role: 'assistant',

text: `Which day would you visit ${selected.description}?`,

type: 'text'

}]);

}, 500);

};

  // --- 5. UI 렌더링 ---
  return (
   <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
  <div className="h-screen flex flex-col bg-white overflow-hidden">
    {/* 1. 고정 헤더 */}
    <header className="bg-white px-4 py-3 border-b-2 border-teal-100 flex items-center justify-between z-50 relative">
  
  {/* 좌측 여백 (레이아웃 균형용) */}
  <div className="w-16"></div> 
  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 flex items-center justify-center">
    <img 
      src={logoImg} 
      alt="Holiday Hub Logo" 
      /* 모바일에서는 h-8, PC에서는 h-10으로 설정하여 상하 여백(숨구멍)을 줍니다 */
      className="h-10 md:h-12 w-auto object-contain cursor-pointer hover:opacity-80 transition-opacity" 
      onClick={() => window.location.reload()}
    />
  </div>

  {/* 우측 Reset 버튼 (민트 컬러 적용) */}
  <button onClick={() => window.location.reload()} className="text-sm font-bold text-teal-600 hover:text-teal-800 z-10 transition-colors">
    Reset
  </button>
</header>

    {/* 2. 본문 컨테이너 (지도 + 리스트) */}
    <div className="flex-1 flex flex-col overflow-hidden">
      
      {/* 🟢 상단 고정 지도 영역 (35vh 고정) */}
      {cityAnchor && (currentStep === 'hotels' || currentStep === 'planning' || currentStep === 'result') && (
  <div className="h-[35vh] w-full relative border-b shadow-sm z-20 flex-shrink-0">
    <Map
  defaultCenter={cityAnchor}
  defaultZoom={13}
  mapId="YOUR_MAP_ID" // AdvancedMarker를 쓰려면 반드시 유효한 Map ID가 필요합니다.
  options={{
    gestureHandling: "greedy",
    draggable: true,
    scrollwheel: true,
    disableDefaultUI: false,
  }}
>
  {/* 1. 일정 계획 레이어 (숙소 확정 후 노출) */}
  {selectedHotel && planData && (
    <PlanningLayer 
      selectedHotel={selectedHotel} 
      dailyPlan={planData[currentDay] || []} 
      
    />
  )}

  {/* 2. 호텔 추천 마커 (숙소 선택 전 노출) */}
  {/* selectedHotel이 없을 때만 보여주거나, 항상 보여주도록 설정 가능합니다. */}
    {!selectedHotel && hotelData?.recommendedHotels?.map((hotel) => (
  <AdvancedMarker
  key={`marker-${hotel.id}`}
  position={{ 
    lat: hotel.location.latitude, 
    lng: hotel.location.longitude 
  }}
  onClick={() => setHoveredHotel(hotel)} 
>
  <div className="relative group cursor-pointer flex flex-col items-center">
    {/* 🟢 호텔 이름 레이블: 마커 위에 항상 떠 있음 */}
    <div className="mb-1 px-2 py-0.5 bg-white/90 backdrop-blur-sm border border-gray-200 rounded-md shadow-sm max-w-[100px] truncate">
      <p className="text-[10px] font-bold text-gray-700 truncate">{hotel.name}</p>
    </div>

    {/* 마커 프레임 (기존 이미지 로직) */}
    <div className="w-10 h-10 rounded-full border-2 border-white shadow-lg overflow-hidden transition-transform group-hover:scale-110 bg-blue-500">
      {hotel.image_url ? (
        <img src={hotel.image_url} alt={hotel.name} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-white text-sm bg-blue-400">🏨</div>
      )}
    </div>
    
    {/* 말꼬리 */}
    <div className="w-2 h-2 bg-white rotate-45 -mt-1 shadow-sm"></div>
  </div>
</AdvancedMarker>
))}
</Map>
  </div>
)}


      {/* 🟢 하단 스크롤 리스트 영역 (지도 아래 나머지 공간 차지) */}
      <main className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 custom-scrollbar">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
            {/* 메시지 텍스트 렌더링 ... */}
            <div className={`max-w-[80%] p-3.5 rounded-2xl shadow-sm mb-2 text-sm ${
              msg.role === 'user' 
                ? 'bg-teal-500 text-white rounded-br-none' // 유저 말풍선: 로고의 진한 민트색
                : 'bg-white text-gray-800 border border-teal-100 rounded-bl-none shadow-teal-50/50' // AI 말풍선: 깨끗한 흰색 + 연한 민트 테두리
            }`}>
              {msg.text}
            </div>

            {msg.type === 'date-selector' && (
        <div className="w-full max-w-sm mt-2 p-4 bg-white rounded-2xl shadow-xl border border-blue-100 animate-slide-up">
          <h5 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
            📅 Please select your travel dates
          </h5>
          
          {/* 파트너가 준비한 날짜 선택 UI가 들어갈 자리 */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <input 
                type="date" 
                min={today}
                onChange={(e) => setDates(prev => ({ ...prev, start: e.target.value }))}
                className="p-2 border rounded-lg text-sm"
              />
              <input 
                type="date" 
                min={dates.start || today}
                onChange={(e) => setDates(prev => ({ ...prev, end: e.target.value }))}
                className="p-2 border rounded-lg text-sm"
              />
            </div>
            
            <button 
              onClick={handleDateTravelerSubmit}
              className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition-all"
            >
              Date Confirmed
            </button>
          </div>
        </div>
      )}
      {msg.type === 'interest-selector' && (
  <div className="w-full max-w-sm mt-3 p-4 bg-white rounded-2xl shadow-md border">
    <p className="text-[11px] text-blue-500 font-bold mb-2">Please select up to 3 interests({tempInterests.length}/3)</p>
    <div className="flex flex-wrap gap-2 mb-4">
      {['📷 Photo', '☕️ Cafe', '🛍️ Shop', '🎨 Art', '🌳 Nature', '🍔 Food'].map((tag) => {
        const name = tag.split(' ')[1].toLowerCase();
        const isSelected = tempInterests.includes(name);
        return (
          <button
            key={tag}
            onClick={() => {
              if (isSelected) setTempInterests(p => p.filter(i => i !== name));
              else if (tempInterests.length < 3) setTempInterests(p => [...p, name]);
            }}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
              isSelected ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-400'
            }`}
          >{tag}</button>
        );
      })}
    </div>
    <button 
      disabled={tempInterests.length === 0}
      onClick={() => handleInterestsSubmit(tempInterests)}
      className="w-full py-2 bg-blue-600 text-white rounded-lg text-sm font-bold disabled:bg-gray-200"
    > Interest Confirmed </button>
  </div>
)}

{msg.type === 'intensity-selector' && (
  <div className="w-full max-w-sm mt-3 p-4 bg-white rounded-2xl shadow-md border border-orange-100 animate-slide-up">
    <p className="text-[11px] text-orange-500 font-bold mb-3">🏃 What pace of travel would you prefer?</p>
    <div className="flex flex-col gap-2">
      {[
        { id: 'relaxed', label: '🐢 Relaxed', desc: '4 places in a day, sufficient rest' },
        { id: 'moderate', label: '🚶 Moderate', desc: '5 places per day, popular routes' },
        { id: 'active', label: '🏃 Active', desc: '7 places per day, busy schedule' }
      ].map((opt) => (
        <button
          key={opt.id}
          onClick={() => handleIntensitySubmit(opt.id as TravelIntensity)}
          className="w-full p-3 text-left bg-slate-50 hover:bg-orange-50 rounded-xl border border-transparent hover:border-orange-200 transition-all group"
        >
          <div className="font-bold text-sm text-gray-800">{opt.label}</div>
          <div className="text-[10px] text-gray-650">{opt.desc}</div>
        </button>
      ))}
    </div>
  </div>
)}

{msg.type === 'budget-selector' && (
  <div className="w-full max-w-sm mt-3 p-6 bg-white rounded-2xl shadow-xl border border-green-100 animate-slide-up">
    <h5 className="font-bold text-gray-800 mb-2 flex items-center gap-2">
      💰 Budget of travel (per person)
    </h5>
    
    <div className="py-6">
      {/* 1. 금액 표시 */}
      <div className="text-center mb-4">
        <span className="text-3xl font-black text-blue-600">${budgetInfo.totalBudget}</span>
        <p className={`text-xs font-bold mt-1 ${
          budgetInfo.totalBudget <= 1500 ? 'text-green-500' : 
          budgetInfo.totalBudget <= 3500 ? 'text-blue-500' : 'text-purple-500'
        }`}>
          {budgetInfo.totalBudget <= 2000 ? "🌱 Budget-friendly and economical travel" : 
           budgetInfo.totalBudget <= 5000 ? "✨ Comfortable and reasonable travel" : "💎 Luxurious and special travel"}
        </p>
      </div>

      {/* 2. 슬라이더 (Bar) */}
      <input 
        type="range" 
        min="500" 
        max="10000" 
        step="100"
        value={budgetInfo.totalBudget}
        onChange={(e) => setBudgetInfo(prev => ({ ...prev, totalBudget: parseInt(e.target.value) }))}
        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
      />
      
      <div className="flex justify-between text-[10px] text-gray-400 mt-2 font-bold">
        <span>$500</span>
        <span>$5,000</span>
        <span>$10,000+</span>
      </div>
    </div>

    <button 
      onClick={() => handleBudgetSubmit(budgetInfo.totalBudget)}
      className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold shadow-lg hover:bg-blue-700 transition-all"
    >
      Find out hotel in this budget 🏨
    </button>
  </div>
)}

{msg.type === 'hotel-list' && hotelData && (
  <div className="w-full space-y-3 mt-2 animate-slide-up">
    {hotelData.recommendedHotels.map((hotel: HotelEntity) => (
      <div 
        key={hotel.id}
        onClick={() => handleHotelSelect(hotel)} 
        className="bg-white p-4 rounded-2xl shadow-md border border-gray-100 hover:border-blue-300 transition-all cursor-pointer group"
      >
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <h4 className="font-bold text-gray-800 group-hover:text-blue-600 transition-colors">
              {hotel.name}
            </h4>
            
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-xs text-gray-500 font-medium">⭐️ {hotel.rating}</span>
              <span className="text-gray-300">|</span>
              <span className="text-xs text-gray-500 font-medium">💰 ${hotel.price_Per_Night}/night</span>
              
              {/* ✅ 구글 맵 링크 추가 */}
              {hotel.google_map_url && (
                <a 
                  href={hotel.google_map_url}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()} // 🟢 중요: 카드 선택 방지
                  className="ml-1 text-[11px] text-blue-500 font-bold hover:text-blue-700 hover:underline flex items-center gap-0.5"
                >
                  📍 View Map
                </a>
              )}
            </div>
          </div>
          
          <button className="bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg text-xs font-black shadow-sm group-hover:bg-blue-600 group-hover:text-white transition-all">
            Choose
          </button>
        </div>
      </div>
    ))}
  </div>
)}
            {/* 일정 결과 카드 (지도를 뺀 순수 리스트 UI) */}
            {msg.type === 'plan-result' && planData && (
              <div className="w-full space-y-4 animate-slide-up">
                {/* 일자 선택 탭 */}
                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
                  {Object.keys(planData).map((dayKey) => (
                    <button
                      key={dayKey}
                      onClick={() => handleDayChange(dayKey)}
                      className={`px-5 py-2 rounded-full text-sm font-bold transition-all ${
                        currentDay === dayKey ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-gray-400 border'
                      }`}
                    >
                      {dayKey}
                    </button>
                  ))}
                </div>

                {/* 타임라인 리스트 */}
              <ReactSortable 
  list={planData[currentDay] || []} 
  setList={(newOrder) => onListSorted(currentDay, newOrder)}
  handle=".drag-handle"
  className="space-y-1" 
>
  {(planData[currentDay] || []).map((item: any, idx: number) => (
    <div key={item.details?.id || idx} className="relative">
      
      {/* 🟢 1. 이동 시간 (Dashed Line) */}
      {idx > 0 && (
        <div className="ml-10 py-2 border-l-2 border-dashed border-gray-200 pl-8 relative">
          <div className="absolute left-[-11px] top-1/2 -translate-y-1/2 bg-white p-1 text-xs">
            🚗
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <div className="flex items-center gap-1 text-green-600 bg-green-50 px-2 py-0.5 rounded-full text-[10px] font-bold">
              <span>🚌</span> {item.travel_details?.transit || 0}Min
            </div>
            <div className="flex items-center gap-1 text-orange-500 bg-orange-50 px-2 py-0.5 rounded-full text-[10px] font-bold">
              <span>🏃</span> {item.travel_details?.walking || 0}Min
            </div>
            <span className="text-[11px] font-bold text-blue-400">
              {Math.round(item.travel_details?.driving || 15)}Min Drive
            </span>
          </div>
        </div>
      )}

      {/* 🟢 2. 카드 상단에 구글 맵 버튼 배치 */}
      {/* ActivityCard와 겹치지 않게 우측 상단에 작게 배치하는 것이 좋습니다 */}
      <div className="relative group">
        {item.details?.google_map_url && (
          <a 
            href={item.details.google_map_url} 
            target="_blank" 
            rel="noreferrer"
            className="absolute right-4 top-4 z-10 bg-white/80 backdrop-blur-sm p-1.5 rounded-full shadow-sm hover:bg-blue-50 transition-colors"
            title="Open in Google Maps"
          >
            <span className="text-xs">📍</span>
          </a>
        )}

        {/* 🟢 3. 비즈니스 로직이 주입된 카드 컴포넌트 */}
        <ActivityCard 
          item={item} 
          idx={idx} 
          intensity={selectedIntensity as TravelIntensity} 
        />
      </div>
    </div>
  ))}
</ReactSortable>
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </main>
    </div>

<footer className="bg-white p-3 border-t border-gray-100 sticky bottom-0 z-20">
  {(currentStep === 'destination' || currentStep === 'must-visit'|| currentStep === 'dates') ? (
    <div className="flex flex-col gap-2">
      {isAskDayMode ? (
        /* 상황 A: 날짜 선택 버튼들 */
        <div className="flex gap-2 justify-center overflow-x-auto py-2 no-scrollbar">
          {Array.from({ length: duration }, (_, i) => i + 1).map((day) => (
            <button
              key={day}
              onClick={() => handleChatInput(day)}
              className="flex-shrink-0 px-4 py-2 bg-teal-50 text-teal-700 rounded-full font-bold text-sm"
            >
              Day {day}
            </button>
          ))}
        </div>
      ) : (
        /* 상황 B: 검색창 및 Skip 버튼 */
        <div className="flex flex-col gap-3">
          
          {/* 🟢 수정 완료: 중복 조건문 제거 및 div 닫기 */}
          {currentStep === 'destination' && (
            <div className="flex flex-col gap-2 w-full animate-fade-in">
              {/* 시각적 넛지: 로고의 민트 컬러 텍스트 활용 */}
              <div className="text-center mb-1">
                <span className="text-[11px] font-bold text-teal-600 bg-teal-50 px-3 py-1 rounded-full">
                  ✨ Quick plan, quick go
                </span>
              </div>
              <AutocompleteInput 
                onSelect={handleDestinationSelect}
                searchType="city"                
                placeholder="Which city would you like to visit?"
              />
            </div> /* <--- 빠졌던 닫는 태그 복구 완료! */
          )}

          {currentStep === 'dates' && (
            <div className="text-center py-2">
              <p className="text-sm font-medium text-teal-600 animate-pulse">
                Please select your travel dates 📅
              </p>
            </div>
          )}

          {currentStep === 'must-visit' && (
            <>
              {/* Skip 버튼 */}
              <button 
                onClick={() => handleChatInput('SKIP_MUST_VISIT')}
                className="w-full py-2 text-xs font-bold text-gray-700 hover:text-teal-700 transition-colors bg-gray-50 rounded-lg border border-dashed border-gray-300"
              >
                Don't have any places to add? Skip ⏭️
              </button>
              <AutocompleteInput 
                onSelect={handleMustVisitSelect} 
                searchType="place"                 
                locationBias={cityAnchor}          
                placeholder="Which places would you like to visit?"
              />
            </>
          )}
        </div>
      )}
    </div>
  ) : (
    /* 상황 C: 대기 메시지 */
    <div className="text-center text-xs text-gray-400 py-3">
      Please select options from the chat above ☝️
    </div>
  )}
</footer>
      </div> {/* min-h-screen 닫기 */}
      {isLoading && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, width: '100%', height: '100%',
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
          display: 'flex', flexDirection: 'column',
          justifyContent: 'center', alignItems: 'center',
          zIndex: 9999, textAlign: 'center'
        }}>
          {/* Tailwind 애니메이션 스피너 */}
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-600 mb-6"></div>
          
          <h2 className="text-2xl font-black text-gray-800 animate-bounce">
            🧠 Holiday Hub AI
          </h2>
          <p className="mt-4 text-gray-600 font-medium leading-relaxed">
            Designing the optimal route for you...<br/>
            <span className="text-sm text-blue-500">(Matching restaurants and attractions)</span>
          </p>
        </div>
      )}
    </APIProvider>
  ); // return 끝
}



export default App;