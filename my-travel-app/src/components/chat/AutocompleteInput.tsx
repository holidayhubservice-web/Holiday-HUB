import { useState, useEffect } from 'react';

interface Props {
  onSelect: (value: any) => void;
  placeholder?: string;
  // [추가된 부분] 이 줄들이 있어야 빨간 줄이 사라집니다!
  searchType?: 'city' | 'place'; 
  locationBias?: { lat: number; lng: number } | null;
}

export default function AutocompleteInput({ onSelect, placeholder, locationBias, searchType }: Props) {
  const [input, setInput] = useState('');
  const [predictions, setPredictions] = useState<any[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);

  // 1. [교정] useEffect 로직: 여기서만 API를 호출합니다.
  useEffect(() => {
    const loadPredictions = async () => {
      if (input.length < 2) {
        setPredictions([]);
        setShowDropdown(false);
        return;
      }

      try {
        // [중요] 5001번 포트 백엔드로 고정
        const url = `http://localhost:5001/autocomplete?query=${encodeURIComponent(input)}` + 
                    `&type=${searchType || 'place'}` + // city 인지 place 인지 전달
                    (locationBias ? `&lat=${locationBias.lat}&lng=${locationBias.lng}` : "");

        const response = await fetch(url);
        const data = await response.json();

        if (data.predictions) {
          setPredictions(data.predictions);
          setShowDropdown(true);
        }
      } catch (err) {
        console.error("Autocomplete failed:", err);
      }
    };

    const timeoutId = setTimeout(loadPredictions, 300); // 디바운싱
    return () => clearTimeout(timeoutId);
  }, [input, locationBias, searchType]);

  // 2. [수정] handleInputChange: 이제 fetch 로직을 다 지우고 input 상태만 업데이트합니다.
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  };

const handleSelect = (place: any) => {
  setInput(place.description);
  setShowDropdown(false);
  onSelect({ 
    description: place.description, 
    place_id: place.place_id 
  });
};

  // 3. [유지] handleSelect: 부모(App.tsx)에게 정보를 넘겨줍니다.
  const handleManualSubmit = () => {
  if (predictions.length > 0) {
    // 이제 handleSelect가 위에 선언되어 있으므로 안전하게 호출 가능합니다!
    handleSelect(predictions[0]);
    return;
  }
  if (!input.trim()) return;
  onSelect({ description: input });
  setShowDropdown(false);
  setInput('');
};
  return (
    <div className="relative w-full">
      
      {/* [수정 1] 드롭다운을 위로 띄우기 (bottom-full mb-2) */}
      {showDropdown && predictions.length > 0 && (
        <div className="absolute bottom-full mb-2 left-0 right-0 bg-white rounded-xl shadow-xl border border-gray-100 z-[9999] overflow-hidden animate-fade-in-up max-h-60 overflow-y-auto">
          {predictions.map((p) => (
            <div 
              key={p.place_id} 
              onClick={() => handleSelect(p)}
              className="px-4 py-3 hover:bg-blue-50 cursor-pointer border-b border-gray-50 last:border-none transition-colors flex items-center gap-3"
            >
              <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 text-xs flex-shrink-0">
                📍
              </div>
              <span className="text-sm text-gray-700 font-medium truncate">{p.description}</span>
            </div>
          ))}
          <div className="bg-gray-50 px-3 py-1 text-[10px] text-gray-400 text-right">
            powered by Google
          </div>
        </div>
      )}

      <div className="flex items-center bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 shadow-sm focus-within:ring-2 focus-within:ring-blue-500 focus-within:bg-white transition-all">
        <span className="text-gray-400 mr-3">🔍</span>
        <input 
          type="text" 
          value={input}
          onChange={handleInputChange}
          onKeyDown={(e) => e.key === 'Enter' && handleManualSubmit()}
          placeholder={placeholder || "Search destination..."}
          className="bg-transparent border-none outline-none w-full text-gray-700 placeholder-gray-400 font-medium"
        />
        <button 
          onClick={handleManualSubmit}
          className={`ml-2 p-2 rounded-full transition-colors ${input.trim() ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-200 text-gray-400'}`}
        >
          ➤
        </button>
      </div>
    </div>
  );
}