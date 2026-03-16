window.initializeAppLogic = function(db, auth, userId, appId) {
    console.log(`🚀 Initializing Holiday Hub App Logic v9.3.0! (Dynamic Focus) (AppID: ${appId})`);
    const firestoreDb = db; const firebaseAuth = auth; let currentUserId = userId; const currentAppId = appId;
    const [tempMustVisitName, setTempMustVisitName] = useState<string | null>(null); // 장소 이름 임시 저장
    const [isAskDayMode, setIsAskDayMode] = useState(false); // "날짜 물어보는 중이니?"
    const initialState = {
        conversationStep: 0, isHandlingFollowUp: false, formData: { mustVisitPlaces: [] },
        hotelMarkers: [], dailyPlanData: {}, weatherData: {}, activeSortable: null,
        currentSearchStep: null, autocompletePlaceSelection: null, destinationViewport: null,
        dayMarkers: [], directionsRenderer: null, directionsPolyline: null, currentPlanId: null,
        isPlanSaved: false, autocompleteSessionToken: null, 
    };

    const HolidayHubApp = {
        elements: {
            appWrapper: document.getElementById('app-wrapper'),
            mainContainer: document.getElementById('main-container'),
            // ... (나머지 elements 동일)
            chatMessages: document.getElementById('chat-messages'),
            chatInputArea: document.getElementById('chat-input-area'),
            loadingOverlay: document.getElementById('loading-overlay'),
            backToChatButton: document.getElementById('back-to-chat-btn'),
            tabMain: document.getElementById('tab-main'),
            tabMyPlan: document.getElementById('tab-my-plan'),
            tabSettings: document.getElementById('tab-settings'),
            desktopTabMain: document.getElementById('desktop-tab-main'),
            desktopTabMyPlan: document.getElementById('desktop-tab-my-plan'),
            desktopTabSettings: document.getElementById('desktop-tab-settings'),
            
            // [v9.3.0] 추가된 패널 (빈 상태/지도/결과)
            emptyStatePanel: document.getElementById('empty-state-panel'),
            mapContainer: document.getElementById('map-container'),
            resultContainer: document.getElementById('result-container'),
            chatContainer: document.getElementById('chat-container'),
        },
        state: JSON.parse(JSON.stringify(initialState)),
        conversationFlow: [
             { q: "Hello! I'm your AI Travel Concierge. Where would you like to go?", key: "destination", type: "search_chat", required: true },
             { q: "Great choice! When's your trip, and who's coming along?", key: "dateAndPeople", type: "dateAndPeople", required: true },
             {q: "Any must-visit places? (Optional)", 
                key: "mustVisitPlace", 
                type: "search_chat", 
                required: false, 
                // [핵심 1] 장소 입력 후 '바로' 날짜를 물어보는 Follow-Up 설정
                followUp: { 
                    q: "Great! On which day would you like to visit {placeholder}?", 
                    key: "mustVisitDay", 
                    type: "daySelector" 
                }, 
                // [핵심 2] 날짜까지 대답하면 다시 물어볼 질문 설정
                repeatQuestion: "Got it. Any other places you want to visit?" 
            },
             { q: "What are your interests?", key: "interests", type: "interests", required: false },
             { q: "Preferred pace?", key: "travelIntensity", type: "intensitySelector", required: true },
             { q: "Budget in USD?", key: "budget", type: "number", required: true }
        ],

        start: function() {
            if (!this.elements.chatMessages) return;
            this.setupTabNavigation();
            
            // [v9.3.0] 시작 시 'Initial Mode' (중앙 배치) 강제 적용
            const mainContainer = document.getElementById('main-container');
            if (mainContainer) {
                mainContainer.classList.add('mode-initial');
                mainContainer.classList.remove('mode-results');
                
               this.switchPhase('chat-container');
            }

            if (this.elements.backToChatButton) {
                this.elements.backToChatButton.onclick = () => {
                    this.switchPhase('chat-container');
                    // 뒤로 가기 시 중앙으로 복귀하지 않음 (결과가 이미 있으므로)
                };
            }
            const backButton = document.getElementById('back-button');
            if (backButton) { backButton.onclick = () => this.resetApp(false); }

            const urlParams = new URLSearchParams(window.location.search);
            const planId = urlParams.get('plan');
            if (planId) {
            } else {
                this.askQuestion();
            }
        },

        resetApp: function(isFullReset = false) {
             this.state = JSON.parse(JSON.stringify(initialState));
             this.state.formData.mustVisitPlaces = [];
             if (this.elements.chatMessages) this.elements.chatMessages.innerHTML = '';
             if (this.elements.chatInputArea) this.elements.chatInputArea.innerHTML = '';
             
             // [v9.3.0] 리셋 시 다시 'Initial Mode'로 복귀
             const mainContainer = document.getElementById('main-container');
             if (mainContainer) {
                mainContainer.classList.add('mode-initial');
                mainContainer.classList.remove('mode-results');
             }

             if (!isFullReset) { 
                 (this.elements.tabMain || this.elements.desktopTabMain).click(); 
                 this.switchPhase('chat-container');
                 this.askQuestion(); 
             }
        },

        // [v9.3.0 Helper] 결과 모드로 전환 (애니메이션 트리거)
        activateResultMode: function() {
            const mainContainer = document.getElementById('main-container');
            if (mainContainer && mainContainer.classList.contains('mode-initial')) {
                console.log("✨ Triggering Dynamic Focus Animation...");
                mainContainer.classList.remove('mode-initial');
                mainContainer.classList.add('mode-results');
                
                // 빈 상태 패널 숨김
                if(this.elements.emptyStatePanel) this.elements.emptyStatePanel.style.display = 'none';
            }
        },

   switchPhase: function(phase) {
    const isDesktop = window.innerWidth >= 769; // 데스크톱 기준

    // [데스크톱 로직] CSS 클래스(mode-initial/results)가 알아서 하니까 display 조작 최소화
    if (isDesktop) {
        // 1. 채팅창은 항상 보여야 함 (CSS가 크기만 조절함)
        const chatCont = document.getElementById('chat-container');
        if(chatCont) chatCont.style.display = 'flex'; 

        // 2. 지도 vs 결과(일정) 패널 전환만 관리
        // (이 둘은 같은 오른쪽 공간을 공유하므로, 둘 중 하나만 보여야 함)
        const mapCont = document.getElementById('map-container');
        const resCont = document.getElementById('result-container');

        if (phase === 'map-container') {
            if(mapCont) mapCont.style.display = 'flex';
            if(resCont) resCont.style.display = 'none';
        } else if (phase === 'result-container') {
            if(mapCont) mapCont.style.display = 'none';
            if(resCont) resCont.style.display = 'flex';
        }
        
        // 채팅 모드일 때는 오른쪽 패널을 굳이 JS로 숨길 필요 없음 (CSS가 너비 0으로 만듦)
        return; 
    }

    // [모바일 로직] 기존대로 하나만 보여주고 나머진 숨김 (display: none)
    ['chat-container', 'map-container', 'result-container'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.classList.remove('active');
            el.style.display = 'none';
        }
    });
    
    const activeElement = document.getElementById(phase);
    if (activeElement) {
        activeElement.classList.add('active');
        activeElement.style.display = 'flex';
    }
},


renderInput: function(stepOverride = null) {
    const step = stepOverride || this.conversationFlow[this.state.conversationStep];
    const inputArea = document.getElementById('chat-input-area');
    
    // 1. 안전 초기화
    inputArea.innerHTML = '';
    this._clearAutocompleteSuggestions();

    try {
        if (step.type === 'search_chat') {
            // [검색 모드]
            const wrapper = document.createElement('div');
            // ★ 수정: justify-content: center 추가하여 중앙 정렬
            wrapper.style.cssText = "display:flex; gap:10px; width:100%; align-items:center; position:relative; justify-content: center;"; 
            
            const autoRes = document.createElement('div');
            autoRes.id = 'autocomplete-results';
            wrapper.appendChild(autoRes);

            const input = document.createElement('input');
            input.type = 'text';
            input.id = 'chat-text-input';
            input.className = 'chat-input-field';
            input.placeholder = (step.key === 'destination') ? "e.g., Tokyo, Japan" : "Search for a place...";
            input.autocomplete = "off";
            wrapper.appendChild(input);

            const btn = document.createElement('button');
            btn.id = 'chat-text-send';
            btn.className = 'chat-send-button';
            btn.innerHTML = '<i class="fas fa-paper-plane"></i>';
            wrapper.appendChild(btn);

            if (!step.required) {
                const skipBtn = document.createElement('button');
                skipBtn.textContent = 'Skip';
                skipBtn.className = 'skip-btn';
                skipBtn.style.marginLeft = "10px";
                skipBtn.onclick = () => this.handleUserInput(null, step);
                wrapper.appendChild(skipBtn);
            }

            inputArea.appendChild(wrapper);

            btn.onclick = () => this.handleUserInput(null, step);
            input.onkeydown = (e) => { if (e.key === 'Enter') btn.click(); };
            this.setupChatAutocomplete(step, input, btn);

        } else if (step.type === 'dateAndPeople') {
            // [날짜 및 인원 모드]
            const wrapper = document.createElement('div');
            wrapper.className = 'input-group-wrapper'; 
            // ★ 수정: CSS 클래스 외에도 인라인으로 중앙 정렬 강제 적용
            wrapper.style.cssText = "display:flex; gap:10px; justify-content:center; width:100%;";

            wrapper.innerHTML = `
                <input type="text" id="dateRangeInput" class="chat-input-field" placeholder="Select dates..." readonly style="max-width: 180px;">
                <input type="number" id="adultsInput" class="chat-input-field" placeholder="Adults" min="1" value="1" style="width: 80px;">
                <input type="number" id="childrenInput" class="chat-input-field" placeholder="Kids" min="0" value="0" style="width: 80px;">
                <button id="datePeopleBtn" class="chat-send-button"><i class="fas fa-check"></i></button>
            `;
            inputArea.appendChild(wrapper);

            if(window.flatpickr) flatpickr("#dateRangeInput", { mode: "range", minDate: "today", dateFormat: "Y-m-d" });
            
            const btn = document.getElementById('datePeopleBtn');
            btn.onclick = () => this.handleUserInput(null, step);

        } else if (step.type === 'interests') {
            // [관심사 모드]
            const wrapper = document.createElement('div');
            // ★ 수정: 중앙 정렬 (justify-content: center)
            wrapper.style.cssText = "display:flex; width:100%; gap:10px; align-items:center; justify-content: center;";
            
            wrapper.innerHTML = `
                <div class="interest-tags" style="display:flex; gap:5px; flex-wrap:wrap; justify-content:center;">
                    <span class="interest-tag" data-interest="tourist attraction"># Attraction</span>
                    <span class="interest-tag" data-interest="restaurant"># Restaurant</span>
                    <span class="interest-tag" data-interest="cafe"># Cafe</span>
                    <span class="interest-tag" data-interest="park"># Park</span>
                    <span class="interest-tag" data-interest="museum"># Museum</span>
                    <span class="interest-tag" data-interest="shopping"># Shopping</span>
                    <span class="interest-tag" data-interest="active_vibe"># Active</span>
                    <span class="interest-tag" data-interest="calm_vibe"># Calm</span>
                </div>
                <button id="interestBtn" class="chat-send-button"><i class="fas fa-check"></i></button>
            `;
            inputArea.appendChild(wrapper);

            wrapper.querySelector('.interest-tags').addEventListener('click', (e) => {
                if(e.target.classList.contains('interest-tag')) e.target.classList.toggle('active');
            });
            document.getElementById('interestBtn').onclick = () => this.handleUserInput(null, step);

        } else if (step.type === 'intensitySelector') {
            // [여행 강도 모드]
            const wrapper = document.createElement('div');
            // ★ 수정: 중앙 정렬
            wrapper.style.cssText = "display:flex; gap:10px; width:100%; justify-content:center;";
            wrapper.innerHTML = `
                 <button class="intensity-btn" data-intensity="relaxed" style="padding:10px 20px; border-radius:20px; border:1px solid #ccc; background:white; cursor:pointer;">☕ Relaxed</button>
                 <button class="intensity-btn" data-intensity="moderate" style="padding:10px 20px; border-radius:20px; border:1px solid #ccc; background:white; cursor:pointer;">🚶 Moderate</button>
                 <button class="intensity-btn" data-intensity="adventurous" style="padding:10px 20px; border-radius:20px; border:1px solid #ccc; background:white; cursor:pointer;">🔥 Active</button>
            `;
            inputArea.appendChild(wrapper);
            wrapper.querySelectorAll('.intensity-btn').forEach(btn => {
                btn.onclick = () => this.handleUserInput(btn.dataset.intensity, step);
            });

        // ★★★ [Fix 1] 누락되었던 daySelector 로직 추가 ★★★
        } else if (step.type === 'daySelector') {
            const wrapper = document.createElement('div');
            wrapper.style.cssText = "display:flex; gap:10px; width:100%; justify-content:center; flex-wrap:wrap;";
            
            // 입력된 여행 기간만큼 버튼 생성 (기본값 3일)
            const duration = this.state.formData.duration || 3; 
            
            for (let i = 1; i <= duration; i++) {
                const btn = document.createElement('button');
                btn.textContent = `Day ${i}`;
                // 기존 intensity-btn 스타일 재활용하여 깔끔하게 표시
                btn.style.cssText = "padding:10px 20px; border-radius:20px; border:1px solid #ccc; background:white; cursor:pointer;";
                btn.onclick = () => this.handleUserInput(i, step);
                wrapper.appendChild(btn);
            }
            inputArea.appendChild(wrapper);

        } else if (step.type === 'number') {
            const wrapper = document.createElement('div');
            // ★ 수정: 중앙 정렬
            wrapper.style.cssText = "display:flex; gap:10px; width:100%; justify-content: center;";
            const input = document.createElement('input');
            input.type = 'number';
            input.className = 'chat-input-field';
            input.placeholder = 'Type amount...';
            
            const btn = document.createElement('button');
            btn.className = 'chat-send-button';
            btn.innerHTML = '<i class="fas fa-paper-plane"></i>';
            
            wrapper.appendChild(input);
            wrapper.appendChild(btn);
            inputArea.appendChild(wrapper);

            btn.onclick = () => this.handleUserInput(input.value, step);
            input.onkeydown = (e) => { if (e.key === 'Enter') btn.click(); };
            input.focus();
        }

    } catch(e) { 
        console.error("Render Error:", e);
        this.addMessage("Error rendering input. Please refresh.", "ai");
    }
},

    setupChatAutocomplete: function(step, inputElement, sendBtnElement) {
    const input = inputElement || document.getElementById('chat-text-input');
    const sendBtn = sendBtnElement || document.getElementById('chat-text-send');
    if (!input) return;

    this.state.autocompletePlaceSelection = null; 
    
    // 세션 토큰 관리
    if (!this.state.autocompleteSessionToken) {
        this.state.autocompleteSessionToken = crypto.randomUUID();
    }

    // 입력 이벤트 리스너 (기존 리스너 제거 걱정 없이 새로 생성된 요소이므로 바로 연결)
    input.oninput = async (e) => {
        const query = e.target.value;
        if (query.length < 3) { this._clearAutocompleteSuggestions(); return; }
        
        try {
            let searchTypes = '';
            if (step.key === 'destination') searchTypes = '(regions)';
            else if (step.key === 'mustVisitPlace') searchTypes = 'establishment'; 

            const params = new URLSearchParams({ query: query, session_token: this.state.autocompleteSessionToken });
            if (searchTypes) params.append('types', searchTypes);
            
            const response = await fetch(`/api/autocomplete?${params.toString()}`);
            const data = await response.json();

            if (data && data.status === 'OK' && data.predictions) {
                this._renderAutocompleteSuggestions(data.predictions);
            }
        } catch (error) { console.error(error); }
    };
},
addMessage: function(text, sender) {
            const chatMessages = this.elements.chatMessages;
            if (!chatMessages) return;

            const bubble = document.createElement('div');
            // sender가 'user'면 user-message, 'ai'면 ai-message 클래스 적용
            bubble.className = `message-bubble ${sender === 'user' ? 'user-message' : 'ai-message'}`;
            
            // 텍스트에 HTML 태그(예: <b>)가 포함될 수 있으므로 innerHTML 사용
            bubble.innerHTML = text;

            chatMessages.appendChild(bubble);
            
            // 스크롤을 항상 최하단으로 유지
            chatMessages.scrollTop = chatMessages.scrollHeight;
        },
        _renderAutocompleteSuggestions: function(predictions) {
            const container = document.getElementById('autocomplete-results');
            if (!container) return;
            container.innerHTML = ''; 
            predictions.forEach(prediction => {
                const item = document.createElement('div');
                item.className = 'suggestion-item';
                item.innerHTML = `<i class="fas fa-map-marker-alt"></i><span>${prediction.description}</span>`;
                item.onclick = () => {
                    document.getElementById('chat-text-input').value = prediction.description;
                    this.state.autocompletePlaceSelection = { placeId: prediction.place_id, name: prediction.description };
                    this._clearAutocompleteSuggestions();
                    document.getElementById('chat-text-send').focus(); 
                };
                container.appendChild(item);
            });
        },

        _clearAutocompleteSuggestions: function() {
            const container = document.getElementById('autocomplete-results');
            if (container) container.innerHTML = '';
        },
        handleUserInput: async function(directValue = null, step) {
            let value, displayValue;
            try {
                if (directValue !== null) {
                    value = directValue;
                    displayValue = (step.key === 'mustVisitDay') ? `Day ${value}` : (typeof value === 'string' ? (value.charAt(0).toUpperCase() + value.slice(1)) : value);
                } else { 
                    switch (step.type) {
                        case 'search_chat':
                            const selection = this.state.autocompletePlaceSelection; 
                            const textValue = document.getElementById('chat-text-input')?.value.trim(); 
                            
                            if (selection && selection.name === textValue) {
                                displayValue = selection.name;
                                this.elements.chatInputArea.innerHTML = '<p>Getting details...</p>'; 
                                
                                try {
                                    const params = new URLSearchParams({
                                        place_id: selection.placeId,
                                        session_token: this.state.autocompleteSessionToken
                                    });
                                    const response = await fetch(`/api/get_place_details?${params.toString()}`);
                                    const data = await response.json();
                                    
                                    this.state.autocompleteSessionToken = null; 
                                    console.log("🎫 Session Token Used & Reset.");

                                    if (data && data.status === 'OK' && data.result) {
                                        const placeDetails = data.result;
                                        const fullValue = {
                                            name: placeDetails.name,
                                            latitude: placeDetails.geometry.location.lat,
                                            longitude: placeDetails.geometry.location.lng,
                                            place_id: placeDetails.place_id
                                        };
                                        if (step.key === 'destination') {
                                            this.state.formData.destination = placeDetails.name;
                                            // ★★★ [중요] 좌표 정보 추가 저장 ★★★
                                            this.state.formData.destination_coords = {
                                                latitude: placeDetails.geometry.location.lat,
                                                longitude: placeDetails.geometry.location.lng
                                            };
                                            this.state.destinationViewport = placeDetails.geometry.viewport || null;
                                        }
                                        this._processAndContinue(fullValue, displayValue, step);
                                    } else {
                                        this.showModal(`Error fetching place details: ${data.error}`);
                                        this._processAndContinue({ name: textValue }, textValue, step);
                                    }
                                } catch (error) {
                                    this.state.autocompleteSessionToken = null;
                                    this.showModal(`Failed to fetch: ${error.message}`);
                                    this._processAndContinue({ name: textValue }, textValue, step);
                                }
                                return; 
                            
                            } else if (textValue) {
                                displayValue = textValue;
                                value = { name: textValue };
                                if (step.key === 'destination') {
                                    this.state.formData.destination = textValue;
                                    this.state.destinationViewport = null; 
                                }
                                this.state.autocompleteSessionToken = null; 
                            
                            } else if (step.key === 'mustVisitPlace' && !textValue) {
                                value = null;
                                displayValue = "Skipped";
                                this.state.autocompleteSessionToken = null; 
                            
                            } else if (step.required && !textValue) {
                                this.showModal("This information is required.");
                                return; 
                            }
                            break;
                        
                        // (다른 case들은 생략 없이 포함 - v8.7.2와 동일)
                        case 'number': 
                            const inputField = this.elements.chatInputArea.querySelector('input');
                            value = inputField?.value.trim() ?? '';
                            displayValue = value; 
                            break;
                        case 'dateAndPeople':
                            const dates = document.getElementById('dateRangeInput')?.value; 
                            if(!dates) { this.showModal("Please select a date range."); return; } 
                            const adults = parseInt(document.getElementById('adultsInput')?.value) || 1;
                            const children = parseInt(document.getElementById('childrenInput')?.value) || 0;
                            displayValue = `${dates} / ${adults + children} people`;
                            const dateArray = dates.split(' to ');
                            this.state.formData['startDate'] = dateArray[0];
                            const endDate = new Date(dateArray.length > 1 ? dateArray[1] : dateArray[0]);
                            const startDate = new Date(dateArray[0]);
                            this.state.formData['duration'] = Math.max(1, Math.ceil(Math.abs(endDate - startDate) / (1000*60*60*24)) + 1);
                            this.state.formData['numberOfPeople'] = adults + children;
                            value = true; 
                            break;
                        case 'interests':
                            const selectedTags = Array.from(this.elements.chatInputArea.querySelectorAll('.interest-tag.active')).map(t => t.dataset.interest).filter(t => t !== 'none');
                            displayValue = selectedTags.length > 0 ? selectedTags.map(i => `#${i.replace(/_/g, ' ')}`).join(' ') : '#No Preference';
                            value = selectedTags.length > 0 ? selectedTags : []; 
                            break;
                        default:
                            return;
                    }
                }
                this._processAndContinue(value, displayValue, step);
            } catch (error) { 
                console.error(`❌ Error in handleUserInput:`, error); 
                this.state.autocompleteSessionToken = null;
                this.askQuestion(); 
            }
        },

        _processAndContinue: function(value, displayValue, step) {
            // (기존 로직)
            if (step.required && !value && value !== 0 && value !== false) { 
                this.showModal("This information is required.");
                this.renderInput(step); 
                return;
            }
            if (value === null && step.key === 'mustVisitPlace' && !this.state.isHandlingFollowUp) {
                this.addMessage("Skipped", "user");
                this.state.conversationStep++;
                this.askQuestion();
                return;
            }
            this.addMessage(displayValue, "user");
            this.state.autocompletePlaceSelection = null; 
            
            if (this.state.isHandlingFollowUp) { 
            // 1. 방금 입력받은 날짜(value)를 마지막 장소 정보에 업데이트
            if (!this.state.formData.mustVisitPlaces) this.state.formData.mustVisitPlaces = [];
            if (this.state.formData.mustVisitPlaces.length > 0) {
                // 마지막에 추가된 장소(방금 말한 곳)를 찾음
                const lastIndex = this.state.formData.mustVisitPlaces.length - 1;
                this.state.formData.mustVisitPlaces[lastIndex].day = value; 
                console.log(`📍 Anchored: ${this.state.formData.mustVisitPlaces[lastIndex].name} -> Day ${value}`);
            }

            const currentMainStep = this.conversationFlow[this.state.conversationStep]; 
            if (currentMainStep && currentMainStep.repeatQuestion) {
                this.askQuestion({ 
                    q: currentMainStep.repeatQuestion, 
                    key: currentMainStep.key, 
                    type: 'search_chat', 
                    required: false, 
                    followUp: currentMainStep.followUp, // 반복될 때도 날짜 질문 유지
                    repeatQuestion: currentMainStep.repeatQuestion,
                    title: "Search Another Must-Visit" 
                });
            } else { 
                // 반복 없으면 다음 단계로
                this.state.conversationStep++;
                this.askQuestion();
            }
            } else {
    // [로직 수정] 메인 질문 (장소 입력) 처리 중일 때
    if(step.key === 'mustVisitPlace' && value) {
        // 1. 장소 이름 저장
        if (!this.state.formData.mustVisitPlaces) this.state.formData.mustVisitPlaces = [];
        // 날짜(day)는 아직 모르므로 null로 둠, name만 저장
        this.state.formData.mustVisitPlaces.push({ name: value.name || value, day: null }); 
    } 
    
    // ... (기존 데이터 저장 로직) ...
    else if (step.key !== 'dateAndPeople' && step.key !== 'destination' && step.key !== 'mustVisitPlace') { 
        this.state.formData[step.key] = (step.key === 'budget') ? parseFloat(value) || 0 : value;
    }

    // 2. Follow-Up(날짜 질문)이 있으면 실행
    if (step.followUp && value) { 
        this.state.isHandlingFollowUp = true;
        this.askQuestion(step.followUp); // "Which day?" 질문 던짐
    } else { 
        // Follow-Up 없거나 Skip했으면 다음 단계로
        this.state.conversationStep++;
        if (this.state.conversationStep < this.conversationFlow.length) {
            this.askQuestion();
        } else { 
            // 모든 질문 끝, 호텔 검색 시작
            this.elements.chatInputArea.innerHTML = '<p>Thank you! Let me find the perfect hotels for you...</p>';
            this.findHotels();
        }
    }
}
        
        askQuestion: function(customStep = null) {
            // (기존 로직)
            const step = customStep || this.conversationFlow[this.state.conversationStep];
            if (step) {
                let questionText = step.q;
                if (customStep && customStep.key === 'mustVisitDay') {
                    if (this.state.formData.mustVisitPlaces?.length > 0) {
                        const lastMustVisit = this.state.formData.mustVisitPlaces[this.state.formData.mustVisitPlaces.length - 1];
                        if (lastMustVisit?.name) { questionText = questionText.replace('{placeholder}', `<b>${lastMustVisit.name}</b>`); }
                        else { questionText = questionText.replace('{placeholder}', 'the place'); }
                    } else { questionText = "Which day for that place?"; }
                }
                setTimeout(() => { this.addMessage(questionText, "ai"); this.renderInput(customStep); }, 100);
            } else { 
                this.addMessage("Sorry, a conversation error occurred.", "ai"); 
                this.resetApp(); 
            }
        },

        // --- 3. API & Map Methods (v8.7.2 유지) ---
      findHotels: async function() {
    if (!this.elements.loadingOverlay) return;
    this.elements.loadingOverlay.classList.remove('hidden');
    console.log("🚀 Finding hotels... (Request Sent)");

    try {
        const response = await fetch('/find-hotels', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify(this.state.formData) 
        });
        
        const data = await response.json();
        console.log("📦 Hotel Data Received:", data);

        if (data.hotels?.length > 0) {
            // 1. 화면 모드 변경
            this.activateResultMode();
            
            // 2. 지도 패널을 먼저 '보이게' 만듦
            this.switchPhase('map-container');
            
            // 3. [핵심] 브라우저가 화면을 그릴 시간을 충분히 줌 (100ms -> 500ms)
            setTimeout(() => {
                console.log("🗺️ Rendering Hotel Map now...");
                const mapElement = document.getElementById('hotel-map');
                
                // [디버깅] 지도가 그려질 공간이 진짜 있는지 확인
                if (mapElement) {
                    console.log(`📏 Map Container Size: ${mapElement.offsetWidth}x${mapElement.offsetHeight}`);
                    if (mapElement.offsetHeight === 0) {
                        console.warn("⚠️ Warning: Map container height is 0! forcing height...");
                        mapElement.style.height = '500px'; // 강제 주입
                    }
                }
                
                this.showHotelMap(data.hotels);
            }, 500);
            
        } else { 
            this.showModal(data.error || "No hotels found matching your criteria."); 
        }
    } catch(e) { 
        console.error("❌ Find Hotels Error:", e); 
        this.showModal("An error occurred while fetching hotels.");
    } finally { 
        this.elements.loadingOverlay.classList.add('hidden'); 
    }
},

          createFinalPlan: async function() {
            if (!this.elements.loadingOverlay) return;
            this.elements.loadingOverlay.classList.remove('hidden');
            try {
                const response = await fetch('/create-plan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(this.state.formData) });
                const data = await response.json();
                if (data.status === 'success' && data.daily_plan) {
                    this.state.dailyPlanData = data.daily_plan;
                    // [v9.3.0] 화면 전환!
                    this.activateResultMode();
                    this.switchPhase('result-container');
                    setTimeout(() => this.displayResults(this.state.formData.hotel_location), 600);
                } else { this.showModal(data.error || "Plan failed."); this.resetApp(); }
            } catch(e) { console.error(e); this.resetApp(); }
            finally { this.elements.loadingOverlay.classList.add('hidden'); }
        },
        findAlternatives: async function(originalPlace, dayKey, itemIndex) {
            if (!this.elements.loadingOverlay || !this.elements.loadingText) return;
            this.elements.loadingText.textContent = "Finding alternatives..."; this.elements.loadingOverlay.classList.remove('hidden');
            const seenIds = Object.values(this.state.dailyPlanData || {}).flat().map(a => a.details?.id).filter(id => id);
            try {
                const placeToSend = { ...originalPlace, name: originalPlace.displayName?.text || originalPlace.name || "Activity" };
                const response = await fetch('/get-alternatives', { 
                    method: 'POST', headers: { 'Content-Type': 'application/json' }, 
                    body: JSON.stringify({ original_place: placeToSend, seen_ids: seenIds, formData: this.state.formData }) 
                }); 
                if (!response.ok) { const err = await response.json().catch(()=>({error:`Server error ${response.status}`})); throw new Error(err.error || `Server error ${response.status}`); }
                const data = await response.json();
                if (data.alternatives?.length > 0) {
                    this.showAlternativesModal(data.alternatives, dayKey, itemIndex);
                } else { this.showModal("No suitable alternatives found nearby."); }
            } catch (error) { console.error("Error finding alternatives:", error); this.showModal(`Error finding alternatives: ${error.message}.`); }
            finally { if(this.elements.loadingOverlay) this.elements.loadingOverlay.classList.add('hidden'); }
        },
        showHotelMap: function(hotels) {
            const mapElement = document.getElementById('hotel-map');
            if (!mapElement) { console.error("Map element not found for hotels!"); return; }
            if (!hotels || !Array.isArray(hotels) || hotels.length === 0 || !hotels[0]?.location?.latitude) {
                console.error("Invalid or empty hotels data received:", hotels);
                this.showModal("Invalid hotel data received. Cannot display map.");
                this.resetApp(); return;
            }
            try {
                const map = new google.maps.Map(mapElement, { zoom: 13, center: { lat: hotels[0].location.latitude, lng: hotels[0].location.longitude }, mapTypeControl: false, streetViewControl: false, mapId: "HOLIDAY_HUB_MAP" });
                this.state.hotelMarkers.forEach(m => {if(m && m.map) m.map = null;});
                this.state.hotelMarkers = [];
                
                hotels.forEach(hotel => {
                    if (hotel.location && typeof hotel.location.latitude === 'number') {
                        const hotelLatLng = { lat: hotel.location.latitude, lng: hotel.location.longitude }; 
                        const markerDiv = document.createElement('img');
                        markerDiv.src = hotel.image_url || 'https://placehold.co/70x70/00a09a/ffffff?text=🏨';
                        markerDiv.alt = hotel.name || 'Hotel';
                        markerDiv.className = 'hotel-marker';
                        
                        try {
                            const marker = new google.maps.marker.AdvancedMarkerElement({ map, position: hotelLatLng, content: markerDiv, title: hotel.name || 'Hotel' });
                            
                            marker.addListener('click', () => {
                                const panel = document.getElementById('panel-content'); 
                                const detailPanel = document.getElementById('hotel-detail-panel');
                                if(!panel || !detailPanel) { console.error("Hotel detail panel not found!"); return; }

                                let tagsHTML = '';
                                if (hotel.summary_tags && Array.isArray(hotel.summary_tags) && hotel.summary_tags.length > 0) {
                                    tagsHTML = `<div class="card-tags">
                                        ${hotel.summary_tags.map(tagText => 
                                            `<span class="concierge-tag">${tagText}</span>`
                                        ).join('')}
                                    </div>`;
                                } else if (hotel.summary) { 
                                    tagsHTML = `<p class="summary">${hotel.summary}</p>`;
                                }
                                
                                const hotelName = hotel.name || 'Selected Hotel'; 
                                let mapLinkHTML = '';
                                if (hotel.id) { 
                                    mapLinkHTML = `<a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(hotelName)}&query_place_id=${hotel.id}" class="map-link" target="_blank">View on Google Maps</a>`;
                                } else {
                                    mapLinkHTML = `<a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(hotelName)}%2C%20${encodeURIComponent(this.state.formData.destination || '')}" class="map-link" target="_blank">Search on Google Maps</a>`;
                                }
                                
                                panel.innerHTML = `
                                    <h3>${hotelName}</h3>
                                    <p class="card-rating">${hotel.rating ? `<span style="color: gold;">★</span> ${hotel.rating}` : 'N/A'}</p>
                                    ${tagsHTML}
                                    ${mapLinkHTML}
                                    <button id="select-hotel-btn">Select this Hotel</button>
                                `;
                                
                                const btn = document.getElementById('select-hotel-btn');
                                if(btn) {
                                    btn.onclick = () => {
                                        this.state.formData.hotel_location = { latitude: hotel.location.latitude, longitude: hotel.location.longitude };
                                        this.state.formData.selected_hotel_id = hotel.id; 
                                        this.state.formData.selected_hotel_name = hotel.name; 
                                        this.createFinalPlan();
                                    };
                                }
                                
                                detailPanel.classList.remove('hidden');
                            });
                            this.state.hotelMarkers.push(marker);
                        } catch (markerError) { console.error("Error creating hotel marker:", markerError, hotel); }
                    } else { console.warn("Skipping hotel due to missing or invalid location:", hotel); }
                });
            } catch (mapInitError) { console.error("Hotel map initialization error:", mapInitError); this.showModal("Map display error."); }
        },
        displayResults: function(hotelLoc) {
            const dayButtons = document.getElementById('day-buttons-container'), mapPanel = document.getElementById('map-panel'), backBtn = document.getElementById('back-button'), itineraryContent = document.getElementById('itinerary-content');
            if (!dayButtons || !mapPanel || !backBtn || !itineraryContent) { console.error("Result elements missing."); this.showModal("Result page error."); this.resetApp(); return; }
            dayButtons.innerHTML = ''; 
            let map;
            const hotelLatLng = { lat: hotelLoc.latitude, lng: hotelLoc.longitude }; 
            try { map = new google.maps.Map(mapPanel, { zoom: 12, center: hotelLatLng, mapTypeControl: false, streetViewControl: false, mapId: "HOLIDAY_HUB_MAP" }); }
            catch (mapError) { console.error("Results map initialization error:", mapError); map = null; this.showModal("Error displaying map."); }
            try {
                if (this.state.activeSortable) { this.state.activeSortable.destroy(); }
                this.state.activeSortable = new Sortable(itineraryContent, {
                    animation: 150, handle: '.drag-handle', ghostClass: 'sortable-ghost',
                    onEnd: (evt) => {
                        const dayKey = document.querySelector('.day-button.active')?.dataset.dayKey;
                        if (!dayKey || !this.state.dailyPlanData || !this.state.dailyPlanData[dayKey]) { return; }
                        const item = this.state.dailyPlanData[dayKey].splice(evt.oldIndex, 1)[0];
                        this.state.dailyPlanData[dayKey].splice(evt.newIndex, 0, item);
                        if(this.state.isPlanSaved) this.state.isPlanSaved = false;
                        this.updatePlanActionButtons();
                        this.showDay(dayKey, hotelLoc, map); 
                    }
                });
            } catch (sortableError) { console.error("SortableJS initialization error:", sortableError); }
            const dayKeys = Object.keys(this.state.dailyPlanData || {});
            if (dayKeys.length === 0) { itineraryContent.innerHTML = "<p>No itinerary data available for this plan.</p>"; return; }
            dayKeys.forEach((dayKey, index) => {
                const btn = document.createElement('button');
                btn.className = 'day-button'; btn.dataset.dayKey = dayKey;
                btn.innerHTML = `${dayKey.replace(' ','')}<br>`;
                btn.onclick = () => {
                    document.querySelectorAll('.day-button.active').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    this.showDay(dayKey, hotelLoc, map);
                };
                dayButtons.appendChild(btn);
                if (index === 0) { setTimeout(() => btn.click(), 0); } 
            });
           this.setupPlanActionButtons();
        },
        showDay: function(dayKey, hotelLocation, map) {
            const itineraryContent = document.getElementById('itinerary-content');
            if (!itineraryContent) { console.error("Itinerary content element not found!"); return; }
            itineraryContent.innerHTML = ''; 
            
            if (this.state.dayMarkers) this.state.dayMarkers.forEach(m => {if(m && m.map) m.map = null;});
            if (this.state.directionsRenderer) { this.state.directionsRenderer.setMap(null); this.state.directionsRenderer = null;}
            if (this.state.directionsPolyline) { this.state.directionsPolyline.setMap(null); this.state.directionsPolyline = null;}
            this.state.dayMarkers = [];
            if (!hotelLocation || typeof hotelLocation.latitude !== 'number') { return; }
            const hotelLatLng = { lat: hotelLocation.latitude, lng: hotelLocation.longitude };
            const activities = this.state.dailyPlanData?.[dayKey] || [];
            if (!activities.length) {
                itineraryContent.innerHTML = `<p>No activities planned for ${dayKey}.</p>`;
                if (map) map.setCenter(hotelLatLng); 
                return;
            }
            const origin = hotelLatLng; 
            const waypoints = activities.filter(a => a.details?.location?.latitude != null).map(a => ({
                location: { lat: a.details.location.latitude, lng: a.details.location.longitude }, stopover: true
            }));
            
            const arrowIcon = { path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW, scale: 4, fillColor: '#004d40', fillOpacity: 1, strokeWeight: 0, anchor: new google.maps.Point(0, 2.5) };
            
            if (map && waypoints.length > 0) {
                try {
                    this.state.directionsRenderer = new google.maps.DirectionsRenderer({
                        suppressMarkers: true,
                        polylineOptions: { strokeColor: '#00a09a', strokeWeight: 5, strokeOpacity: 0.8, icons: [{ icon: arrowIcon, offset: '0', repeat: '100px' }] } 
                    });
                    this.state.directionsRenderer.setMap(map);
                    const service = new google.maps.DirectionsService();
                    service.route({
                        origin: origin, destination: origin, waypoints: waypoints, travelMode: google.maps.TravelMode.DRIVING
                    }, (res, status) => {
                        if (status === google.maps.DirectionsStatus.OK) {
                            this.state.directionsRenderer.setDirections(res);
                            if (res.routes[0]?.bounds) { map.fitBounds(res.routes[0].bounds); }
                        } else {
                            console.error('Directions request failed:', status);
                            const pathCoordinates = [origin, ...waypoints.map(wp => wp.location), origin];
                            this.state.directionsPolyline = new google.maps.Polyline({
                                path: pathCoordinates, geodesic: true, strokeColor: '#00a09a', strokeOpacity: 0.8, strokeWeight: 5,
                                icons: [{ icon: arrowIcon, offset: '0', repeat: '100px' }],
                            });
                            this.state.directionsPolyline.setMap(map);
                            const bounds = new google.maps.LatLngBounds();
                            bounds.extend(origin);
                            waypoints.forEach(wp => bounds.extend(wp.location));
                            map.fitBounds(bounds);
                        }
                    });
                } catch (dirError) { console.error("Directions error setup:", dirError); }
            } else if (map) { map.setCenter(origin); map.setZoom(14); }
            
            if (map) {
                try {
                    const icon = document.createElement('div');
                    icon.innerHTML = `<i class="fas fa-home" style="color: #d32f2f; font-size: 28px; text-shadow: 1px 1px 2px #333;"></i>`;
                    this.state.dayMarkers.push(new google.maps.marker.AdvancedMarkerElement({ map, position: origin, content: icon, title: 'Hotel', zIndex: 999 })); 
                } catch (hMarkerErr) { console.error("Hotel marker error:", hMarkerErr); }
            }
            
            activities.forEach((activity, index) => {
                if (!activity.details) { return; }
                const details = activity.details; 
                const template = document.getElementById('activity-card-template'); 
                if (!template) { console.error("Template 'activity-card-template' not found!"); return; }
                
                try {
                    const cardWrapper = template.content.cloneNode(true); 
                    
                    const travelDiv = cardWrapper.querySelector('.travel-details'); 
                    const travelInfo = activity.travel_details;
                    if (travelInfo && travelDiv) {
                        let hasValidTime = false;
                        Object.keys(travelInfo).forEach(mode => {
                            if (mode === 'fallback_driving') return;
                            const span = travelDiv.querySelector(`[data-mode="${mode}"]`);
                            const dur = travelInfo[mode];
                            if (span && dur != null) { 
                                const em = mode === 'driving' ? '🚗' : mode === 'transit' ? '🚌' : '🚶';
                                span.innerHTML = `${em} ${Math.round(dur)} min`;
                                span.classList.remove('not-available');
                                hasValidTime = true;
                            } else if(span) { span.style.display = 'none'; }
                        });
                        if (!hasValidTime && travelInfo.fallback_driving != null) {
                            const drivingSpan = travelDiv.querySelector(`[data-mode="driving"]`);
                            if (drivingSpan) {
                                drivingSpan.innerHTML = `🚗 ~${Math.round(travelInfo.fallback_driving)} min*`;
                                drivingSpan.classList.remove('not-available');
                                drivingSpan.style.display = 'flex';
                                drivingSpan.title = "Estimated time based on distance (route not found)";
                            }
                        } else if (!hasValidTime && travelInfo.fallback_driving == null) { travelDiv.style.display = 'none'; }
                    } else if (travelDiv) { travelDiv.style.display = 'none'; }
                    
                    const card = cardWrapper.querySelector('.activity-card'); if (!card) return;
                    card.querySelector('.time-block').textContent = activity.type || 'Activity';
                    const placeName = details.name || details.displayName?.text || "Unnamed Place"; 
                    card.querySelector('.card-title').textContent = placeName;
                    card.querySelector('.card-image-small').src = details.image_url || 'https://placehold.co/120x120/eee/ccc?text=Activity';
                    
                    const ratingEl = card.querySelector('.card-rating');
                    if (ratingEl) ratingEl.innerHTML = details.rating ? `<span style="color: gold;">★</span> ${details.rating}` : '';
                    
                    const tagsContainer = cardWrapper.querySelector('.card-tags');
                    if (tagsContainer && details.summary_tags && Array.isArray(details.summary_tags)) {
                        tagsContainer.innerHTML = ''; // 초기화
                        details.summary_tags.forEach(tagText => {
                            const tag = document.createElement('span');
                            tag.className = 'concierge-tag';
                            tag.textContent = tagText;
                            tagsContainer.appendChild(tag);
                        });
                    }
                    
                    const link = cardWrapper.querySelector('.map-link');
                    if (link) {
                        if (details.id) { link.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(placeName)}&query_place_id=${details.id}`; } 
                        else { link.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(placeName)}%2C%20${encodeURIComponent(this.state.formData.destination || '')}`; }
                        link.style.display = 'inline-block';
                    }
                    
                    if (map && details.location && typeof details.location.latitude === 'number') {
                        try {
                            const activityLatLng = { lat: details.location.latitude, lng: details.location.longitude }; 
                            const markerCont = document.createElement('div');
                            markerCont.className = 'map-marker-container';
                            const imgMarker = document.createElement('img');
                            imgMarker.className = 'map-image-marker';
                            imgMarker.src = details.image_url || 'https://placehold.co/60x60/FDD835/000?text=📍';
                            imgMarker.alt = placeName;
                            const numMarker = document.createElement('span');
                            numMarker.className = 'map-number-marker'; 
                            numMarker.textContent = `${index + 1}`;
                            markerCont.append(imgMarker, numMarker);
                            this.state.dayMarkers.push(new google.maps.marker.AdvancedMarkerElement({
                                position: activityLatLng, map, content: markerCont, title: `${index + 1}. ${placeName}`
                            }));
                        } catch (aMarkerErr) { console.error("Activity marker error:", aMarkerErr, details); }
                    }
                    
                    const delBtn = cardWrapper.querySelector('.delete-btn');
                    if (delBtn) delBtn.onclick = () => {
                        if (this.state.dailyPlanData[dayKey]) {
                            this.state.dailyPlanData[dayKey].splice(index, 1);
                            if(this.state.isPlanSaved) this.state.isPlanSaved = false; 
                            this.updatePlanActionButtons();
                            this.showDay(dayKey, hotelLocation, map); 
                        }
                    };
                    const planBtn = cardWrapper.querySelector('.plan-b-btn');
                    if (planBtn) planBtn.onclick = () => {
                        const placeToSend = details.displayName ? details : { ...details, displayName: { text: details.name || "Activity" } };
                        this.findAlternatives(placeToSend, dayKey, index);
                    };

                    itineraryContent.appendChild(cardWrapper);

                } catch (cardErr) { console.error("Error creating activity card:", cardErr, activity); }
            }); 
        }, 
        
        // ★★★ [v9.1.0 신규] 설정 화면 렌더링 (로그인/로그아웃 버튼) ★★★
        renderSettings: async function() {
            const { GoogleAuthProvider, signInWithPopup, signOut } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js");

            const containers = [
                document.getElementById('auth-section'),
                document.getElementById('auth-section-desktop')
            ];

            containers.forEach(container => {
                if (!container) return;
                container.innerHTML = '';

                if (currentUserId && firebaseAuth.currentUser) {
                    const user = firebaseAuth.currentUser;
                    container.innerHTML = `
                        <div class="user-profile">
                            <img src="${user.photoURL || 'https://placehold.co/60x60?text=U'}" class="profile-pic" alt="Profile">
                            <span id="user-name">${user.displayName || 'Traveler'}</span>
                        </div>
                        <p>Your plans are safely stored in the Vault.</p>
                        <button class="auth-button logout" style="background-color: #d32f2f; color: white; border: none;">Sign Out</button>
                    `;
                    container.querySelector(`.auth-button.logout`).onclick = async () => {
                        try {
                            await signOut(firebaseAuth);
                            this.showModal("Logged out successfully.");
                        } catch (e) { console.error(e); }
                    };
                } else {
                    container.innerHTML = `
                        <div class="user-profile">
                            <i class="fas fa-user-circle" style="font-size: 48px; color: #ccc; margin-bottom:10px;"></i>
                            <p>Log in to save and manage your travel plans.</p>
                        </div>
                        <button class="auth-button google-login">
                            <i class="fab fa-google"></i> Sign in with Google
                        </button>
                    `;
                    container.querySelector(`.auth-button.google-login`).onclick = async () => {
                        const provider = new GoogleAuthProvider();
                        try {
                            await signInWithPopup(firebaseAuth, provider);
                            this.showModal("Welcome back!");
                        } catch (e) { console.error(e); this.showModal("Login failed."); }
                    };
                }
            });
        },

        // --- 4. Utility & Firebase Methods (v9.1.0 업데이트) ---
        showModal: function(message, duration = 3000) {
            let modal = document.getElementById('simple-modal');
            if (modal) modal.remove(); 
            modal = document.createElement('div');
            modal.id = 'simple-modal'; modal.className = 'simple-modal';
            modal.innerHTML = `<p>${message.replace(/\n/g, '<br>')}</p><button class="close-modal-simple-btn">OK</button>`;
            document.body.appendChild(modal);
            const closeButton = modal.querySelector('.close-modal-simple-btn');
            const removeModal = () => { if(document.body.contains(modal)) { document.body.removeChild(modal); } };
            closeButton.onclick = removeModal;
            if(duration > 0) { setTimeout(removeModal, duration); }
        },
        setupTabNavigation: function() {
            const tabs = [
                { btn: this.elements.tabMain, page: this.elements.mainContainer },
                { btn: this.elements.tabMyPlan, page: this.elements.myPlanContainer },
                { btn: this.elements.tabSettings, page: this.elements.settingsContainer }
            ];
            const desktopTabs = [
                { btn: this.elements.desktopTabMain, page: this.elements.mainContainer },
                { btn: this.elements.desktopTabMyPlan, page: this.elements.myPlanContainer },
                { btn: this.elements.desktopTabSettings, page: null } 
            ];
            const allTabButtons = [
                this.elements.tabMain, this.elements.tabMyPlan, this.elements.tabSettings,
                this.elements.desktopTabMain, this.elements.desktopTabMyPlan, this.elements.desktopTabSettings
            ].filter(btn => btn != null);
            const allPages = [
                this.elements.mainContainer, this.elements.myPlanContainer, this.elements.settingsContainer
            ].filter(page => page != null);
            
            const handleTabClick = (pageToShowId) => {
                const pageToShow = document.getElementById(pageToShowId);
                
                if (!pageToShow) {
                    if (pageToShowId === 'settings-container-desktop' || pageToShowId === 'desktop-tab-settings') { 
                        allTabButtons.forEach(btn => { btn.classList.toggle('active', (btn.id === 'desktop-tab-settings')); });
                        const mainPage = document.getElementById('main-container');
                        if (mainPage) mainPage.classList.add('active');
                    }
                    return;
                }
                
                allPages.forEach(page => page.classList.remove('active'));
                pageToShow.classList.add('active');
                allTabButtons.forEach(btn => { btn.classList.toggle('active', btn.dataset.page === pageToShowId); });
                if (pageToShowId === 'my-plan-container') { this.loadMySavedPlans(); }
            };
            
            tabs.forEach(tab => { if (tab.btn) tab.btn.onclick = () => handleTabClick(tab.page.id); });
            desktopTabs.forEach(tab => { if (tab.btn) tab.btn.onclick = () => handleTabClick(tab.btn.dataset.page); });
        },
        updateUser: function(uid) {
            console.log("User ID updated:", uid);
            currentUserId = uid;
            
            // [v9.1.0] UI 갱신 (로그인 버튼 등)
            this.renderSettings();

            // 탭 활성화/비활성화 (기존 로직)
            if (!uid) {
                if (this.elements.tabMyPlan) this.elements.tabMyPlan.disabled = true;
                if (this.elements.desktopTabMyPlan) this.elements.desktopTabMyPlan.disabled = true;
                const savedPlansList = document.getElementById('saved-plans-list');
                if(savedPlansList) savedPlansList.innerHTML = '<p>Log in to see your saved plans.</p>';
            } else {
                if (this.elements.tabMyPlan) this.elements.tabMyPlan.disabled = false;
                if (this.elements.desktopTabMyPlan) this.elements.desktopTabMyPlan.disabled = false;
                const savedPlansList = document.getElementById('saved-plans-list');
                if(savedPlansList) savedPlansList.innerHTML = '<p>Click "My Plans" to load your saved plans.</p>';
            }
        },
        setupPlanActionButtons: function() {
            if (this.elements.savePlanButton) { this.elements.savePlanButton.onclick = () => this.savePlanToFirestore(); }
            if (this.elements.sharePlanButton) { this.elements.sharePlanButton.onclick = () => this.sharePlan(); }
            if(this.elements.planActions) this.elements.planActions.classList.remove('hidden'); 
            this.updatePlanActionButtons(); 
        },
        updatePlanActionButtons: function() {
            if (this.elements.savePlanButton) {
                this.elements.savePlanButton.disabled = this.state.isPlanSaved;
                this.elements.savePlanButton.innerHTML = this.state.isPlanSaved ? '<i class="fas fa-check"></i> Saved' : '<i class="fas fa-save"></i> Save';
            }
            if (this.elements.sharePlanButton) { this.elements.sharePlanButton.disabled = !this.state.isPlanSaved; }
        },
        savePlanToFirestore: async function() {
            if (!currentUserId || !firestoreDb) {
                this.showModal("Log in to save your plans!\nYou can log in from the 'Settings' tab.", 5000);
                (this.elements.tabSettings || document.getElementById('desktop-tab-settings'))?.click();
                return;
            }
            if (!this.state.dailyPlanData || Object.keys(this.state.dailyPlanData).length === 0) {
                this.showModal("There is no plan data to save."); return;
            }
            if (this.state.isPlanSaved && this.state.currentPlanId) {
                this.showModal("Plan is already up-to-date."); return;
            }
            if (!this.elements.loadingOverlay) return;
            this.elements.loadingText.textContent = "Saving plan...";
            this.elements.loadingOverlay.classList.remove('hidden');
            const planDataToSave = {
                userId: currentUserId,
                formData: this.state.formData, 
                dailyPlan: this.state.dailyPlanData,
                createdAt: null, 
                planName: `${this.state.formData.destination} - ${this.state.formData.startDate}` 
            };
            try {
                const { doc, setDoc, collection, addDoc, serverTimestamp } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
                planDataToSave.createdAt = serverTimestamp(); 
                let docRef;
                if (this.state.currentPlanId) {
                    const planRef = doc(firestoreDb, `artifacts/${currentAppId}/users/${currentUserId}/plans`, this.state.currentPlanId);
                    await setDoc(planRef, planDataToSave, { merge: true }); 
                } else {
                    const plansCollectionRef = collection(firestoreDb, `artifacts/${currentAppId}/users/${currentUserId}/plans`);
                    docRef = await addDoc(plansCollectionRef, planDataToSave);
                    this.state.currentPlanId = docRef.id; 
                }
                this.state.isPlanSaved = true;
                this.updatePlanActionButtons();
                this.showModal("Plan saved successfully!", 2000);
                
                // ★★★ [v9.1.0] 저장 후 목록 갱신 ★★★
                this.loadMySavedPlans();
            } catch (error) {
                console.error("Error saving plan:", error);
                this.showModal("Error saving plan. Please try again.");
            } finally {
                if (this.elements.loadingOverlay) this.elements.loadingOverlay.classList.add('hidden');
            }
        },
        sharePlan: async function() {
            if (!this.state.isPlanSaved || !this.state.currentPlanId) {
                if (!currentUserId) {
                    this.showModal("Log in to save and share your plan.", 5000);
                    (this.elements.tabSettings || document.getElementById('desktop-tab-settings'))?.click();
                    return;
                }
                await this.savePlanToFirestore(); 
                if (!this.state.isPlanSaved) { return; }
            }
            if (!firestoreDb) { this.showModal("Database connection error."); return; }
            if (!this.elements.loadingOverlay) return;
            this.elements.loadingText.textContent = "Generating share link...";
            this.elements.loadingOverlay.classList.remove('hidden');
            try {
                const { collection, addDoc, serverTimestamp } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
                const planDataToShare = {
                    formData: this.state.formData,
                    dailyPlan: this.state.dailyPlanData,
                    originalPlanId: this.state.currentPlanId, 
                    sharedAt: serverTimestamp()
                };
                const publicPlansRef = collection(firestoreDb, `artifacts/${currentAppId}/public/plans`);
                const sharedDocRef = await addDoc(publicPlansRef, planDataToShare);
                const shareId = sharedDocRef.id;
                const shareUrl = `${window.location.origin}${window.location.pathname}?plan=${shareId}`;
                const textArea = document.createElement("textarea");
                textArea.value = shareUrl;
                textArea.style.position = "fixed"; textArea.style.left = "-9999px";
                document.body.appendChild(textArea);
                textArea.focus(); textArea.select();
                try {
                    document.execCommand('copy'); 
                    this.showModal(`Share link copied to clipboard:\n${shareUrl}`, 5000);
                } catch (err) { this.showModal(`Share this link:\n${shareUrl}`, 10000); }
                document.body.removeChild(textArea);
            } catch (error) {
                console.error("Error sharing plan:", error);
                this.showModal("Error creating share link. Please try again.");
            } finally {
                if (this.elements.loadingOverlay) this.elements.loadingOverlay.classList.add('hidden');
            }
        },
        loadSharedPlan: async function(planId) {
            if (!planId || !firestoreDb) {
                this.showModal("Invalid plan link or database connection error.");
                if (this.elements.loadingOverlay) this.elements.loadingOverlay.classList.add('hidden');
                this.resetApp(); return;
            }
            if (!this.elements.loadingOverlay) return;
            this.elements.loadingText.textContent = "Loading shared plan...";
            this.elements.loadingOverlay.classList.remove('hidden');
            try {
                const { doc, getDoc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
                const planDocRef = doc(firestoreDb, `artifacts/${currentAppId}/public/plans`, planId);
                const docSnap = await getDoc(planDocRef);
                if (docSnap.exists()) {
                    const planData = docSnap.data();
                    this.state.formData = planData.formData || { mustVisitPlaces: [] }; 
                    this.state.dailyPlanData = planData.dailyPlan || {};
                    this.state.currentPlanId = null; 
                    this.state.isPlanSaved = false; 
                    if (!Array.isArray(this.state.formData.mustVisitPlaces)) { this.state.formData.mustVisitPlaces = []; }
                    if (!this.state.formData.hotel_location?.latitude) {
                        throw new Error("Shared plan data is missing hotel location.");
                    }
                    this.switchPhase('result-container');
                    setTimeout(() => this.displayResults(this.state.formData.hotel_location), 100);
                } else {
                    this.showModal("Could not find the shared plan. The link may be invalid or expired.");
                    this.resetApp(); 
                }
            } catch (error) {
                this.showModal(`Error loading shared plan: ${error.message}`);
                this.resetApp(); 
            } finally {
                if (this.elements.loadingOverlay) this.elements.loadingOverlay.classList.add('hidden');
            }
        },
        loadMySavedPlans: async function() {
            const savedPlansList = document.getElementById('saved-plans-list');
            if (!savedPlansList) { return; }
            if (!currentUserId || !firestoreDb) {
                savedPlansList.innerHTML = '<p>Log in to see your saved plans.</p>';
                const loginBtn = document.createElement('button');
                loginBtn.textContent = "Go to Settings to Log In";
                loginBtn.className = "auth-button google-login"; 
                loginBtn.onclick = () => (this.elements.tabSettings || document.getElementById('desktop-tab-settings'))?.click();
                savedPlansList.appendChild(loginBtn);
                return;
            }
             savedPlansList.innerHTML = '<p>Loading your saved plans...</p>';
            try {
                const { collection, query, where, getDocs, orderBy } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
                const plansCollectionRef = collection(firestoreDb, `artifacts/${currentAppId}/users/${currentUserId}/plans`);
                const q = query(plansCollectionRef, orderBy("createdAt", "desc"));
                const querySnapshot = await getDocs(q);
                if (querySnapshot.empty) {
                     savedPlansList.innerHTML = '<p>You have no saved plans yet.</p>';
                     return;
                }
                savedPlansList.innerHTML = ''; 
                querySnapshot.forEach((doc) => {
                    const plan = doc.data();
                    const planId = doc.id;
                    const planCard = document.createElement('div');
                    planCard.className = 'saved-plan-card';
                    planCard.innerHTML = `
                        <h4>${plan.planName || (plan.formData?.destination || 'Untitled Plan')}</h4>
                        <p>Date: ${plan.formData?.startDate || 'N/A'}</p>
                        <p>Duration: ${plan.formData?.duration || 'N/A'} days</p>
                    `;
                    planCard.onclick = () => {
                        // [v9.1.0] 저장된 플랜 클릭 시 상태 복원 및 이동
                        this.state.formData = plan.formData;
                        this.state.dailyPlanData = plan.dailyPlan;
                        this.state.currentPlanId = planId; 
                        this.state.isPlanSaved = true; 
                        (this.elements.tabMain || this.elements.desktopTabMain).click(); 
                        this.switchPhase('result-container'); 
                        setTimeout(() => this.displayResults(this.state.formData.hotel_location), 100);
                    };
                    savedPlansList.appendChild(planCard);
                });
            } catch (error) {
                 console.error("Error loading saved plans:", error);
                 savedPlansList.innerHTML = '<p style="color:red;">Error loading saved plans. Please try again.</p>';
            }
        }
    }; 
try {
        window.HolidayHubApp = HolidayHubApp; 
        HolidayHubApp.updateUser(currentUserId);
        HolidayHubApp.start(); 
    } catch (e) { console.error(e); }
};
window.scriptJsReady = true;
if (window.startHolidayHubApp) window.startHolidayHubApp();