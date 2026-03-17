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

# ==========================================
# 3. API 헬퍼 함수 (Helpers)
# ==========================================

def _make_api_request(url, method='get', json_data=None, headers=None, params=None):
    """API 요청 재시도 및 에러 처리 래퍼"""
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
    """Haversine Distance (km)"""
    if not loc1 or not loc2: return float('inf')
    try:
        lat1, lon1 = float(loc1['latitude']), float(loc1['longitude'])
        lat2, lon2 = float(loc2['latitude']), float(loc2['longitude'])
        R = 6371 
        dlat = math.radians(lat2 - lat1)
        dlon = math.radians(lon2 - lon1)
        a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon/2)**2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
        return R * c
    except: return float('inf')

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
    logging.info("🧠 Generating Plan (Must-Visit Anchoring + Smart Logic)...")
    try:
        # 1. 기초 데이터 수신
        hotel_loc = data.get('hotel_location')
        dest = data.get('destination')
        interests = data.get('interests', []) 
        duration = int(data.get('duration', 1))
        intensity = data.get('travelIntensity', 'moderate')
        must_visits = data.get('mustVisitPlaces', []) 
        
        # 2. 여행 강도 및 설정
        intensity_settings = {
            'relaxed': {'stops': 4, 'multiplier': 1.0},
            'moderate': {'stops': 6, 'multiplier': 0.9},
            'adventurous': {'stops': 8, 'multiplier': 0.7}
        }
        settings = intensity_settings.get(intensity, intensity_settings['moderate'])
        stops_per_day = settings['stops']
        time_multiplier = settings['multiplier']
        
        base_durations = {
            "museum": 120, "park": 60, "shopping": 90, 
            "landmark": 30, "point_of_interest": 45
        }
        fallback_activity_imgs = ["https://images.unsplash.com/photo-1523906834658-6e24ef2386f9?w=400&h=300"]

        # 3. [Must-Visit] 장소 먼저 처리 (Anchoring)
        pre_assigned_plans = {i: [] for i in range(duration)}
        seen_ids = set()
        headers = { 
            "Content-Type": "application/json", 
            "X-Goog-Api-Key": config.GOOGLE_API_KEY, 
            "X-Goog-FieldMask": "places.id,places.displayName,places.types,places.rating,places.location,places.photos" 
        }

        for mv in must_visits:
            mv_name = mv.get('name')
            try:
                raw_day = str(mv.get('day', 1)).lower().replace('day', '').strip()
                day_idx = int(raw_day) - 1
            except: day_idx = 0
            
            if day_idx < 0 or day_idx >= duration: day_idx = 0

            body = { "textQuery": f"{mv_name} in {dest}", "maxResultCount": 1 }
            res = _make_api_request(PLACES_API_URL_TEXT, method='post', json_data=body, headers=headers)
            
            if res and res.get('places'):
                p = res['places'][0]
                act_img = fallback_activity_imgs[0]
                if p.get('photos'):
                    photo_name = p['photos'][0]['name']
                    act_img = f"https://places.googleapis.com/v1/{photo_name}/media?key={config.GOOGLE_API_KEY}&maxHeightPx=400&maxWidthPx=400"

                mv_obj = {
                    "type": "Must-Visit",
                    "details": {
                        "id": p['id'], 
                        "name": p.get('displayName', {}).get('text', mv_name), 
                        "location": p['location'], 
                        "rating": p.get('rating'), 
                        "image_url": act_img, 
                        "google_map_url": f"https://www.google.com/maps/search/?api=1&query={urllib.parse.quote(mv_name)}&query_place_id={p['id']}",
                        "summary_tags": ["Must Visit"] + [t for t in p.get('types', [])][:1]
                    },
                    "travel_details": { "driving": 15, "transit": 25, "walking": 40, "stay_duration": 240 }
                }
                pre_assigned_plans[day_idx].append(mv_obj)
                seen_ids.add(p['id'])

        # 4. [주변 장소 수집] 
        # ✅ search_queries 정의가 반드시 for문보다 위에 있어야 합니다!
        search_queries = [f"must visit attractions in {dest}"]
        for i in interests:
            search_queries.append(f"best {i} in {dest}")
        
        candidates = {}
        for q in list(set(search_queries))[:8]: 
            body = { "textQuery": q, "maxResultCount": 20 }
            res = _make_api_request(PLACES_API_URL_TEXT, method='post', json_data=body, headers=headers)
            if res and res.get('places'):
                for p in res['places']:
                    # 딕셔너리를 사용하여 ID 중복을 자연스럽게 제거
                    candidates[p['id']] = p

        # 5. [데이터 가공 및 초기 정렬]
        all_places_list = list(candidates.values())
        name_counts = collections.Counter([p.get('displayName', {}).get('text', '').strip().lower() for p in all_places_list])
        local_franchise_blacklist = {name for name, count in name_counts.items() if count >= 3}
        
        filtered_list = []
        for p in all_places_list:
            p_name = p.get('displayName', {}).get('text', '').strip().lower()
            if p_name not in local_franchise_blacklist:
                filtered_list.append(p)

        # 🟢 스코어링 함수 정의 (이 위치가 가장 안전합니다)
        def get_initial_score(p):
            dist = calculate_distance(hotel_loc, p['location'])
            quality = _calculate_quality_score(p)
            relevance = _calculate_relevance_score(p, interests)
            return (100 - (dist * 20)) + quality + relevance

        filtered_list.sort(key=get_initial_score, reverse=True)
        cand_list = filtered_list

        # 6. [일정 배분] 빈 슬롯 채우기
        daily_plan = {}
        for i in range(duration):
            day_items = pre_assigned_plans[i]
            remaining_slots = max(0, stops_per_day - len(day_items))
            curr = day_items[-1]['details']['location'] if day_items else hotel_loc

            for _ in range(remaining_slots):
                if not cand_list: break
                
                # 실시간 동선 최적화 (현재 위치 기준 재정렬)
                cand_list.sort(key=lambda x: calculate_distance(curr, x['location']))
                
                selected_p = None
                for idx, candidate in enumerate(cand_list):
                    if candidate['id'] in seen_ids: continue
                    
                    # 200m 구역 거름망 (파트너의 철학)
                    dist = calculate_distance(candidate['location'], curr)
                    if dist < 1.0:
                        p_types = candidate.get('types', [])
                        big_types = ['amusement_park', 'park', 'beach', 'shopping_mall', 'natural_feature']
                        if not any(t in p_types for t in big_types):
                            continue # 너무 가까우면 다음 후보로
                    
                    selected_p = cand_list.pop(idx)
                    break
                
                if not selected_p: break 

                dt = _estimate_travel_time(curr, selected_p['location'], 'driving')
                wt = _estimate_travel_time(curr, selected_p['location'], 'walking')
                tt = _estimate_travel_time(curr, selected_p['location'], 'transit')
                
                p_type = selected_p.get('types', ['point_of_interest'])[0]
                final_duration = int(base_durations.get(p_type, 60) * time_multiplier)

                act_img = fallback_activity_imgs[0]
                if selected_p.get('photos'):
                    photo_name = selected_p['photos'][0]['name']
                    act_img = f"https://places.googleapis.com/v1/{photo_name}/media?key={config.GOOGLE_API_KEY}&maxHeightPx=400&maxWidthPx=400"
                
                p_name = selected_p.get('displayName', {}).get('text', 'Place')
                
                day_items.append({
                    "type": "Activity",
                    "details": {
                        "id": selected_p['id'], 
                        "name": p_name, 
                        "location": selected_p['location'], 
                        "rating": selected_p.get('rating'), 
                        "image_url": act_img, 
                        "google_map_url": f"https://www.google.com/maps/search/?api=1&query={urllib.parse.quote(p_name)}&query_place_id={selected_p['id']}",
                        "summary_tags": [t for t in selected_p.get('types', [])][:2]
                    },
                    "travel_details": { "driving": dt, "walking": wt, "transit": tt, "stay_duration": final_duration }
                })
                
                curr = selected_p['location']
                seen_ids.add(selected_p['id'])
                
            daily_plan[f"Day {i+1}"] = day_items
            
        return {"plan": daily_plan}

    except Exception as e:
        logging.error(f"Plan Error: {e}", exc_info=True)
        return {"error": str(e)}
   

def _calculate_bearing(loc1, loc2):
    """두 좌표간 방위각 계산"""
    lat1, lon1 = map(math.radians, [loc1['latitude'], loc1['longitude']])
    lat2, lon2 = map(math.radians, [loc2['latitude'], loc2['longitude']])
    dlon = lon2 - lon1
    x = math.sin(dlon) * math.cos(lat2)
    y = math.cos(lat1) * math.sin(lat2) - math.sin(lat1) * math.cos(lat2) * math.cos(dlon)
    return (math.degrees(math.atan2(x, y)) + 360) % 360

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
    res = generate_plan_logic(request.get_json())
    if res is None:
        return jsonify({"error": "No data returned from logic"}), 500
        
    if "error" in res:
        return jsonify(res), 500
        
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
