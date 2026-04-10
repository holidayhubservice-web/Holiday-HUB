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
import config
import collections

# ==========================================
# 1. 앱 설정 (App Config)
# ==========================================
app = Flask(__name__, static_folder='static', template_folder='templates')

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


DAILY_API_LIMIT = 200  # 하루 전체 호출 제한
USER_DAILY_LIMIT = 50   # 사용자당 생성 제한
api_call_count = 0     # 오늘 총 호출 횟수
user_usage = {}        # 사용자별 호출 기록 { 'IP': count }
last_reset_date = datetime.now().date()

def check_api_budget():
    global api_call_count, last_reset_date, user_usage
    current_date = datetime.now().date()
    if current_date > last_reset_date:
        api_call_count = 0
        user_usage = {}
        last_reset_date = current_date
    
    if api_call_count >= DAILY_API_LIMIT:
        return False, "오늘의 서비스 에너지가 모두 소진되었습니다. 내일 다시 와주세요!"
    
    user_ip = request.remote_addr
    if user_usage.get(user_ip, 0) >= USER_DAILY_LIMIT:
        return False, "오늘의 생성 한도를 초과했습니다. 내일 더 멋진 계획을 세워봐요!"
    return True, "OK"

def log_api_cost(api_name, cost_usd):
    global api_call_count
    api_call_count += 1
    user_ip = request.remote_addr
    user_usage[user_ip] = user_usage.get(user_ip, 0) + 1
    logging.info(f"💰 [COST] {api_name} | ${cost_usd} | Total: {api_call_count}/{DAILY_API_LIMIT}")
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

def _estimate_travel_time(origin, dest, mode='driving'):
    """구글 경로 API를 통해 실시간 이동 시간을 가져옵니다."""
    if not origin or not dest: return 15 # 기본값
    
    try:
        origin_str = f"{origin['latitude']},{origin['longitude']}"
        dest_str = f"{dest['latitude']},{dest['longitude']}"
        
        # 🟢 대중교통은 출발 시간이 있어야 정확한 데이터가 나옵니다.
        now = int(time.time()) 
        
        params = {
            "origin": origin_str,
            "destination": dest_str,
            "mode": mode, # 'driving', 'walking', 'transit' 수용
            "key": config.GOOGLE_API_KEY
        }
        
        # 대중교통 모드일 때만 출발 시간 추가
        if mode == 'transit':
            params['departure_time'] = now

        data = _make_api_request(DIRECTIONS_API_URL, params=params)
        
        if data and data.get('routes'):
            # API 응답에서 초(seconds) 단위 시간을 가져와 분(minutes)으로 변환
            seconds = data['routes'][0]['legs'][0].get('duration', {}).get('value')
            return round(seconds / 60) if seconds else 20
            
    except Exception as e:
        logging.warning(f"⚠️ Route API error ({mode}): {e}")
        
    # API 실패 시 기존의 거리 기반 추산으로 보강 (Fallback)
    return _estimate_travel_time_fallback(origin, dest, mode)

# ==========================================
# 4. 고급 스코어링 로직 (Brain Restored)
# ==========================================

def _get_anchor_points(destination_text, interests):
    """[복구] 단순 도시 중심뿐 아니라, 관심사별 핫스팟 좌표를 계산"""
    anchors = {}
    city = _get_city_center(destination_text)
    if city: anchors['city_center'] = city
    
    # 예: 'shopping in Tokyo'의 중심점 찾기
    hotspot_map = { "shopping": "shopping district", "art & culture": "art district", "active_vibe": "nightlife area" }
    for i in interests:
        if i in hotspot_map:
            loc = _get_city_center(f"{hotspot_map[i]} in {destination_text}")
            if loc: anchors[i] = loc
    return anchors

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
    """API 실패 시 거리 기반 추산"""
    dist = calculate_distance(loc1, loc2)
    if mode == 'walking': return round((dist / 4.0) * 60 + 5)
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

def _calculate_context_score_for_hotels(hotel, anchor_points, user_interests):
    """[복구] 호텔이 주요 스팟들과 얼마나 가까운지 분석"""
    if not anchor_points or 'location' not in hotel: return 0
    
    score = 0
    min_dist = float('inf')
    
    # 1. 도시 중심과의 거리
    if 'city_center' in anchor_points:
        d = calculate_distance(hotel['location'], anchor_points['city_center'])
        if d < 2.0: score += 20
        elif d < 5.0: score += 10
        
    # 2. 관심사 지역과의 거리 (이게 중요!)
    for interest in user_interests:
        if interest in anchor_points:
            d = calculate_distance(hotel['location'], anchor_points[interest])
            if d < 1.5: 
                score += 30 # 관심 지역 바로 옆이면 초강력 추천
                hotel['matched_interest_tag'] = f"📍 Near {interest} district"
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

def _generate_hotel_summary_tags(hotel):
    """[복구] 호텔 특징 태그 생성기"""
    tags = []
    if hotel.get('rating', 0) >= 4.5: tags.append("⭐ Top Rated")
    if hotel.get('matched_interest_tag'): tags.append(hotel['matched_interest_tag'])
    
    price = hotel.get('priceLevel')
    price_map = {"PRICE_LEVEL_INEXPENSIVE": "💲 Budget", "PRICE_LEVEL_MODERATE": "💲💲 Value", "PRICE_LEVEL_EXPENSIVE": "💲💲💲 Luxury"}
    if price in price_map: tags.append(price_map[price])
    
    return tags[:2]

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

def _get_price_level_from_budget(target_nightly_price):
    """목표 1박 가격에 맞는 구글 Price Level을 반환"""
    if target_nightly_price < 80: return 'PRICE_LEVEL_INEXPENSIVE'
    if target_nightly_price < 200: return 'PRICE_LEVEL_MODERATE'
    if target_nightly_price < 400: return 'PRICE_LEVEL_EXPENSIVE'
    return 'PRICE_LEVEL_VERY_EXPENSIVE'

def _estimate_price_from_level(price_level):
    """구글 Price Level -> 현실적 달러 가격 변환 (랜덤성 포함)"""
    base_price = {
        'PRICE_LEVEL_INEXPENSIVE': 80, 
        'PRICE_LEVEL_MODERATE': 150, 
        'PRICE_LEVEL_EXPENSIVE': 300, 
        'PRICE_LEVEL_VERY_EXPENSIVE': 500
    }.get(price_level, 120)
    
    # ±20% 랜덤 변동
    variance = int(base_price * 0.2)
    return base_price + random.randint(-variance, variance)

def find_hotels_logic(data):
    logging.info("🏨 Finding Hotels (Fixed Body Error)...")
    dest = data.get('destination')
    interests = data.get('interests', [])
    
    # 1. 예산 및 타겟 가격 계산
    total_budget = float(data.get('budget', 2000))
    duration = int(data.get('duration', 3))
    target_price = (total_budget * 0.25) / max(1, duration - 1)
    
    center = _get_city_center(dest)
    anchors = _get_anchor_points(dest, interests)
    
    headers = { 
        "Content-Type": "application/json", 
        "X-Goog-Api-Key": config.GOOGLE_API_KEY, 
        "X-Goog-FieldMask": "places.id,places.displayName,places.rating,places.priceLevel,places.location,places.types,places.photos" 
    }
    
    # [수정 포인트] body 정의가 API 요청보다 '반드시' 위에 있어야 합니다!
    # 쿼리 전략: 예산이 $100 미만이면 'hostel', 아니면 'hotel' 검색
    query_term = "hostel" if target_price < 100 else "hotel"
    
    body = { 
        "textQuery": f"best {query_term} in {dest}",
        "maxResultCount": 20, 
        "locationBias": { "circle": { "center": center, "radius": 10000.0 } } 
    }
    
    # API 요청 (이제 body가 위에 있으니 에러가 안 납니다)
    res = _make_api_request(PLACES_API_URL_TEXT, method='post', json_data=body, headers=headers)
    
    # 중복 제거를 위한 ID 저장소
    seen_ids = set()
    output = []
    
    fallback_images = [
        "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=600&h=400&fit=crop",
        "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=600&h=400&fit=crop",
        "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=600&h=400&fit=crop"
    ]

    if res and res.get('places'):
        for idx, p in enumerate(res['places']):
            # 중복 체크
            if p['id'] in seen_ids:
                continue
                
            # 가격 계산
            p_level = p.get('priceLevel', 'PRICE_LEVEL_MODERATE')
            level_avg = _estimate_price_from_level(p_level)
            final_price = level_avg 
            if abs(level_avg - target_price) < 100: 
                final_price = target_price + random.uniform(-20, 20)
            
            # 이미지 처리
            img = fallback_images[idx % len(fallback_images)]
            if p.get('photos'):
                photo_name = p['photos'][0]['name']
                img = f"https://places.googleapis.com/v1/{photo_name}/media?key={config.GOOGLE_API_KEY}&maxHeightPx=400&maxWidthPx=600"

            # 데이터 조립
            hotel_name = p.get('displayName', {}).get('text', 'Hotel')
            enc_name = urllib.parse.quote(hotel_name)
            
            # 가격 레벨 기호화
            price_symbol = {
                "PRICE_LEVEL_INEXPENSIVE": "$",
                "PRICE_LEVEL_MODERATE": "$$",
                "PRICE_LEVEL_EXPENSIVE": "$$$",
                "PRICE_LEVEL_VERY_EXPENSIVE": "$$$$"
            }.get(p_level, "$$")

            hotel = {
                "id": p['id'],
                "name": hotel_name,
                "type": "HOTEL",
                "pricePerNight": int(final_price),
                "priceLevelSymbol": price_symbol,
                "rating": p.get('rating', 0),
                "location": p.get('location'),
                "image_url": img,
                "google_map_url": f"https://www.google.com/maps/search/?api=1&query={enc_name}&query_place_id={p['id']}",
                "summary_tags": _generate_hotel_summary_tags(p)
            }
            
            output.append(hotel)
            seen_ids.add(p['id'])
            
    output.sort(key=lambda x: x.get('rating', 0), reverse=True)
    return {"hotels": output[:5]}
   
    

def generate_plan_logic(data):
    # 🚨 [입구] 데이터 수신 및 예산 체크
    logging.info(f"📡 [INCOMING DATA]: {data}")
    is_ok, msg = check_api_budget()
    if not is_ok: return {"error": msg}

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

        # 🚀 [교정 1: headers 최상단 배치] 데이터가 꼬여 삭제된 headers를 복구하고 맨 위로 올립니다.
        headers = { 
            "Content-Type": "application/json", 
            "X-Goog-Api-Key": config.GOOGLE_API_KEY, 
            "X-Goog-FieldMask": "places.id,places.displayName,places.types,places.rating,places.location,places.photos,places.userRatingCount" 
        }

        # [설정] 여행 강도 및 소요 시간
        intensity_settings = {
            'relaxed': {'stops': 4, 'multiplier': 1.0},
            'moderate': {'stops': 6, 'multiplier': 0.9},
            'adventurous': {'stops': 8, 'multiplier': 0.7}
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
        search_queries = [f"top attractions in {dest}"] + [f"best {i} in {dest}" for i in interests[:3]]
        candidates = {}
        for q in list(set(search_queries)): 
            res = _make_api_request(PLACES_API_URL_TEXT, method='post', json_data={ "textQuery": q, "maxResultCount": 20 }, headers=headers)
            if res and res.get('places'):
                for p in res['places']: candidates[p['id']] = p

        # 🚀 [여기서부터 새로 추가된 로직!] 2차 로컬 검색 (Progressive Expansion)
        target_places_count = (duration * stops_per_day) + 10 # 11일 * 6곳 = 66 + 10 = 76곳 목표
        
        if len(candidates) < target_places_count:
            logging.warning(f"🚨 장소 긴급 보충 시작! ({len(candidates)}/{target_places_count})")
            # 'best' 꼬리표를 뗀 보편적인 로컬 키워드 투입
            backup_queries = [
                f"popular local cafes in {dest}", 
                f"parks and nature in {dest}", 
                f"shopping malls in {dest}"
            ]
            for q in backup_queries:
                res = _make_api_request(PLACES_API_URL_TEXT, method='post', json_data={ "textQuery": q, "maxResultCount": 20 }, headers=headers)
                if res and res.get('places'):
                    for p in res['places']: candidates[p['id']] = p

        # 5. [데이터 가공 및 정렬]
        all_places_list = list(candidates.values())
        
        # 🛑 스코어링 함수 (함수 내부에서 hotel_loc 등을 안전하게 참조)
        def get_combined_score(p):
            try:
                p_loc = p.get('location')
                if not p_loc or not hotel_loc: return 0
                dist = calculate_distance(hotel_loc, p_loc)
                d_score = max(0, 100 - (dist * 15))
                return d_score + _calculate_quality_score(p) + _calculate_relevance_score(p, interests)
            except: return 0

        # 🛑 [수정됨] 유연한 필터 적용: dest 대신 target_places_count를 넘겨줍니다.
        smart_list = filter_and_score_places(all_places_list, target_places_count)
        
        # [최종 후보 확정 - 로직 단순화]
        source = smart_list if smart_list else all_places_list
        cand_list = sorted(source, key=get_combined_score, reverse=True)

        logging.info(f"✅ DEBUG: cand_list 정렬 완료 ({len(cand_list)}개)")

        # 6. [일정 배분 루프]
        daily_plan = {}
        sectors = ["NE", "SE", "SW", "NW"] # 하루에 하나씩 쓸 구역 조각들

        for i in range(duration):
            day_items = pre_assigned_plans.get(i, [])
            remaining_slots = max(0, stops_per_day - len(day_items))
            curr = hotel_loc
            
            # 오늘의 타겟 구역 지정 (예: 1일차 북동, 2일차 남동...)
            target_sector = sectors[i % len(sectors)] 

            # 🛑 1. 오늘 목표 구역에 있는 장소만 먼저 추려냅니다.
            sector_candidates = [
                c for c in cand_list 
                if c.get('location') and _get_sector(_calculate_bearing(hotel_loc, c['location'])) == target_sector
            ]
            
            # 🛑 2. 만약 해당 구역에 장소가 모자라면 전체 후보(cand_list)를 씁니다. (방패 로직)
            current_pool = sector_candidates if len(sector_candidates) >= remaining_slots else cand_list

            for _ in range(remaining_slots):
                if not current_pool: break
                
                # 전체 리스트(cand_list) 대신 오늘의 구역(current_pool) 안에서 거리를 잽니다.
                current_pool.sort(key=lambda x: calculate_distance(curr, x.get('location')))
                
                selected_p = None
                for idx, candidate in enumerate(current_pool):
                    c_id = candidate.get('id')
                    if not c_id or c_id in seen_ids: continue
                    
                    # 너무 가까운 장소 중복 방지 (1km)
                    if calculate_distance(candidate.get('location'), curr) < 1.0 and _ > 0: continue
                    
                    selected_p = current_pool.pop(idx)
                    break
                
                if not selected_p: break 
                
                p_name = selected_p.get('displayName', {}).get('text', 'Place')
                day_items.append({
                    "type": "Activity",
                    "details": {
                        "id": selected_p.get('id'), "name": p_name, "location": selected_p.get('location'),
                        "rating": selected_p.get('rating', 0),
                        "image_url": f"https://places.googleapis.com/v1/{selected_p['photos'][0]['name']}/media?key={config.GOOGLE_API_KEY}&maxHeightPx=400" if selected_p.get('photos') else fallback_activity_imgs[0],
                        "google_map_url": f"https://www.google.com/maps/search/?api=1&query={urllib.parse.quote(p_name)}&query_place_id={selected_p.get('id')}",
                        "summary_tags": [t for t in selected_p.get('types', []) if t != 'point_of_interest'][:2]
                    },
                    "travel_details": { 
                        "driving": _estimate_travel_time_fallback(curr, selected_p.get('location'), 'driving'), 
                        "walking": _estimate_travel_time_fallback(curr, selected_p.get('location'), 'walking'), 
                        "transit": _estimate_travel_time_fallback(curr, selected_p.get('location'), 'transit'), 
                        "stay_duration": 90 
                    }
                })
                seen_ids.add(selected_p.get('id'))
                curr = selected_p.get('location')
            
            daily_plan[f"Day {i+1}"] = day_items

        # 🚀 묵음을 깨는 최종 리턴 (try 블록 내부)
        return {"plan": daily_plan}

    except Exception as e:
        # 🛡️ 어떤 오류가 나도 여기서 잡아서 터미널에 뿌립니다.
        logging.critical(f"❌ CRITICAL PLAN ERROR: {str(e)}", exc_info=True)
        return {"error": f"일정 생성 중 오류 발생: {str(e)}"}

def _calculate_bearing(loc1, loc2):
    """두 좌표간 방위각 계산"""
    lat1, lon1 = map(math.radians, [loc1['latitude'], loc1['longitude']])
    lat2, lon2 = map(math.radians, [loc2['latitude'], loc2['longitude']])
    dlon = lon2 - lon1
    x = math.sin(dlon) * math.cos(lat2)
    y = math.cos(lat1) * math.sin(lat2) - math.sin(lat1) * math.cos(lat2) * math.cos(dlon)
    return (math.degrees(math.atan2(x, y)) + 360) % 360

def _get_sector(bearing):
    """방위각을 4개의 구역(NE, SE, SW, NW)으로 나눕니다."""
    if 0 <= bearing < 90: return "NE"
    if 90 <= bearing < 180: return "SE"
    if 180 <= bearing < 270: return "SW"
    return "NW"

# ==========================================
# 6. 라우트 (Routes)
# ==========================================
@app.route('/')
def home(): return render_template('index.html')

@app.route('/find-hotels', methods=['POST'])
def find_hotels_route(): 
    return jsonify(find_hotels_logic(request.get_json()))

@app.route('/create-plan', methods=['POST'])
def create_plan_route():
    data = request.get_json()
    res = generate_plan_logic(data)
    if res is None:
        return jsonify({"error": "No data returned"}), 500
        
    if "error" in res:
        # 500이 아니라 400으로 줘야 서버가 죽은 것과 구분됩니다.
        return jsonify(res), 400 
        
    return jsonify({"status": "success", "daily_plan": res.get("plan")})

@app.route('/autocomplete', methods=['GET'])
def autocomplete_proxy():
    # 1. 변수 정의를 가장 먼저!
    q = request.args.get('query')
    search_type = request.args.get('type', 'place') # 기본값 'place' 설정
    lat = request.args.get('lat')
    lng = request.args.get('lng')
    token = request.args.get('session_token')

    # 2. 그 다음에 디버그 출력 (이제 에러 안 남)
    print(f"--- DEBUG START ---")
    print(f"Query: {q}, Type: {search_type}")

    if not q: return jsonify({"status": "error"}), 400

    params = {
        "input": q,
        "key": config.GOOGLE_API_KEY,
        "language": "en",
    }

    # 3. 도시/장소 분기 로직
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
    return jsonify(res)
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

if __name__ == '__main__':
    app.run(host="0.0.0.0", port=5001, debug=True)
