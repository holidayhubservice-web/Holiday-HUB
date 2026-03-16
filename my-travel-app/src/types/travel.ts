export type AccommodationType = 
  | 'HOTEL' | 'HOSTEL' | 'GUEST_HOUSE' | 'MOTEL' | 'RESORT' | 'PENSION' | 'OTHER';

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface HotelEntity {
  id: string | number;
  name: string;
  location: {
    latitude: number;
    longitude: number;
  };
  price_Per_Night: number;
  rating: number;
  image_url?: string;
  google_map_url?: string;
  type: string;
  priceLevel?: string; // 추가됨
  summary_tags?: string[]; // 추가됨
  final_score?: number; // 추가됨
}

export interface TripBudget {
  totalBudget: number;
  accommodationBudget: number;
  dailyAccommodationBudget: number;
}

export interface RecommendationResult {
  isDayTrip: boolean;
  searchAnchor: GeoPoint | null;
  budgetPlan: TripBudget | null;
  recommendedHotels: HotelEntity[];
}

// [NEW] 검색 폼 데이터 타입 (이게 없어서 오류남)
export interface SearchParams {
  destination: string;
  startDate: string; // 날짜는 string (YYYY-MM-DD)으로 관리하는게 편합니다
  endDate: string;
  totalBudget: number;
  interests: string[];
  travelers: {
    adults: number;
    children: number;
  };
  rooms: number;
}