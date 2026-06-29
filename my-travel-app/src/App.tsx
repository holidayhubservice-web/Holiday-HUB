import { useState, useEffect, useRef, useCallback } from 'react';
import { useHotelRecommendations } from './hook/useHotelRecommendations';
import type { HotelEntity, SearchParams } from './types/travel';
import AutocompleteInput from './components/chat/AutocompleteInput';
import { ReactSortable } from 'react-sortablejs';
import { fetchHotelsFromApi } from './domain/hotelLogic';
import { Map, AdvancedMarker, Pin, APIProvider, InfoWindow, Marker } from '@vis.gl/react-google-maps';
import PlanningLayer from './components/PlanningLayer.tsx';
import { ActivityCard } from './components/ActivityCard.tsx';
import type { TravelIntensity } from './utils/travelLogic';
import { trackEvent } from './services/analytics';
import { useAuth } from './hook/useAuth';
import { collection, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { db } from './firebaseConfig';
import SplitHomepage from './components/SplitHomepage';
import BookingBridgeModal from './components/BookingBridgeModal';
import TourWidget from './components/TourWidget';
import FlightWidget from './components/FlightWidget';

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
  // --- 1. 상태 관리 및 참조(Ref) 선언 ---
  const [viewMode, setViewMode] = useState<'intro' | 'main' | 'guess' | 'build'>('intro');
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
  const [preferredHotel, setPreferredHotel] = useState<string>('');
  const [mustVisitPlaces, setMustVisitPlaces] = useState<{ name: string, day: number }[]>([]);
  const [tempMustVisitName, setTempMustVisitName] = useState<string | null>(null);
  const [isAskDayMode, setIsAskDayMode] = useState(false);
  const [hoveredHotel, setHoveredHotel] = useState<HotelEntity | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [tripInfo, setTripInfo] = useState<SearchParams | null>(null);
  const { data: hotelData, loading: hotelLoading } = useHotelRecommendations(tripInfo);
  const [selectedHotel, setSelectedHotel] = useState<HotelEntity | null>(null);
  const [planData, setPlanData] = useState<any>(null);
  const [isPrefetched, setIsPrefetched] = useState(false);
  const [selectedPlaces, setSelectedPlaces] = useState<any[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const today = new Date().toISOString().split('T')[0];
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
  const [isMyPageOpen, setIsMyPageOpen] = useState(false);
  const { user, loginWithGoogle, logout } = useAuth();
  const [myPageMode, setMyPageMode] = useState<'profile' | 'list'>('profile');
  const [savedPlans, setSavedPlans] = useState<any[]>([]);
  const [isLoadingPlans, setIsLoadingPlans] = useState(false);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const duration = (() => {
    if (!dates.start || !dates.end) return 3;
    const start = new Date(dates.start);
    const end = new Date(dates.end);
    return Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 3600 * 24)));
  })();

  useEffect(() => {
    const savedPlan = localStorage.getItem('holidayHub_currentPlan');
    const savedDestination = localStorage.getItem('holidayHub_destination');
    
    if (savedPlan) {
      setPlanData(JSON.parse(savedPlan)); // 💡 변수명을 파트너의 코드에 맞게 planData로 수정했습니다!
    }
    if (savedDestination) {
      setDestination(savedDestination); 
    }
  }, []);

  // 2. 여행 계획(planData)이 변경될 때마다 자동 저장합니다.
  useEffect(() => {
    if (planData) {
      localStorage.setItem('holidayHub_currentPlan', JSON.stringify(planData));
    }
  }, [planData]);

  // 3. 목적지(destination)가 변경될 때마다 자동 저장합니다.
  useEffect(() => {
    if (destination) {
      localStorage.setItem('holidayHub_destination', destination);
    }
  }, [destination]);
  
  
  // --- 4. 이벤트 핸들러 ---
  useEffect(() => {
    // 🚀 [수정] 주소창에 공유 링크(?plan=)가 없을 때만 1초 뒤에 기본 인사말을 띄웁니다.
    const urlParams = new URLSearchParams(window.location.search);
    if (!urlParams.get('plan')) {
      setTimeout(() => {
        setMessages([{ id: 1, role: 'assistant', text: "Hello! 👋 I'm Holiday Hub.\nWhere would you like to travel?", type: 'text' }]);
      }, 1000);
    }
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


  // =========================================================
  // 🚀 [신규 추가] 그림자 수집 (Shadow Fetching) 트리거
  // =========================================================
  useEffect(() => {
    // 호텔이 화면에 떴고, 아직 수집을 안 했다면 백그라운드에서 조용히 실행!
    if (hotelData && hotelData.recommendedHotels.length > 0 && currentStep === 'hotels' && !isPrefetched) {
      console.log("🕵️‍♂️ [Shadow Fetching] 유저가 호텔을 고민하는 동안 장소를 몰래 긁어옵니다...");
      
      // 중복 실행 방지를 위해 바로 true로 변경
      setIsPrefetched(true); 

      // 🔥 await 없이 던져놓고 잊어버립니다 (Fire and Forget). 유저 화면은 멈추지 않습니다.
      fetch(`${API_BASE_URL}/prefetch-places`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          destination: destination, 
          interests: selectedInterests, 
          duration: duration 
        })
      })
      .then(res => res.json())
      .then(data => {
         console.log(`✨ [Shadow Fetching 완료] ${data.count}개의 장소가 서버 창고에 장전되었습니다!`);
      })
      .catch(e => {
         // 에러가 나도 앱은 터지지 않고 조용히 넘어갑니다. (나중에 진짜 클릭할 때 다시 검색하면 됨)
         console.warn("⚠️ 그림자 수집 실패 (앱 정상 작동):", e);
      });
    }
  }, [hotelData, currentStep, isPrefetched, destination, selectedInterests, duration, API_BASE_URL]);

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
        rooms: budgetInfo.rooms,
        preferredHotel: preferredHotel
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
    const summaryText = `${dates.start} ~ ${dates.end} (${travelers.adults} Adults, ${travelers.children} Kids, ${budgetInfo.rooms} Rooms)`;
    setMessages(prev => [...prev, { id: Date.now(), role: 'user', text: summaryText }]);
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
  // 🟢 1. [시작] 시간 측정 및 이벤트 전송
  const startTime = Date.now();
  trackEvent('plan_generation_started', { 
    destination: destination,
    hotel_name: hotel.name 
  });

  setSelectedHotel(hotel);
  setCurrentStep('planning');
  setIsLoading(true); 

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

    // 🛡️ 가짜 성공 방어막: 파이썬이 에러 메시지를 보냈다면 강제로 에러를 발생시킴!
    if (result.error) {
      throw new Error(result.error);
    }

    if (result.plan) {
      // 🟢 2. [성공] 걸린 시간(ms) 계산 및 성공 이벤트 전송
      const durationMs = Date.now() - startTime;
      trackEvent('plan_generation_success', { 
        destination: destination,
        time_taken_ms: durationMs,
        hotel_name: hotel.name
      });

      setPlanData(result.plan); // 파이썬이 "plan"이라는 키로 데이터를 줍니다.
      setMessages(prev => [...prev, { id: Date.now() + 2, role: 'assistant', text: "Your customized plan is ready! 👇", type: 'plan-result' }]);
      
      const firstDay = Object.keys(result.plan)[0];
      if (hotel.location) {
        updateRouteWithShield(
          { lat: hotel.location.latitude, lng: hotel.location.longitude }, 
          result.plan[firstDay]
        );
      }
    }
  } catch (error) {
    // 🔴 3. [실패] 어떤 에러인지 텍스트로 뽑아서 실패 이벤트 전송!
    const errorMsg = error instanceof Error ? error.message : "Unknown Error";
    const durationMs = Date.now() - startTime;

    trackEvent('plan_generation_failed', { 
      destination: destination,
      error_msg: errorMsg,
      time_until_failure_ms: durationMs
    });

    logError(error);
    alert("An error occurred while creating the schedule. Please try again!");
  } finally {
    setIsLoading(false);
  }
};

const [isSaving, setIsSaving] = useState(false);

  const handleSavePlan = async () => {
    if (!user) {
      alert("Please log in to save your plan! 🔒");
      setIsMyPageOpen(true);
      return;
    }
    if (!planData || !selectedHotel) {
      alert("There is no plan to save yet.");
      return;
    }

    setIsSaving(true);
    try {
      // DB에 들어갈 캡슐(문서) 포장
      const planToSave = {
        userId: user.uid,
        destination: destination,
        dates: dates,
        hotel: selectedHotel,
        dailyPlan: planData,
        createdAt: serverTimestamp(),
      };

      // 'saved_plans'라는 이름의 컬렉션(폴더)에 문서 던져넣기!
      await addDoc(collection(db, 'saved_plans'), planToSave);
      
      alert("Plan saved successfully! ✈️");
    } catch (error) {
      console.error("Error saving plan:", error);
      alert("Failed to save the plan. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

const handleLoadPlans = async () => {
    if (!user) return;
    setMyPageMode('list'); // 모달창을 '리스트 모드'로 바꿉니다!
    setIsLoadingPlans(true);
    
    try {
      // "saved_plans 폴더에서, userId가 내 uid와 똑같은 것만 찾아라!"
      const q = query(collection(db, 'saved_plans'), where("userId", "==", user.uid));
      const querySnapshot = await getDocs(q);
      
      const plans = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // 최신순으로 정렬 (에러 방지를 위해 자바스크립트 단에서 정렬)
      plans.sort((a: any, b: any) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
      
      setSavedPlans(plans);
    } catch (error) {
      console.error("Error loading plans:", error);
      alert("Failed to load saved plans.");
    } finally {
      setIsLoadingPlans(false);
    }
  };

  // 🚀 [신규 추가] 불러온 일정을 클릭했을 때 화면에 뿌려주는 함수
  const handleSelectSavedPlan = (plan: any) => {
    // 1. 기본 여행 데이터 복원
    setDestination(plan.destination);
    setDates(plan.dates);
    setSelectedHotel(plan.hotel);
    setPlanData(plan.dailyPlan);
    
    // 2. 📍 [핵심] 지도의 중심점을 숙소(Hotel) 좌표로 강제 고정하여 지도를 깨웁니다.
    if (plan.hotel?.location) {
      const coords = {
        lat: plan.hotel.location.latitude || plan.hotel.location.lat,
        lng: plan.hotel.location.longitude || plan.hotel.location.lng
      };
      setCityAnchor(coords);
    }

    // 3. 💬 [핵심] 대화창 리스트에 "일정 결과 카드"를 보여주라는 마커 메시지를 주입합니다.
    // 우리 UI는 이 메시지 타입이 'plan-result'여야 타임라인을 그립니다!
    setMessages([
      { id: 1, role: 'assistant', text: "Hello! 👋 I'm Holiday Hub.\nWhere would you like to travel?", type: 'text' },
      { id: Date.now(), role: 'assistant', text: `Successfully restored your trip to ${plan.destination}! ✨`, type: 'plan-result' }
    ]);

    // 4. 🧭 [핵심] 현재 단계를 'planning' 또는 'result'로 전환하여 상단 지도가 35vh 크기로 나타나게 만듭니다.
    setCurrentStep('planning');
    setCurrentDay('Day 1'); // 항상 1일차부터 보여주도록 초기화

    // 5. 🚗 [핵심] 구글 맵 위에 1일차 경로선(Polyline)을 그리도록 비용 방어막 함수를 호출합니다.
    const firstDayKey = Object.keys(plan.dailyPlan)[0] || "Day 1";
    if (plan.hotel?.location && plan.dailyPlan[firstDayKey]) {
      // 리액트가 상태를 반영할 아주 잠깐의 시간(100ms)을 준 뒤 경로를 그립니다.
      setTimeout(() => {
        updateRouteWithShield(
          { lat: plan.hotel.location.latitude, lng: plan.hotel.location.longitude }, 
          plan.dailyPlan[firstDayKey]
        );
      }, 100);
    }
    
    // 6. 마이페이지 팝업창을 닫고 프로필 모드로 리셋
    setIsMyPageOpen(false);
    setMyPageMode('profile');
  };

const [isSharing, setIsSharing] = useState(false);
const [isSharedLoading, setIsSharedLoading] = useState(false);

  // 1. 현재 일정을 공용 창고에 저장하고 복사 가능한 URL을 생성하는 함수
  const handleSharePlan = async () => {
    if (!planData || !selectedHotel) {
      alert("Link for share is not ready yet.");
      return;
    }

    setIsSharing(true);
    try {
      // 누구나 읽을 수 있는 공용 스냅샷 포장
      const planToShare = {
        destination,
        dates,
        hotel: selectedHotel,
        dailyPlan: planData,
        sharedAt: serverTimestamp(),
      };

      // 'public_plans' 컬렉션에 임시 문서 생성
      const docRef = await addDoc(collection(db, 'public_plans'), planToShare);
      
      // 구시대 방식(execCommand) 대신 최신 웹 표준 Clipboard API 사용!
      const shareUrl = `${window.location.origin}${window.location.pathname}?plan=${docRef.id}`;
      await navigator.clipboard.writeText(shareUrl);
      
      alert("Shared successfully! The link has been copied to your clipboard.");
    } catch (error) {
      console.error("Error sharing plan:", error);
      alert("Failed to create share link.");
    } finally {
      setIsSharing(false);
    }
  };

  // 2. 누군가 공유 링크(?plan=ID)를 타고 들어왔을 때 데이터를 복원하는 함수
  const loadSharedPlan = async (planId: string) => {
    setIsSharedLoading(true);
    try {
      // 런타임 최적화를 위해 필요한 도구만 동적 임포트 (Clean Architecture)
      const { doc, getDoc } = await import('firebase/firestore');
      const docRef = doc(db, 'public_plans', planId);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        alert("Expired or non-existent share link. 🧭");
        return;
      }

      const plan = docSnap.data();
      
      // 상태 복원 톱니바퀴 가동
      setDestination(plan.destination);
      setDates(plan.dates);
      setSelectedHotel(plan.hotel);
      setPlanData(plan.dailyPlan);
      setCurrentStep('planning');
      setCurrentDay('Day 1');

      setMessages([
        { id: 1, role: 'assistant', text: `Shared ${plan.destination} trip plan loaded successfully! 🌍`, type: 'plan-result' }
      ]);

      if (plan.hotel?.location) {
        const coords = {
          lat: plan.hotel.location.latitude || plan.hotel.location.lat,
          lng: plan.hotel.location.longitude || plan.hotel.location.lng
        };
        setCityAnchor(coords);
        setTimeout(() => {
          updateRouteWithShield(coords, plan.dailyPlan['Day 1'] || []);
        }, 300);
      }
    } catch (error) {
      console.error("Error loading shared plan:", error);
      alert("Failed to load shared plan.");
    } finally {
      setIsSharedLoading(false);
    }
  };

  useEffect(() => {
      const urlParams = new URLSearchParams(window.location.search);
      const sharedPlanId = urlParams.get('plan');
      
      // 조기 리턴(Early Return) 패턴으로 중첩 if 방지
      if (!sharedPlanId) return; 
      
      loadSharedPlan(sharedPlanId);
    }, []);
 

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

      {viewMode === 'intro' ? (
        <SplitHomepage 
          onSelectBuild={() => {
            // 🚀 [수정] 오른쪽 경로를 누르면 대화창을 건너뛰고 'build' 대시보드로 바로 보냅니다!
            setViewMode('build');
          }}
          onSelectGuess={() => {
            // 🚀 [수정] 왼쪽 경로를 누르면 기존의 대화형 AI 플래너('main')로 진입합니다!
            setViewMode('main'); 
          }}
        />
      ) : viewMode === 'build' ? (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center p-6 md:p-12 animate-fade-in text-gray-800 w-full overflow-y-auto">
          <h2 className="text-2xl md:text-3xl font-black text-gray-800 mb-8 text-center">
            Ready to book your next trip? ✈️
          </h2>
          
          <div className="w-full max-w-4xl space-y-8">
            
            {/* 🚀 1. 비행기표 위젯 (껍데기 없이 깔끔하게 컴포넌트만 호출!) */}
            <FlightWidget />

            {/* 🚀 2. 투어/액티비티 위젯 */}
            <TourWidget />

          </div>
          
          <button 
            onClick={() => setViewMode('intro')}
            className="mt-8 text-gray-400 underline text-xs font-bold hover:text-gray-600 transition-colors"
          >
            ← Back to start
          </button>
        </div>
      ) : (
        <>
          {isMyPageOpen && user && (
            <div 
              className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in"
              onClick={() => { setIsMyPageOpen(false); setMyPageMode('profile'); }}
            >
          <div 
            className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl relative overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 닫기 버튼 */}
            <button onClick={() => { setIsMyPageOpen(false); setMyPageMode('profile'); }} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 p-2 z-10">
              <i className="fas fa-times text-xl"></i>
            </button>

            {myPageMode === 'profile' ? (
              // 👤 [모드 1] 프로필 화면
              <div className="animate-fade-in">
                <div className="flex flex-col items-center mb-6 mt-4">
                  <img src={user.photoURL || ''} referrerPolicy="no-referrer" alt="Profile" className="w-20 h-20 rounded-full mb-3 shadow-md border-4 border-teal-50 bg-gray-100" />
                  <p className="font-black text-xl text-gray-800">{user.displayName}</p>
                  <p className="text-xs text-gray-500 mt-1">{user.email}</p>
                </div>

                <div className="space-y-3">
                  {/* 💡 드디어 껍데기가 아닌 진짜 함수(handleLoadPlans)를 연결했습니다! */}
                  <button onClick={handleLoadPlans} className="w-full py-3.5 bg-teal-50 text-teal-700 rounded-xl font-bold hover:bg-teal-100 transition-colors flex items-center justify-center gap-2">
                    <i className="fas fa-map-marked-alt"></i> My Saved Plans
                  </button>
                  <button onClick={() => { logout(); setIsMyPageOpen(false); }} className="w-full py-3.5 bg-gray-50 text-gray-600 rounded-xl font-bold hover:bg-red-50 hover:text-red-600 transition-colors flex items-center justify-center gap-2">
                    <i className="fas fa-sign-out-alt"></i> Sign Out
                  </button>
                </div>
              </div>
            ) : (
              // 📋 [모드 2] 저장된 리스트 화면
              <div className="animate-fade-in flex flex-col h-[60vh] max-h-[500px]">
                <div className="flex items-center mb-4">
                  <button onClick={() => setMyPageMode('profile')} className="text-gray-400 hover:text-teal-600 mr-2">
                    <i className="fas fa-chevron-left text-lg"></i>
                  </button>
                  <h3 className="font-black text-lg text-gray-800">My Saved Plans</h3>
                </div>
                
                <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
                  {isLoadingPlans ? (
                    <div className="text-center py-10 text-gray-400 font-medium">
                      <i className="fas fa-spinner fa-spin text-2xl mb-2 text-teal-500"></i>
                      <p>Loading your vault...</p>
                    </div>
                  ) : savedPlans.length === 0 ? (
                    <div className="text-center py-10 text-gray-400 font-medium">
                      <i className="fas fa-folder-open text-4xl mb-3 text-gray-300"></i>
                      <p>No saved plans yet.</p>
                    </div>
                  ) : (
                    savedPlans.map(plan => (
                      <div 
                        key={plan.id} 
                        onClick={() => handleSelectSavedPlan(plan)}
                        className="bg-gray-50 p-4 rounded-2xl border border-gray-100 hover:border-teal-300 hover:shadow-md transition-all cursor-pointer group"
                      >
                        <h4 className="font-bold text-gray-800 group-hover:text-teal-700 mb-1">{plan.destination}</h4>
                        <p className="text-xs text-gray-500 mb-2">
                          <i className="far fa-calendar-alt mr-1"></i> {plan.dates?.start || 'Unknown date'}
                        </p>
                        <span className="text-[10px] font-bold bg-white px-2 py-1 rounded-md text-teal-600 border border-teal-100 shadow-sm">
                          🏨 {plan.hotel?.name || 'No Hotel'}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
  <div className="h-screen flex flex-col bg-white overflow-hidden">
    {/* 1. 고정 헤더 */}
    <header className="bg-white px-4 py-3 border-b-2 border-teal-100 flex items-center justify-between z-50 relative">
  
  {/* 좌측 여백 (레이아웃 균형용) */}
  <div className="w-16"></div> 
  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 flex items-center justify-center">
    <img 
      src="/logo.png"
      alt="Holiday Hub Logo" 
      /* 모바일에서는 h-8, PC에서는 h-10으로 설정하여 상하 여백(숨구멍)을 줍니다 */
      className="h-10 md:h-12 w-auto object-contain cursor-pointer hover:opacity-80 transition-opacity" 
      onClick={() => window.location.reload()}
    />
  </div>

  {/* 우측 Reset 버튼 (민트 컬러 적용) */}
  <div className="flex items-center gap-4 z-10">
          {user ? (
            // 로그인 성공 시: 유저 프로필 사진이 뜹니다. 누르면 마이페이지 오픈!
            <button onClick={() => setIsMyPageOpen(true)} className="hover:opacity-80 transition-opacity">
              <img src={user.photoURL || ''} alt="Profile" className="w-8 h-8 md:w-10 md:h-10 rounded-full border-2 border-teal-200 shadow-sm" />
            </button>
          ) : (
            // 로그아웃 상태: 구글 로그인 버튼이 뜹니다.
            <button onClick={loginWithGoogle} className="text-sm font-bold text-teal-600 hover:text-teal-800 transition-colors flex items-center gap-1.5">
              <i className="fab fa-google"></i> Login
            </button>
          )}
  
  <button onClick={() => window.location.reload()} className="text-sm font-bold text-teal-600 hover:text-teal-800 z-10 transition-colors">
    Reset
  </button>
  </div>
</header>

    {/* 2. 본문 컨테이너 (지도 + 리스트) */}
    <div className="flex-1 flex flex-col overflow-hidden">
      
      {/* 🟢 상단 고정 지도 영역 (35vh 고정) */}
      {cityAnchor && (currentStep === 'hotels' || currentStep === 'planning' || currentStep === 'result') && (
  <div className="h-[35vh] w-full relative border-b shadow-sm z-20 flex-shrink-0">
    <Map
  defaultCenter={cityAnchor}
  defaultZoom={13}
  mapId="6af4c1235e0825fcd9c726f2" // AdvancedMarker를 쓰려면 반드시 유효한 Map ID가 필요합니다.
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
                  📅 Travel dates & Guests
                </h5>
                
                <div className="space-y-4">
                  {/* 1. 날짜 선택 */}
                  <div className="grid grid-cols-2 gap-2">
                    <input 
                      type="date" min={today}
                      onChange={(e) => setDates(prev => ({ ...prev, start: e.target.value }))}
                      className="p-2 border border-gray-200 rounded-lg text-sm text-gray-700 outline-none focus:border-teal-500"
                    />
                    <input 
                      type="date" min={dates.start || today}
                      onChange={(e) => setDates(prev => ({ ...prev, end: e.target.value }))}
                      className="p-2 border border-gray-200 rounded-lg text-sm text-gray-700 outline-none focus:border-teal-500"
                    />
                  </div>
                  
                  {/* 2. 인원 및 객실 선택 */}
                  <div className="space-y-3 border-t border-gray-100 pt-3">
                    {/* 성인 */}
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-bold text-gray-700">Adults</span>
                      <div className="flex items-center gap-3">
                        <button onClick={() => setTravelers(p => ({...p, adults: Math.max(1, p.adults - 1)}))} className="w-7 h-7 bg-gray-100 rounded-full font-bold text-gray-600 hover:bg-gray-200 transition-colors">-</button>
                        <span className="w-4 text-center text-sm font-bold text-gray-800">{travelers.adults}</span>
                        <button onClick={() => setTravelers(p => ({...p, adults: p.adults + 1}))} className="w-7 h-7 bg-gray-100 rounded-full font-bold text-gray-600 hover:bg-gray-200 transition-colors">+</button>
                      </div>
                    </div>
                    {/* 아이 */}
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-bold text-gray-700">Children</span>
                      <div className="flex items-center gap-3">
                        <button onClick={() => setTravelers(p => ({...p, children: Math.max(0, p.children - 1)}))} className="w-7 h-7 bg-gray-100 rounded-full font-bold text-gray-600 hover:bg-gray-200 transition-colors">-</button>
                        <span className="w-4 text-center text-sm font-bold text-gray-800">{travelers.children}</span>
                        <button onClick={() => setTravelers(p => ({...p, children: p.children + 1}))} className="w-7 h-7 bg-gray-100 rounded-full font-bold text-gray-600 hover:bg-gray-200 transition-colors">+</button>
                      </div>
                    </div>
                    {/* 방 개수 */}
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-bold text-gray-700">Rooms</span>
                      <div className="flex items-center gap-3">
                        <button onClick={() => setBudgetInfo(p => ({...p, rooms: Math.max(1, p.rooms - 1)}))} className="w-7 h-7 bg-teal-50 rounded-full font-bold text-teal-600 hover:bg-teal-100 transition-colors">-</button>
                        <span className="w-4 text-center text-sm font-bold text-gray-800">{budgetInfo.rooms}</span>
                        <button onClick={() => setBudgetInfo(p => ({...p, rooms: p.rooms + 1}))} className="w-7 h-7 bg-teal-50 rounded-full font-bold text-teal-600 hover:bg-teal-100 transition-colors">+</button>
                      </div>
                    </div>
                  </div>
                  
                  <button 
                    onClick={handleDateTravelerSubmit}
                    className="w-full bg-teal-600 text-white py-3 rounded-xl font-bold hover:bg-teal-700 transition-all shadow-sm"
                  >
                    Confirm Details
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
    <div className="mt-4 pb-4 border-b border-gray-100">
      <p className="text-[11px] font-bold text-teal-700 mb-1">
        🏨 Any specific hotel or brand? (Optional)
      </p>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">🔍</span>
        <input 
          type="text" 
          placeholder="e.g. Ibis, Marriott, Novotel..." 
          value={preferredHotel}
          onChange={(e) => setPreferredHotel(e.target.value)}
          className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-teal-500 transition-colors"
        />
      </div>
      <p className="text-[9px] text-gray-400 mt-1">
        We'll try to find the same group so you don't miss out on points!
      </p>
    </div>
    
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
            
            <div className="flex flex-wrap gap-1 mt-1.5 mb-1">
              {hotel.summary_tags?.map((tag: string, idx: number) => (
                <span key={idx} className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-[10px] font-bold border border-blue-100">
                  {tag}
                </span>
              ))}
            </div>
            
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-xs text-gray-500 font-medium">⭐️ {hotel.rating}</span>
              <span className="text-gray-300">|</span>
              <span className="text-xs text-gray-500 font-medium">💰 ${hotel.pricePerNight}/night</span>
              
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
            // 🚀 [UI 업그레이드] 텍스트가 포함된 둥근 버튼으로 변경하여 클릭률(CTR)과 편의성을 높였습니다!
            className="absolute right-3 top-3 z-10 bg-white/95 backdrop-blur-sm px-3 py-1.5 rounded-lg shadow-sm border border-gray-100 hover:bg-teal-50 hover:border-teal-200 transition-all flex items-center gap-1.5 group-hover:-translate-y-0.5"
            title="Open in Google Maps"
          >
            <span className="text-xs">📍</span>
            <span className="text-[10px] font-black text-gray-700 hover:text-teal-700">View Map</span>
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


              {/* ========================================== */}
              {/* 🚀 [수정 완료] Itinerary-to-Booking: 최종 예약 및 저장 유도 CTA */}
              {/* ========================================== */}
              {/* 1. 맨 앞의 false && 를 지워서, 박스 전체가 화면에 보이게 살려냅니다! */}
              {selectedHotel && (
                <div className="mt-8 p-6 bg-gradient-to-br from-teal-50 to-blue-50 rounded-2xl border border-teal-100 shadow-sm animate-fade-in">
                  <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                    
                    {/* 왼쪽: 요약 텍스트 */}
                    <div className="flex-1">
                      <h3 className="text-lg font-black text-gray-800 mb-2">
                        Ready to make it real? ✈️
                      </h3>
                      <p className="text-sm text-gray-600 mb-3">
                        You selected <strong className="text-teal-700">{selectedHotel?.name}</strong> as your basecamp. 
                        Lock in this perfectly optimized itinerary at the best price verified by AI.
                      </p>
                      
                      {/* 호텔 신뢰 태그 리마인드 */}
                      <div className="flex flex-wrap gap-1">
                        {selectedHotel?.summary_tags?.slice(0, 3).map((tag: string, idx: number) => (
                          <span key={idx} className="px-2 py-0.5 bg-white text-teal-700 rounded-md text-[10px] font-bold border border-teal-100">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* 오른쪽: 액션 버튼 영역 */}
                    <div className="w-full md:w-auto flex flex-col items-center gap-3">
                      
                      {/* 🛑 2. 예약 버튼에만 투명 망토(false &&)를 씌워서 숨겨둡니다. (나중에 이것만 지우면 부활!) */}
                      {(
                        <a 
                          href={selectedHotel?.affiliate_link || "#"} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          onClick={() => {
                            if (typeof window !== 'undefined' && window.gtag) {
                              window.gtag('event', 'hotel_booking_click', { hotel_name: selectedHotel?.name });
                            }
                          }}
                          className="block w-full px-8 py-4 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl shadow-md transition-transform transform hover:scale-105 text-center"
                        >
                          Check Live Price & Book
                        </a>
                      )}

                      {/* 🚀 3. 파이어베이스 저장 버튼은 항상 노출합니다. (예약 버튼의 디자인을 빌려왔습니다) */}
                      <button 
                        onClick={handleSavePlan}
                        disabled={isSaving}
                        className="block w-full px-8 py-4 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl shadow-md transition-transform transform hover:scale-105 text-center"
                      >
                        {isSaving ? "Saving to Vault..." : "💾 Save This Plan"}
                      </button>
                      <button 
                        onClick={handleSharePlan}
                        disabled={isSharing}
                        className="block w-full px-8 py-3.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl shadow-md transition-transform transform hover:scale-105 text-center flex items-center justify-center gap-2"
                      >
                        <i className="fas fa-share-alt"></i>
                        {isSharing ? "Link Generating..." : "🔗 Share This Plan"}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            

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
       </>
      )}
    </APIProvider>
  ); // return 끝
}



export default App;