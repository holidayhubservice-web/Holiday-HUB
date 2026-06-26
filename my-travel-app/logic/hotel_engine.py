import logging
import random
import urllib.parse
import config

def _generate_affiliate_link(hotel_name, destination):
    if not hotel_name:
        return "#"
    search_query = urllib.parse.quote_plus(f"{hotel_name} {destination}")
    klook_search_url = f"https://www.klook.com/ko/hotels/search-result/?keyword={search_query}"
    return klook_search_url

def _get_price_level_from_budget(target_nightly_price):
    if target_nightly_price < 80: return 'PRICE_LEVEL_INEXPENSIVE'
    if target_nightly_price < 200: return 'PRICE_LEVEL_MODERATE'
    if target_nightly_price < 400: return 'PRICE_LEVEL_EXPENSIVE'
    return 'PRICE_LEVEL_VERY_EXPENSIVE'

def _estimate_price_from_level(price_level):
    base_price = {
        'PRICE_LEVEL_INEXPENSIVE': 80, 
        'PRICE_LEVEL_MODERATE': 150, 
        'PRICE_LEVEL_EXPENSIVE': 300, 
        'PRICE_LEVEL_VERY_EXPENSIVE': 500
    }.get(price_level, 120)
    variance = int(base_price * 0.2)
    return base_price + random.randint(-variance, variance)

def find_hotels_logic(data):
    from app import ( _get_city_center, _get_anchor_points, _make_api_request, PLACES_API_URL_TEXT, _generate_hotel_summary_tags, calculate_distance )
    
    logging.info("🏨 Finding Hotels (Clean Architecture Mode)...")
    dest = data.get('destination')
    interests = data.get('interests', [])
    total_budget = float(data.get('budget', 2000))
    duration = int(data.get('duration', 3))
    
    # 🚀 [신규 추가] 프론트엔드에서 보낸 선호 호텔 텍스트 받기
    preferred_hotel = data.get('preferredHotel', '').strip()
    
    target_price = (total_budget * 0.25) / max(1, duration - 1)
    center = _get_city_center(dest)
    
    headers = { 
        "Content-Type": "application/json", 
        "X-Goog-Api-Key": config.GOOGLE_API_KEY, 
        "X-Goog-FieldMask": "places.id,places.displayName,places.rating,places.priceLevel,places.location,places.types,places.photos" 
    }
    
    # 🚀 [로직 변경] 유저가 선호 브랜드를 적었으면 무조건 그걸 1순위 검색어로 씁니다!
    if preferred_hotel:
        query_term = f"best {preferred_hotel} hotels and resorts"
        logging.info(f"🎯 [Brand Search] Target: {query_term} in {dest}")
    else:
        # 기존 예산별 검색 로직 유지
        if target_price < 80: query_term = "best hostels and cheap guesthouses"
        elif target_price < 150: query_term = "affordable 3-star hotels and serviced apartments"
        elif target_price < 300: query_term = "highly rated 4-star hotels"
        else: query_term = "best luxury 5-star hotels and resorts"
    
    body = { 
        "textQuery": f"{query_term} in {dest}",
        "maxResultCount": 20, 
        "locationBias": { "circle": { "center": center, "radius": 15000.0 } } 
    }
    
    res = _make_api_request(PLACES_API_URL_TEXT, method='post', json_data=body, headers=headers)
    
    seen_ids = set()
    output = []
    
    fallback_images = [
        "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=600&h=400&fit=crop",
        "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=600&h=400&fit=crop"
    ]

    if res and res.get('places'):
        for idx, p in enumerate(res['places']):
            if p['id'] in seen_ids:
                continue
                
            if p.get('location'):
                dist_from_center = calculate_distance(center, p['location'])
                if dist_from_center > 15.0:
                    logging.info(f"🚫 [바리케이드 작동] {dist_from_center:.1f}km 떨어져 있어 제외: {p.get('displayName', {}).get('text')}")
                    continue

            p_level = p.get('priceLevel', 'PRICE_LEVEL_MODERATE')
            level_avg = _estimate_price_from_level(p_level)
            final_price = level_avg 
            if abs(level_avg - target_price) < 100: 
                final_price = target_price + random.uniform(-20, 20)
            
            img = fallback_images[idx % len(fallback_images)]
            if p.get('photos'):
                photo_name = p['photos'][0]['name']
                img = f"https://places.googleapis.com/v1/{photo_name}/media?key={config.GOOGLE_API_KEY}&maxHeightPx=400&maxWidthPx=600"

            hotel_name = p.get('displayName', {}).get('text', 'Hotel')
            enc_name = urllib.parse.quote(hotel_name)
            
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
                "summary_tags": _generate_hotel_summary_tags(p),
                "affiliate_link": _generate_affiliate_link(hotel_name, dest)
            }
            
            output.append(hotel)
            seen_ids.add(p['id'])
            
    # 🚨 [가장 중요한 변화] 5개로 자르지 않고, 20개 전부를 리액트로 쏴줍니다!
    # 이제 리액트의 hotelLogic.ts가 이 20개를 받아 요리할 것입니다.
    return {"hotels": output}