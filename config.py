# config.py
import logging
import os
from dotenv import load_dotenv # 1. 사서를 가장 먼저 출근시킵니다!

# 2. 금고의 정확한 주소를 만듭니다. (안쪽 my-travel-app 폴더)
env_path = os.path.join(os.path.dirname(__file__), 'my-travel-app', '.env')

# 3. 사서에게 정확한 주소를 쥐여주고 금고를 열게 합니다.
load_dotenv(dotenv_path=env_path)

# 4. 금고 안에서 내용물(키)을 꺼냅니다.
GOOGLE_API_KEY = os.getenv("VITE_GOOGLE_MAPS_API_KEY")
GETYOURGUIDE_API_KEY = os.getenv("GETYOURGUIDE_API_KEY")
WEATHER_API_KEY = os.getenv("WEATHER_API_KEY")

# 5. 에러 핸들링 (조기 반환)
if not GOOGLE_API_KEY:
    logging.error("🚨 환경 변수 에러: VITE_GOOGLE_MAPS_API_KEY가 없습니다! .env 파일의 위치와 이름을 확인하세요.")
    raise ValueError("Google API Key is missing")