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