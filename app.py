import json
import time
import math
import random
import urllib.parse
import logging
import requests
import redis
from datetime import datetime, timedelta
from flask import Flask, request, jsonify, render_template
from flask_cors import CORS 
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address # 
from flask_limiter.errors import RateLimitExceeded # 
import config
import collections
import random
import sys
import os


# 🌉 [다리 연결] app.py가 'my-travel-app' 폴더 안쪽을 들여다볼 수 있게 길을 뚫어줍니다.
sys.path.append(os.path.join(os.path.dirname(__file__), 'my-travel-app'))

# 🚀 이제 정상적으로 신형 엔진을 불러올 수 있습니다!
from logic.hotel_engine import find_hotels_logic

# ==========================================
# 1. 앱 설정 (App Config)
# ==========================================
app = Flask(__name__, static_folder='static', template_folder='templates')

redis_uri = os.environ.get("REDIS_URL", "memory://")

limiter = Limiter(
    get_remote_address, # 유저의 IP를 기준으로 카운트합니다.
    app=app,
    storage_uri=redis_uri,
    # 파트너의 설계: "유저당 하루 100번까지만! (그리고 과부하 방지를 위해 1분에 10번까지만)"
    default_limits=["100 per day", "10 per minute"] 
)

@app.after_request
def add_cors_headers(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Goog-Api-Key, X-Goog-FieldMask'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS, PUT, DELETE'
    return response

# CORS: 개발 편의성을 위해 모든 Origin 허용
CORS(app, resources={r"/*": {"origins": [

"https://holidayhubservice.com",

"https://www.holidayhubservice.com",

"http://localhost:5173", # Vite 기본 포트

"http://127.0.0.1:5173",

"http://localhost:5001",   # 백엔드 자체 (가끔 필요)

"http://localhost:3000"

]}})

# 캐시 제어
app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0
@app.after_request
def add_header(response):
    response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, post-check=0, pre-check=0, max-age=0'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '-1'
    return response

# 로깅
logging.basicConfig(level=logging.INFO, format='[%(asctime)s] %(levelname)s: %(message)s', datefmt='%H:%M:%S')

# Redis
try:
    redis_client = redis.Redis(host='localhost', port=6379, db=0, decode_responses=True)
    redis_client.ping()
    logging.info("✅ Successfully connected to Redis.")
except Exception:
    logging.warning("⚠️ Redis connection failed. Running without cache.")
    redis_client = None

# ==========================================
# 2. 상수 (Constants)
# ==========================================
PLACES_API_URL_TEXT = "https://places.googleapis.com/v1/places:searchText"
PLACE_DETAILS_API_URL = "https://places.googleapis.com/v1/places/"
GEOCODE_API_URL = "https://maps.googleapis.com/maps/api/geocode/json"
DIRECTIONS_API_URL = "https://maps.googleapis.com/maps/api/directions/json"
AUTOCOMPLETE_API_URL = "https://maps.googleapis.com/maps/api/place/autocomplete/json"

# 활동별 소요 시간 (분)
ACTIVITY_DURATION_MAP = { 
    "tourist_attraction": 120, "museum": 150, "park": 90, "art_gallery": 150, 
    "historic_site": 120, "shopping_mall": 180, "zoo": 180, "beach": 120, 
    "natural_feature": 240, "restaurant": 90, "cafe": 60, "bar": 120, 
    "default": 90 
}

# 관심사별 매핑 (Hotspots)
INTEREST_MAP = { 
    "art & culture": ["art_gallery", "museum"], 
    "history": ["historic_site", "museum"], 
    "shopping": ["shopping_mall", "store"], 
    "active_vibe": ["bar", "night_club", "amusement_park"],
    "nature": ["park", "natural_feature", "beach"]
}
SHADOW_CACHE = {}

def log_api_cost(api_name, cost):
    """로그용 API 비용 기록 함수"""
    try:
        logging.info(f"🔌 API Cost: {api_name} cost={cost}")
    except Exception:
        pass

@app.errorhandler(RateLimitExceeded)
def handle_rate_limit_exceeded(e):
    error_message = "Over limit of the day! Please try again tomorrow."
    
    if "minute" in str(e.description):
        error_message = "Too many requests in a short time! Please slow down and try again in a minute."
        
    logging.warning(f"⚠️ [Rate Limit Blocked] 유저 IP: {request.remote_addr} 차단됨.")
    
    response = jsonify({
        "status": "rejected",
        "error": "Rate Limit Exceeded",
        "message": error_message
    })
    
    # 🚀 2. 핵심: 에러가 나도 브라우저가 튕겨내지 못하도록 CORS 허가증을 강제로 붙입니다!
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Goog-Api-Key'
    
    return response, 429
# ==========================================
# 3. API 헬퍼 함수 (Helpers)
# ==========================================

def _make_api_request(url, method='get', json_data=None, headers=None, params=None):
    """API 요청 재시도 및 에러 처리 래퍼"""
    api_name = url.split('/')[-1] or "Google API"
    cost = 0.032 if "directions" in url or "places" in url else 0.005
    log_api_cost(api_name, cost)
    
    for attempt in range(3):


        try:
            if method.lower() == 'post':
                response = requests.post(url, json=json_data, headers=headers, params=params, timeout=10)
            else:
                response = requests.get(url, params=params, headers=headers, timeout=10)
            
            # 4xx 에러는 재시도하지 않음
            if 400 <= response.status_code < 500:
                logging.warning(f"⛔ Client Error {response.status_code} at {url}")
                return None
                
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            logging.warning(f"⚠️ Attempt {attempt+1} failed: {e}")
            time.sleep(1)
    return None 

def calculate_distance(loc1, loc2):
    """Haversine Distance (km) - 유연한 키 체크 및 에러 방지"""
    # 1. 데이터 부재 시 500 에러 방지
    if not loc1 or not loc2: return 999.0
    try:
        # Front(lat)와 API(latitude) 어떤 키값이 와도 대응하는 코드
        lat1 = float(loc1.get('latitude') or loc1.get('lat', 0))
        lon1 = float(loc1.get('longitude') or loc1.get('lng', 0))
        lat2 = float(loc2.get('latitude') or loc2.get('lat', 0))
        lon2 = float(loc2.get('longitude') or loc2.get('lng', 0))
        
        if lat1 == 0 or lat2 == 0: return 999.0

        R = 6371 
        dlat = math.radians(lat2 - lat1)
        dlon = math.radians(lon2 - lon1)
        a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon/2)**2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
        return R * c
    except Exception as e:
        logging.warning(f"📏 거리 계산 스킵: {e}")
        return 999.0


def _get_city_center(destination_text):
    params = {"address": destination_text, "key": config.GOOGLE_API_KEY}
    data = _make_api_request(GEOCODE_API_URL, method='get', params=params)
    if data and data.get('results'):
        location = data['results'][0]['geometry']['location']
        return {'latitude': location['lat'], 'longitude': location['lng']}
    
    # [복구] Fallback 좌표 (개발용)
    logging.warning(f"⚠️ Geocoding Fallback for: {destination_text}")
    text = destination_text.lower()
    if 'seoul' in text: return {'latitude': 37.5665, 'longitude': 126.9780}
    if 'tokyo' in text: return {'latitude': 35.6762, 'longitude': 139.6503}
    if 'adelaide' in text: return {'latitude': -34.9285, 'longitude': 138.6007}
    return {'latitude': 37.5665, 'longitude': 126.9780}



def _get_directions(origin, destination, mode='driving'):
    """[복구] 실제 구글 경로 API 호출"""
    if not origin or not destination: return None
    try:
        origin_str = f"{origin['latitude']},{origin['longitude']}"
        dest_str = f"{destination['latitude']},{destination['longitude']}"
        params = { "origin": origin_str, "destination": dest_str, "mode": mode, "key": config.GOOGLE_API_KEY }
        data = _make_api_request(DIRECTIONS_API_URL, params=params)
        if data and data.get('routes'):
            val = data['routes'][0]['legs'][0].get('duration', {}).get('value')
            return val / 60.0 if val else None
    except: pass
    return None

def _get_place_details(place_id):
    if not place_id: return None
    cache_key = f"place_details_v10:{place_id}"
    
    if redis_client and redis_client.exists(cache_key):
        return json.loads(redis_client.get(cache_key))
        
    url = f"{PLACE_DETAILS_API_URL}{place_id}"
    headers = { 
        "Content-Type": "application/json", 
        "X-Goog-Api-Key": config.GOOGLE_API_KEY, 
        "X-Goog-FieldMask": "id,displayName,types,rating,userRatingCount,location,priceLevel,formattedAddress,photos" 
    }
    response = _make_api_request(url, method='get', headers=headers)
    if response:
        # 이미지 URL 생성
        photo = response.get('photos', [{}])[0].get('name')
        response['image_url'] = f"https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference={photo.split('/')[-1]}&key={config.GOOGLE_API_KEY}" if photo else None
        
        if redis_client: redis_client.setex(cache_key, 86400 * 7, json.dumps(response))
        return response
    return None

def _get_anchor_points(destination_text, interests):
    anchors = {}
    city = _get_city_center(destination_text)
    if city: anchors['city_center'] = city

    hotspot_map = { "shopping": "shopping district", "art & culture": "art district", "active_vibe": "nightlife area" }
    for i in interests:
        if i in hotspot_map:
            loc = _get_city_center(f"{hotspot_map[i]} in {destination_text}")
            if loc: anchors[i] = loc
    return anchors

def _calculate_context_score_for_hotels(hotel, anchor_points, user_interests):
    if not anchor_points or 'location' not in hotel: return 0
    score = 0
    
    if 'city_center' in anchor_points:
        d = calculate_distance(hotel['location'], anchor_points['city_center'])
        if d < 2.0: score += 20
        elif d < 5.0: score += 10
        
    for interest in user_interests:
        if interest in anchor_points:
            d = calculate_distance(hotel['location'], anchor_points[interest])
            if d < 1.5: score += 20
    return score

def _generate_hotel_summary_tags(hotel):
    tags = []
    if hotel.get('rating', 0) >= 4.5: tags.append("⭐ Top Rated")
    if hotel.get('matched_interest_tag'): tags.append(hotel['matched_interest_tag'])
    
    price = hotel.get('priceLevel')
    price_map = {
        "PRICE_LEVEL_INEXPENSIVE": "💲 Budget", 
        "PRICE_LEVEL_MODERATE": "💲💲 Value", 
        "PRICE_LEVEL_EXPENSIVE": "💲💲💲 Premium", 
        "PRICE_LEVEL_VERY_EXPENSIVE": "💲💲💲💲 Luxury"
    }
    if price in price_map: tags.append(price_map[price])
    
    return tags[:2]

# ==========================================
# 4. 고급 스코어링 로직 (Brain Restored)
# ==========================================



def _calculate_quality_score(place):
    """리뷰 수와 평점을 조합한 품질 점수"""
    rating = place.get('rating', 3.0)
    count = place.get('userRatingCount', 1)
    return rating * math.log10(count + 1) * 2

def filter_and_score_places(places, target_count):
    """목표 개수를 채울 때까지 필터 기준을 점진적으로 완화합니다."""
    # 1. 최고급 필터 (리뷰 50개, 평점 4.0 이상)
    qualified = [p for p in places if p.get('userRatingCount', 0) >= 50 and p.get('rating', 0) >= 4.0]
    
    # 2. 1차 완화 (목표치 미달 시)
    if len(qualified) < target_count:
        logging.warning(f"⚠️ [필터 1차 완화] 최고급 장소 부족. (현재: {len(qualified)}/{target_count})")
        qualified = [p for p in places if p.get('userRatingCount', 0) >= 20 and p.get('rating', 0) >= 3.8]
        
    # 3. 2차 완화 (동네 맛집, 작은 카페 허용)
    if len(qualified) < target_count:
        logging.warning(f"⚠️ [필터 2차 완화] 기준 대폭 하향. (현재: {len(qualified)}/{target_count})")
        qualified = [p for p in places if p.get('userRatingCount', 0) >= 5 and p.get('rating', 0) >= 3.5]
        
    # 4. 최후의 보루 (모든 장소 영끌)
    if len(qualified) < target_count:
        logging.warning("⚠️ [필터 완전 해제] 검색된 모든 장소를 동원합니다.")
        qualified = places
        
    return qualified

def _estimate_travel_time_fallback(loc1, loc2, mode):
    """API 비용 0원! 하버사인 거리를 기반으로 한 현실적인 이동 시간 수학적 추산"""
    if not loc1 or not loc2:
        return 0
        
    # app.py에 있는 calculate_distance 함수 재활용
    dist = calculate_distance(loc1, loc2) 
    
    if mode == 'walking': 
        # 도보: 시속 4km + 신호등 대기 5분
        return round((dist / 4.0) * 60 + 5)
    elif mode == 'transit': 
        # 대중교통: 시속 15km + 정류장 대기/도보 10분
        return round((dist / 15.0) * 60 + 10)
    else: 
        # 차량(driving): 시속 30km (도심 기준) + 주차/승하차 10분
        return round((dist / 30.0) * 60 + 10)

def _calculate_relevance_score(place, user_interests):
    """[복구] 장소 타입과 유저 관심사 매칭 점수"""
    score = 0
    types = place.get('types', [])
    for interest in user_interests:
        if interest in INTEREST_MAP:
            if any(t in INTEREST_MAP[interest] for t in types):
                score += 30 # 매칭 시 큰 가산점
    return score


def _is_safe_time_for_type(place_types, current_hour):
    """
    현재 시간(0~24)에 방문하기 적절한 장소인지 판단합니다.
    """
    h = int(current_hour)
    
    # 심야 (22시 ~ 04시): 숙소나 술집/카지노만 허용
    if h >= 22 or h < 4:
        if any(t in place_types for t in ['bar', 'night_club', 'casino', 'lodging']): return True
        return False
        
    # 아침 (06시 ~ 10시): 술집, 쇼핑몰, 박물관 등은 보통 문을 닫음
    if 6 <= h < 10:
        if any(t in place_types for t in ['bar', 'night_club', 'shopping_mall', 'museum', 'art_gallery', 'amusement_park']): return False
        return True
        
    # 그 외 주간 시간대: 술집/나이트클럽은 추천 제외 (낮술 방지)
    if 10 <= h < 17:
        if any(t in place_types for t in ['bar', 'night_club']): return False
        return True
        
    return True



# ==========================================
# 5. 비즈니스 로직 (Controllers)
# ==========================================

def _apply_dietary_filter(types, user_prefs):
    """[복구] 식이요법 필터"""
    queries = []
    # 기본 쿼리
    queries.extend([f"best {t}" for t in types])
    
    # 식습관 반영 (예: Vegan)
    diet = user_prefs.get('dietary_restrictions')
    if diet:
        queries.extend([f"best {diet} {t}" for t in types if t in ['restaurant', 'cafe', 'food']])
    return queries

# app.py 내부


def generate_plan_logic(data):
    
    # 🚨 [입구] 데이터 수신 및 예산 체크
    logging.info(f"📡 [INCOMING DATA]: {data}")
    
    try:
        # 기초 데이터 추출
        hotel_loc = data.get('hotel_location')
        dest = data.get('destination', 'Unknown')
        duration = int(data.get('duration', 1))
        interests = data.get('interests', [])
        must_visits = data.get('mustVisitPlaces', [])
        intensity = data.get('travelIntensity', 'moderate')

        if not hotel_loc:
            return {"error": "호텔 위치 정보가 없습니다."}
        if duration > 31 or duration < 1:
            logging.warning(f"⚠️ [비정상 요청 감지] 기간 초과: {duration}일")
            return {"error": "여행 기간은 1일에서 최대 31일까지만 계획할 수 있습니다."}
        # 🚀 [교정 1: headers 최상단 배치] 데이터가 꼬여 삭제된 headers를 복구하고 맨 위로 올립니다.
        headers = { 
            "Content-Type": "application/json", 
            "X-Goog-Api-Key": config.GOOGLE_API_KEY, 
            "X-Goog-FieldMask": "places.id,places.displayName,places.types,places.rating,places.location,places.photos,places.userRatingCount" 
        }

        # [설정] 여행 강도 및 소요 시간
        intensity_settings = {
            'relaxed': {'stops': 4, 'multiplier': 1.0},
            'moderate': {'stops': 5, 'multiplier': 0.9},
            'adventurous': {'stops': 7, 'multiplier': 0.7}
        }
        settings = intensity_settings.get(intensity, intensity_settings['moderate'])
        stops_per_day, time_multiplier = settings['stops'], settings['multiplier']
        base_durations = {"museum": 120, "park": 60, "shopping": 90, "landmark": 30, "point_of_interest": 45}
        fallback_activity_imgs = ["https://images.unsplash.com/photo-1523906834658-6e24ef2386f9?w=400&h=300"]

        # 3. [Must-Visit 처리] - Anchoring
        pre_assigned_plans = {i: [] for i in range(duration)}
        seen_ids = set()

        for mv in must_visits:
            mv_name = mv.get('name')
            if not mv_name: continue
            
            # day 데이터 안전 처리 (image_3.png의 끊긴 로직 복구)
            try:
                day_idx = int(str(mv.get('day', 1)).lower().replace('day', '').strip()) - 1
            except: day_idx = 0
            if day_idx < 0 or day_idx >= duration: day_idx = 0

            # headers가 위에 정의되어 있어 이제 에러가 나지 않습니다.
            res = _make_api_request(PLACES_API_URL_TEXT, method='post', 
                                   json_data={ "textQuery": f"{mv_name} in {dest}", "maxResultCount": 1 }, 
                                   headers=headers)
            
            if res and res.get('places'):
                p = res['places'][0]
                p_id = p.get('id')
                
                # 이미지 경로 방어
                act_img = fallback_activity_imgs[0]
                if p.get('photos'):
                    act_img = f"https://places.googleapis.com/v1/{p['photos'][0]['name']}/media?key={config.GOOGLE_API_KEY}&maxHeightPx=400"

                pre_assigned_plans[day_idx].append({
                    "type": "Must-Visit",
                    "details": {
                        "id": p_id, "name": p.get('displayName', {}).get('text', mv_name), 
                        "location": p.get('location'), "rating": p.get('rating', 0), "image_url": act_img,
                        "google_map_url": f"https://www.google.com/maps/search/?api=1&query={urllib.parse.quote(mv_name)}&query_place_id={p_id}",
                        "summary_tags": ["Must Visit"] + [t for t in p.get('types', [])][:1]
                    },
                    "travel_details": { "driving": 15, "transit": 25, "walking": 40, "stay_duration": 240 }
                })
                seen_ids.add(p_id)

        # 4. [주변 장소 수집]
        candidates = {}
        
        # [목표치 설정] 억지로 많이 찾지 않습니다. 유저 일정(duration * stops_per_day) + 딱 5개의 여유분(Buffer)만 목표로 합니다.
        target_places_count = (duration * stops_per_day) + 5 

        interests_key = ",".join(interests)
        cache_key = f"{dest}_{interests_key}_v2"
        
        global SHADOW_CACHE
        if cache_key in SHADOW_CACHE and SHADOW_CACHE[cache_key]:
            logging.info(f"⚡ [Shadow Cache Hit!] 유저가 고민하는 동안 준비한 {len(SHADOW_CACHE[cache_key])}개의 장소 0.1초 즉시 로드!")
            # 창고에 있는 데이터를 그대로 복사해서 가져옵니다
            candidates = SHADOW_CACHE[cache_key].copy()
        else:
            logging.info("🐢 [Cache Miss] 창고가 비어있어 실시간 수집을 시작합니다.")
        
        # ---------------------------------------------------------
        # [Step 1] 핵심 닻(Anchor) 쿼리: 가장 먼저 20개를 긁어옵니다.
        # ---------------------------------------------------------
        combined_interests = ", ".join(interests[:3])
        primary_query = f"top attractions, {combined_interests} in {dest}" if combined_interests else f"top tourist attractions in {dest}"
        
        logging.info(f"🔎 [Step 1: Primary Query]: {primary_query}")
        res = _make_api_request(PLACES_API_URL_TEXT, method='post', 
                                json_data={ "textQuery": primary_query, "maxResultCount": 20 }, 
                                headers=headers)
        if res and res.get('places'):
            for p in res['places']: candidates[p['id']] = p

        # ---------------------------------------------------------
        # [Step 2] 1차 백업 쿼리: Step 1만으로 '황금비율(목표치)'을 못 채웠을 때만 지갑을 엽니다.
        # ---------------------------------------------------------
        if len(candidates) < target_places_count:
            logging.info(f"⚖️ [Step 2 발동] 장소 추가 확보 필요 ({len(candidates)}/{target_places_count})")
            
            backup_query = f"popular local cafes, beautiful parks, and shopping malls in {dest}"
            res2 = _make_api_request(PLACES_API_URL_TEXT, method='post', 
                                     json_data={ "textQuery": backup_query, "maxResultCount": 20 }, 
                                     headers=headers)
            if res2 and res2.get('places'):
                for p in res2['places']: candidates[p['id']] = p

        # ---------------------------------------------------------
        # [Step 3] 장기 여행(5일+) 부스터: 그래도 모자랄 때만 최후의 지갑을 엽니다.
        # ---------------------------------------------------------
        if duration >= 5 and len(candidates) < target_places_count:
            logging.info(f"🚀 [Step 3 발동] 장기 여행 부스터 가동 ({len(candidates)}/{target_places_count})")
            
            long_trip_query = f"hidden gems, local markets, museums, and historical sites in {dest}"
            res3 = _make_api_request(PLACES_API_URL_TEXT, method='post', 
                                     json_data={ "textQuery": long_trip_query, "maxResultCount": 20 }, 
                                     headers=headers)
            if res3 and res3.get('places'):
                for p in res3['places']: candidates[p['id']] = p

        logging.info(f"✨ [황금비율 수집 완료] 최종 확보된 고유 장소: {len(candidates)}개 (목표: {target_places_count}개)")

# =========================================================
        # 🩹 [복구 완료] 5. [데이터 가공 및 정렬] 
        # =========================================================
        all_places_list = list(candidates.values())
        
        # 🛑 스코어링 함수 (거리가 가깝고, 평점이 높고, 관심사에 맞는 곳 가산점)
        def get_combined_score(p):
            try:
                p_loc = p.get('location')
                if not p_loc or not hotel_loc: return 0
                dist = calculate_distance(hotel_loc, p_loc)
                d_score = max(0, 100 - (dist * 15))
                return d_score + _calculate_quality_score(p) + _calculate_relevance_score(p, interests)
            except: return 0

        # 유연한 필터 적용
        actual_needed_slots = duration * stops_per_day
        smart_list = filter_and_score_places(all_places_list, actual_needed_slots)

        # [최종 후보 확정] 필터를 통과한 애들을 점수순으로 정렬해서 'cand_list'를 만듭니다!
        source = smart_list if smart_list else all_places_list
        cand_list = sorted(source, key=get_combined_score, reverse=True)

        logging.info(f"✅ DEBUG: cand_list 정렬 완료 ({len(cand_list)}개)")
        # =========================================================

        # 6. [일정 배분 루프] 
        daily_plan = {}
        
        # [방어 1] 변수들 초기화
        seen_ids = set() 
        fallback_img = "https://images.unsplash.com/photo-1523906834658-6e24ef2386f9?w=400&h=300"
        stops_per_day = 5 
        
        # [방어 2] 내장형 거리 계산기
        def _safe_dist(l1, l2):
            if not l1 or not l2: return 999.0
            lat1, lng1 = l1.get('latitude', l1.get('lat', 0)), l1.get('longitude', l1.get('lng', 0))
            lat2, lng2 = l2.get('latitude', l2.get('lat', 0)), l2.get('longitude', l2.get('lng', 0))
            return ((lat1 - lat2)**2 + (lng1 - lng2)**2) ** 0.5 * 111.0 

        # 🚀 [여기가 핵심입니다!] 
        # 위쪽의 daily_plan, def _safe_dist와 세로줄이 완벽하게 맞아야 합니다. (들여쓰기 8칸)
        available_pool = [c for c in cand_list if c.get('location') is not None]

        for i in range(duration):
            day_items = pre_assigned_plans.get(i, [])
            day_items = pre_assigned_plans.get(i, [])
            is_first_day = (i == 0)
            is_last_day = (i == duration - 1)
            
            # 🟢 [수미상관 1] 하루의 시작: 첫날은 체크인, 그 외는 호텔 출발
            if is_first_day and not day_items:
                day_items.append({
                    "type": "Must-Visit",
                    "details": {
                        "id": "hotel_checkin", 
                        "name": "🏨 Check in and keep Luggage",
                        "location": hotel_loc, 
                        "rating": 5.0,
                        "image_url": fallback_img,
                        "google_map_url": "", 
                        "summary_tags": ["Hotel", "Start"]
                    },
                    "travel_details": { "stay_duration": 60, "driving": 0, "walking": 0, "transit": 0 }
                })

            current_stops_limit = max(2, stops_per_day - 2) if (is_first_day or is_last_day) else stops_per_day
            remaining_slots = max(0, current_stops_limit - len(day_items))
            curr = hotel_loc 
            
            # 닻(Seed) 내리기
            if is_first_day or is_last_day:
                daily_seed = hotel_loc
            else:
                if available_pool:
                    available_pool.sort(key=lambda x: _safe_dist(hotel_loc, x.get('location')), reverse=True)
                    daily_seed = available_pool[0].get('location')
                else:
                    daily_seed = hotel_loc

            for step in range(remaining_slots):
                if not available_pool: break
                
                available_pool.sort(key=lambda x: _safe_dist(curr, x.get('location')) + (_safe_dist(daily_seed, x.get('location')) * 0.5))
                
                selected_p = None
                for idx, candidate in enumerate(available_pool):
                    c_id = candidate.get('id')
                    c_loc = candidate.get('location')
                    
                    if not c_id or c_id in seen_ids or not c_loc: continue
                    
                    # 🛡️ [방어막 로직 작동] 오늘 방문하는 '모든' 장소 반경 400m 이내 접근 금지!
                    is_blocked_by_shield = False
                    for planned_item in day_items:
                        planned_loc = planned_item['details'].get('location')
                        if planned_loc and _safe_dist(c_loc, planned_loc) < 0.4:
                            is_blocked_by_shield = True
                            break # 방어막에 부딪히면 즉시 검사 중단
                            
                    if is_blocked_by_shield:
                        continue # 이 장소는 버리고 다음 후보로 넘어갑니다!

                    # 첫/막날 2km 제한
                    if (is_first_day or is_last_day) and _safe_dist(c_loc, hotel_loc) > 2.0:
                        continue

                    # 시간대 필터
                    try:
                        estimated_hour = 10 + (len(day_items) * 2) 
                        c_types = candidate.get('types', [])
                        if not _is_safe_time_for_type(c_types, estimated_hour):
                            continue
                    except:
                        pass 

                    selected_p = available_pool.pop(idx)
                    break
                
                if not selected_p: break 
                
                try:
                    p_name = selected_p.get('displayName', {}).get('text', 'Place')
                    c_types = selected_p.get('types', [])
                    is_mv = (selected_p.get('type') == 'Must-Visit' or is_first_day) 
                    allocated_stay = _calculate_stay_duration_backend(c_types, intensity, is_must_visit=is_mv)

                    day_items.append({
                        "type": "Activity",
                        "details": {
                            "id": selected_p.get('id'), 
                            "name": p_name, 
                            "location": selected_p.get('location'),
                            "rating": selected_p.get('rating', 0),
                            "image_url": f"https://places.googleapis.com/v1/{selected_p['photos'][0]['name']}/media?key={config.GOOGLE_API_KEY}&maxHeightPx=400" if selected_p.get('photos') else fallback_img,
                            "google_map_url": f"https://www.google.com/maps/search/?api=1&query={urllib.parse.quote(p_name)}&query_place_id={selected_p.get('id')}",
                            "summary_tags": [t for t in c_types if t != 'point_of_interest'][:2]
                        },
                        "travel_details": {
                            "driving": _estimate_travel_time_fallback(curr, selected_p.get('location'), 'driving'), 
                            "walking": _estimate_travel_time_fallback(curr, selected_p.get('location'), 'walking'), 
                            "transit": _estimate_travel_time_fallback(curr, selected_p.get('location'), 'transit'), 
                            "stay_duration": allocated_stay 
                        }
                    })
                    seen_ids.add(selected_p.get('id'))
                    curr = selected_p.get('location')

                except Exception as e:
                    logging.warning(f"⚠️ 장소 파싱 실패: {str(e)}")
                    continue
            
            # 🟢 [수미상관 2] 하루의 끝: 일정표의 마지막에 호텔 복귀를 강제로 박아 넣습니다.
            day_items.append({
                "type": "Return",
                "details": {
                    "id": f"hotel_return_day_{i+1}", 
                    "name": "🏨 Return to Hotel and Rest",
                    "location": hotel_loc, 
                    "rating": 5.0,
                    "image_url": fallback_img,
                    "google_map_url": "", 
                    "summary_tags": ["Hotel", "Rest"]
                },
                "travel_details": {
                    "driving": _estimate_travel_time_fallback(curr, hotel_loc, 'driving'), 
                    "walking": _estimate_travel_time_fallback(curr, hotel_loc, 'walking'), 
                    "transit": _estimate_travel_time_fallback(curr, hotel_loc, 'transit'), 
                    "stay_duration": 0 
                }
            }) # 🚨 [범인 검거] 바로 이 '})' 괄호가 빠져있었을 확률이 높습니다!
            
            daily_plan[f"Day {i+1}"] = day_items

        # for 루프가 끝난 뒤의 올바른 리턴
    except Exception as e:
        logging.error(f"❌ [generate_plan_logic Error]: {e}")
        return {"error": "Internal error generating plan."}
    return {"plan": daily_plan}


def _calculate_stay_duration_backend(place_types, intensity, is_must_visit):
    """
    [Clean Architecture] 프론트엔드 src/utils/travelLogic.ts의 
    calculateStayDuration 공식을 백엔드 엔진에 100% 동기화합니다.
    """
    # 1. 카테고리별 기본 체류 시간 (단위: 분)
    base_durations = {
        'restaurant': 90, 'food': 90,
        'cafe': 60, 'coffee': 60,
        'park': 60, 'nature': 60,
        'museum': 125, 'art_gallery': 120,
        'shopping_mall': 120, 'store': 60,
        'default': 90
    }
    
    # 2. 강도별 설정 정의 (파트너의 설계 반영)
    intensity_multipliers = {
        'relaxed': 1.0,
        'moderate': 0.85,
        'active': 0.7
    }
    
    # 카테고리 매칭
    base = base_durations['default']
    if place_types:
        for t in place_types:
            if t in base_durations:
                base = base_durations[t]
                break
                
    # 배율 적용
    intensity_multiplier = intensity_multipliers.get(intensity, 0.85)
    landmark_multiplier = 3.0 if is_must_visit else 1.0
    
    # 파트너의 공식 그대로 계산 후 반올림
    return round(base * intensity_multiplier * landmark_multiplier)

# ==========================================
# 6. 라우트 (Routes)
# ==========================================
@app.route('/')
def home(): return render_template('index.html')

@app.route('/find-hotels', methods=['POST'])
def find_hotels_route(): 
    return jsonify(find_hotels_logic(request.get_json()))

@app.route('/create-plan', methods=['POST'])
@limiter.limit("10 per minute")
def create_plan_route():
    data = request.get_json()
    res = generate_plan_logic(data)

    if res is None:
        return jsonify({"error": "No data returned"}), 500
        
    if "error" in res:
        # 500이 아니라 400으로 줘야 서버가 죽은 것과 구분됩니다.
        return jsonify(res), 400 
        
    return jsonify(res)

@app.route('/autocomplete', methods=['GET'])
def autocomplete_proxy():
    # 🚀 1. 함수 시작과 동시에 try 블록으로 전체 로직을 감싸줍니다.
    try:
        q = request.args.get('query')
        search_type = request.args.get('type', 'place')
        lat = request.args.get('lat')
        lng = request.args.get('lng')
        token = request.args.get('session_token')

        print(f"--- DEBUG START ---")
        print(f"Query: {q}, Type: {search_type}")

        if not q: return jsonify({"status": "error"}), 400

        params = {
            "input": q,
            # 💡 의심 포인트 1: 이 키값을 렌더에서 잘 가져오고 있는지 확인해야 합니다.
            "key": config.GOOGLE_API_KEY, 
            "language": "en",
        }

        if search_type == 'city':
            params['types'] = '(cities)'
        else:
            params['types'] = 'establishment'
            if lat and lng:
                params['location'] = f"{lat},{lng}"
                params['radius'] = "50000"
                params['strictbounds'] = "true"

        if token: params['sessiontoken'] = token

        print(f"Final Params: {params}")
        res = _make_api_request(AUTOCOMPLETE_API_URL, params=params)
        print(f"--- DEBUG END ---")
        
        # 💡 의심 포인트 2: res가 이미 dict인지, 응답 객체인지 확인하고 안전하게 반환합니다.
        if hasattr(res, 'json') and callable(res.json):
            return jsonify(res.json())
        return jsonify(res)

    # 🚀 2. 기존 코드 마지막에 아래의 예외 처리(catch) 로직을 새로 삽입합니다.
    except Exception as e:
        # 에러가 나도 서버가 죽지 않고, 프론트엔드로 정확한 에러 원인을 JSON으로 보냅니다.
        import traceback
        error_msg = str(e)
        print(f"❌ Autocomplete Backend Error: {error_msg}")
        print(traceback.format_exc()) # 렌더 로그에 상세 에러 추적 내역을 남깁니다.
        return jsonify({"status": "error", "message": error_msg}), 500
@app.route('/place-details') # 👈 맨 앞줄에 딱 붙이세요!
def get_place_details():     # 👈 맨 앞줄에 딱 붙이세요!
    place_id = request.args.get('place_id') # 👈 여기서부터 한 칸(Tab) 들여쓰기
    
    url = f"https://maps.googleapis.com/maps/api/place/details/json"
    
    params = {
        "place_id": place_id,
        "fields": "geometry",
        "key": config.GOOGLE_API_KEY, # config.GOOGLE_API_KEY 확인!
        "language": "en"
    }

    try:
        response = requests.get(url, params=params)
        return jsonify(response.json())
    except Exception as e:
        return jsonify({"error": str(e)}), 500
@app.route('/api/get_place_details', methods=['GET'])
def place_details_proxy():
    place_id = request.args.get('place_id')
    res = _get_place_details(place_id)
    if res: return jsonify({"status": "OK", "result": res})
    return jsonify({"status": "error"}), 500

# 👻 [복구 완벽 위치] app.run() 위로 안전하게 이사 온 그림자 수집 라우트
@app.route('/prefetch-places', methods=['POST', 'OPTIONS'])
def prefetch_places_route():
    # 1. 정찰병(OPTIONS) 출입 허가
    if request.method == 'OPTIONS':
        response = jsonify({})
        response.headers.add('Access-Control-Allow-Origin', '*') 
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type, X-Goog-Api-Key, X-Goog-FieldMask')
        response.headers.add('Access-Control-Allow-Methods', 'POST, OPTIONS')
        return response, 200

    # 2. 본 요청(POST) 시작
    try:
        data = request.get_json()
        dest = data.get('destination')
        interests = data.get('interests', [])
        interests_key = ",".join(interests) 
        duration = int(data.get('duration', 3))
        
        stops_per_day = 5 
        target_places_count = (duration * stops_per_day) + 5
        cache_key = f"{dest}_{interests_key}_v2"
        
        global SHADOW_CACHE 
        if cache_key in SHADOW_CACHE and len(SHADOW_CACHE[cache_key]) >= target_places_count:
            response = jsonify({"status": "already pre-fetched", "count": len(SHADOW_CACHE[cache_key])})
            response.headers.add('Access-Control-Allow-Origin', '*')
            return response, 200
            
        logging.info(f"🕵️‍♂️ [Adaptive Shadow Fetching] 백그라운드 수집 시작 (목표: {target_places_count}개)")
        
        headers = { 
            "Content-Type": "application/json", 
            "X-Goog-Api-Key": config.GOOGLE_API_KEY, 
            "X-Goog-FieldMask": "places.id,places.displayName,places.types,places.rating,places.location,places.photos,places.userRatingCount,places.regularOpeningHours,places.businessStatus" 
        }
        
        candidates = {}
        
        combined_interests = ", ".join(interests[:3])
        primary_query = f"top attractions, {combined_interests} in {dest}" if combined_interests else f"top tourist attractions in {dest}"
        res1 = _make_api_request(PLACES_API_URL_TEXT, method='post', json_data={ "textQuery": primary_query, "maxResultCount": 20 }, headers=headers)
        if res1 and res1.get('places'):
            for p in res1['places']: 
                if p.get('businessStatus') != 'CLOSED_PERMANENTLY': candidates[p['id']] = p
                
        if len(candidates) < target_places_count:
            backup_query = f"popular local cafes, beautiful parks, and shopping malls in {dest}"
            res2 = _make_api_request(PLACES_API_URL_TEXT, method='post', json_data={ "textQuery": backup_query, "maxResultCount": 20 }, headers=headers)
            if res2 and res2.get('places'):
                for p in res2['places']: 
                    if p.get('businessStatus') != 'CLOSED_PERMANENTLY': candidates[p['id']] = p

        if duration >= 5 and len(candidates) < target_places_count:
            long_trip_query = f"hidden gems, local markets, museums, and historical sites in {dest}"
            res3 = _make_api_request(PLACES_API_URL_TEXT, method='post', json_data={ "textQuery": long_trip_query, "maxResultCount": 20 }, headers=headers)
            if res3 and res3.get('places'):
                for p in res3['places']: 
                    if p.get('businessStatus') != 'CLOSED_PERMANENTLY': candidates[p['id']] = p

        SHADOW_CACHE[cache_key] = candidates
        logging.info(f"✨ [Shadow Fetching 완료] {len(candidates)}개의 신선한 장소 장전 완료!")
        
        response = jsonify({"status": "success", "count": len(candidates)})
        response.headers.add('Access-Control-Allow-Origin', '*')
        return response, 200

    except Exception as e:
        logging.error(f"❌ [Shadow Fetching Error]: {str(e)}")
        response = jsonify({"status": "error", "message": "Background fetch failed gracefully"})
        response.headers.add('Access-Control-Allow-Origin', '*')
        return response, 500

# 🚀 반드시 파일의 '맨 마지막'에 위치해야 하는 실행 코드!
if __name__ == '__main__':
    print("🚀 [SYSTEM] 파트너가 수정한 최신 파일이 실행되었습니다!!!")
    app.run(host="0.0.0.0", port=5001, debug=True)