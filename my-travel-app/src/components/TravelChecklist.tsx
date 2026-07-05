import React, { useState } from 'react';

// 데이터 타입 정의
type ChecklistItem = { id: string; label: string; checked: boolean; isEssential: boolean };
type ChecklistCategory = { id: string; title: string; icon: string; items: ChecklistItem[] };

// 파트너님이 기획하신 초기 데이터 세팅
const initialChecklist: ChecklistCategory[] = [
  {
    id: 'holiday_hub', title: 'Holiday Hub Essentials', icon: '⭐',
    items: [
      { id: 'hh1', label: 'Save itinerary offline', checked: false, isEssential: true },
      { id: 'hh2', label: 'Screenshot hotel address', checked: false, isEssential: true },
      { id: 'hh3', label: 'Check airport transport', checked: false, isEssential: true },
      { id: 'hh4', label: 'Share trip with travel partner', checked: false, isEssential: true },
      { id: 'hh5', label: 'Enable emergency location sharing', checked: false, isEssential: true },
    ]
  },
  {
    id: 'documents', title: 'Documents', icon: '🛂',
    items: [
      { id: 'doc1', label: 'Passport', checked: false, isEssential: true },
      { id: 'doc2', label: 'Visa (if required)', checked: false, isEssential: false },
      { id: 'doc3', label: 'Flight tickets', checked: false, isEssential: true },
      { id: 'doc4', label: 'Hotel confirmation', checked: false, isEssential: true },
      { id: 'doc5', label: 'Travel insurance', checked: false, isEssential: true },
      { id: 'doc6', label: "Driver's license (if renting a car)", checked: false, isEssential: false },
      { id: 'doc7', label: 'International Driving Permit', checked: false, isEssential: false },
      { id: 'doc8', label: 'Emergency contacts', checked: false, isEssential: true },
      { id: 'doc9', label: 'Copies of important documents', checked: false, isEssential: true },
    ]
  },
  {
    id: 'money', title: 'Money', icon: '💳',
    items: [
      { id: 'mon1', label: 'Credit / Debit card', checked: false, isEssential: true },
      { id: 'mon2', label: 'Cash (Local currency)', checked: false, isEssential: true },
      { id: 'mon3', label: 'Backup payment method', checked: false, isEssential: true },
      { id: 'mon4', label: 'Notify bank about travel (optional)', checked: false, isEssential: false },
    ]
  },
  {
    id: 'electronics', title: 'Electronics', icon: '📱',
    items: [
      { id: 'elec1', label: 'Phone', checked: false, isEssential: true },
      { id: 'elec2', label: 'Phone charger', checked: false, isEssential: true },
      { id: 'elec3', label: 'Power bank', checked: false, isEssential: true },
      { id: 'elec4', label: 'Universal travel adapter', checked: false, isEssential: true },
      { id: 'elec5', label: 'Earphones / Headphones', checked: false, isEssential: false },
      { id: 'elec6', label: 'Camera & batteries', checked: false, isEssential: false },
      { id: 'elec7', label: 'Laptop / Tablet (optional)', checked: false, isEssential: false },
    ]
  },
  {
    id: 'clothing', title: 'Clothing', icon: '👕',
    items: [
      { id: 'clo1', label: 'Underwear & Socks', checked: false, isEssential: true },
      { id: 'clo2', label: 'T-shirts & Tops', checked: false, isEssential: true },
      { id: 'clo3', label: 'Pants / Shorts', checked: false, isEssential: true },
      { id: 'clo4', label: 'Jacket', checked: false, isEssential: true },
      { id: 'clo5', label: 'Sleepwear', checked: false, isEssential: true },
      { id: 'clo6', label: 'Comfortable walking shoes', checked: false, isEssential: true },
      { id: 'clo7', label: 'Sandals (optional)', checked: false, isEssential: false },
      { id: 'clo8', label: 'Hat / Sunglasses', checked: false, isEssential: false },
    ]
  },
  {
    id: 'toiletries', title: 'Toiletries', icon: '🪥',
    items: [
      { id: 'toi1', label: 'Toothbrush & Toothpaste', checked: false, isEssential: true },
      { id: 'toi2', label: 'Shampoo & Body Wash', checked: false, isEssential: true },
      { id: 'toi3', label: 'Skincare & Sunscreen', checked: false, isEssential: true },
      { id: 'toi4', label: 'Deodorant & Razor', checked: false, isEssential: false },
      { id: 'toi5', label: 'Makeup (optional)', checked: false, isEssential: false },
    ]
  },
  {
    id: 'health', title: 'Health', icon: '💊',
    items: [
      { id: 'hea1', label: 'Prescription medication', checked: false, isEssential: true },
      { id: 'hea2', label: 'Painkillers & Band-aids', checked: false, isEssential: true },
      { id: 'hea3', label: 'Motion sickness & Allergy med', checked: false, isEssential: false },
    ]
  },
  {
    id: 'digital', title: 'Digital', icon: '📶',
    items: [
      { id: 'dig1', label: 'Offline Google Maps', checked: false, isEssential: true },
      { id: 'dig2', label: 'Offline translator', checked: false, isEssential: true },
      { id: 'dig3', label: 'eSIM / SIM card', checked: false, isEssential: true },
    ]
  },
  {
    id: 'optional', title: 'Optional', icon: '⭐',
    items: [
      { id: 'opt1', label: 'Books / Kindle', checked: false, isEssential: false },
      { id: 'opt2', label: 'Bluetooth speaker', checked: false, isEssential: false },
      { id: 'opt3', label: 'Swimsuit', checked: false, isEssential: false },
      { id: 'opt4', label: 'Gym clothes', checked: false, isEssential: false },
    ]
  }
];

export default function TravelChecklist({ onClose }: { onClose?: () => void }) {
  const [categories, setCategories] = useState<ChecklistCategory[]>(initialChecklist);
  const [expandedCats, setExpandedCats] = useState<string[]>(['holiday_hub', 'documents']);

  // 항목 토글 함수
  const toggleItem = (categoryId: string, itemId: string) => {
    setCategories(prev => prev.map(cat => {
      if (cat.id !== categoryId) return cat;
      return {
        ...cat,
        items: cat.items.map(item => item.id === itemId ? { ...item, checked: !item.checked } : item)
      };
    }));
  };

  // 아코디언 토글 함수
  const toggleCategory = (categoryId: string) => {
    setExpandedCats(prev => 
      prev.includes(categoryId) ? prev.filter(id => id !== categoryId) : [...prev, categoryId]
    );
  };

  // 🚀 핵심 기획: '필수(Essential)' 항목 기준으로만 진행률(Progress) 계산
  const allEssentials = categories.flatMap(c => c.items).filter(i => i.isEssential);
  const checkedEssentials = allEssentials.filter(i => i.checked).length;
  const progressPercentage = allEssentials.length > 0 ? Math.round((checkedEssentials / allEssentials.length) * 100) : 0;

  return (
  <div className="w-full h-full bg-white md:rounded-3xl overflow-hidden flex flex-col border border-gray-100 shadow-sm">
      
      {/* 헤더 및 진행 상태 바 */}
      <div className="p-6 border-b border-gray-100 bg-gray-50 sticky top-0 z-10">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-xl font-black text-gray-800">Preparation Check</h2>
            <p className="text-xs text-gray-500 font-medium mt-1">Focus on the essentials. The rest is optional.</p>
          </div>
          {onClose && (
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center bg-white rounded-full text-gray-400 hover:text-gray-700 shadow-sm border border-gray-200">
              <i className="fas fa-times"></i>
            </button>
          )}
        </div>
        
        {/* 진행률 표시 (Essential 기준) */}
        <div className="flex justify-between text-xs font-bold mb-2">
          <span className="text-teal-700">Ready Level</span>
          <span className="text-teal-700">{checkedEssentials} / {allEssentials.length} ({progressPercentage}%)</span>
        </div>
        <div className="w-full h-2.5 bg-gray-200 rounded-full overflow-hidden">
          <div 
            className="h-full bg-teal-500 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progressPercentage}%` }}
          ></div>
        </div>
      </div>

      {/* 카테고리 아코디언 리스트 */}
      <div className="overflow-y-auto flex-1 p-4 space-y-3 bg-white no-scrollbar">
        {categories.map((cat) => {
          const isExpanded = expandedCats.includes(cat.id);
          const checkedCount = cat.items.filter(i => i.checked).length;
          
          return (
            <div key={cat.id} className="border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
              <button 
                onClick={() => toggleCategory(cat.id)}
                className={`w-full px-5 py-4 flex items-center justify-between transition-colors ${isExpanded ? 'bg-teal-50/30' : 'bg-white hover:bg-gray-50'}`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg">{cat.icon}</span>
                  <span className="font-bold text-gray-800">{cat.title}</span>
                  <span className="text-xs font-medium text-gray-400">({checkedCount}/{cat.items.length})</span>
                </div>
                <i className={`fas fa-chevron-down text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}></i>
              </button>

              {isExpanded && (
                <div className="px-5 pb-4 pt-1 bg-white border-t border-gray-50">
                  <div className="space-y-2.5 mt-2">
                    {cat.items.map((item) => (
                      <label key={item.id} className="flex items-start gap-3 cursor-pointer group">
                        <div className="relative flex items-center mt-0.5">
                          <input 
                            type="checkbox" 
                            checked={item.checked} 
                            onChange={() => toggleItem(cat.id, item.id)} 
                            className="peer sr-only" 
                          />
                          <div className={`w-5 h-5 border-2 rounded-md transition-all flex items-center justify-center
                            ${item.checked ? 'bg-teal-600 border-teal-600' : 'border-gray-300 group-hover:border-teal-400'}`}
                          >
                            <i className={`fas fa-check text-white text-[10px] ${item.checked ? 'opacity-100' : 'opacity-0'}`}></i>
                          </div>
                        </div>
                        <div className={`flex-1 text-sm font-medium transition-colors 
                          ${item.checked ? 'text-gray-400 line-through' : 'text-gray-700'}`}
                        >
                          {item.label}
                          {!item.isEssential && (
                            <span className="ml-2 text-[10px] bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded-md no-underline inline-block">Optional</span>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}