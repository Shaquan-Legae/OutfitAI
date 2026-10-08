// static/js/recommendations.js - OutfitAI Stylist & Suggestions

document.addEventListener('DOMContentLoaded', () => {
    // --- STATE VARIABLES ---
    let userLocation = { lat: null, lon: null };
    let attachedImageBase64 = null;
    let lastSuggestedOutfit = null;
    let currentDisplayedResult = null;
    let activeOutfitContext = null;
    let autoVoiceEnabled = localStorage.getItem('outfitai_auto_voice') === 'true';
    let currentVoiceName = localStorage.getItem('outfitai_voice_name') || 'Kore';
    let currentVoiceSpeed = parseFloat(localStorage.getItem('outfitai_voice_speed') || '1.0');
    let currentAudioPlayer = null;
    let speechRecognition = null;
    let isRecordingVoice = false;

    // In-memory Client Audio Cache: Instant (0ms) playback on repeat clicks
    const audioCache = new Map();

    const CACHE_KEY = 'weatherDataCache';
    const CACHE_DURATION_MS = 30 * 60 * 1000;

    // --- DOM ELEMENTS ---
    const weatherWidget = document.getElementById('weather-widget');
    const weatherIcon = weatherWidget ? weatherWidget.querySelector('.weather-icon') : null;
    const weatherTemp = weatherWidget ? weatherWidget.querySelector('.weather-temp') : null;
    const weatherDesc = weatherWidget ? weatherWidget.querySelector('.weather-desc') : null;
    const weatherCity = weatherWidget ? weatherWidget.querySelector('.weather-city') : null;
    const weatherFeelsLike = weatherWidget ? weatherWidget.querySelector('.weather-feels-like') : null;
    const extraDetailsPanel = document.getElementById('weather-extra-details');
    const dataWind = document.getElementById('data-wind');
    const dataHumidity = document.getElementById('data-humidity');
    const dataVis = document.getElementById('data-vis');
    const dataUv = document.getElementById('data-uv');
    const sunriseTimeEl = document.getElementById('sunrise-time');
    const sunsetTimeEl = document.getElementById('sunset-time');
    const hourlyContainer = document.getElementById('hourly-forecast-container');

    const suggestionBtn = document.getElementById('get-suggestion-btn');
    const openSavedLooksBtn = document.getElementById('open-saved-looks-btn');
    const savedLooksCounter = document.getElementById('saved-looks-counter');
    const suggestionCard = document.getElementById('suggestion-output');
    const loadingMessage = suggestionCard ? suggestionCard.querySelector('.loading-message') : null;
    const suggestionContent = document.getElementById('suggestion-content');
    const suggestionErrorState = document.getElementById('suggestion-error-state');
    const errorStateTitle = document.getElementById('error-state-title');
    const errorStateMessage = document.getElementById('error-state-message');
    const errorStateMetrics = document.getElementById('error-state-metrics');
    const errorStateIcon = document.getElementById('error-state-icon');
    const errorActionClearExcludes = document.getElementById('error-action-clear-excludes');
    const errorActionAskStylist = document.getElementById('error-action-ask-stylist');

    const suggestionGreeting = document.getElementById('suggestion-greeting');
    const weatherTrajectoryBanner = document.getElementById('weather-trajectory-banner');
    const weatherTrajectoryText = document.getElementById('weather-trajectory-text');
    const outfitDisplayArea = document.getElementById('outfit-display-area');
    const whyItWorksText = document.getElementById('why-it-works-text');
    const notesText = document.getElementById('notes-text');
    const getAnotherSuggestionBtn = document.getElementById('get-another-suggestion-btn');
    const discussOutfitBtn = document.getElementById('discuss-outfit-btn');
    const saveOutfitBtn = document.getElementById('save-outfit-btn');
    const savedOutfitsContainer = document.getElementById('saved-outfits-container');

    // Lookbook Drawer Elements
    const drawerOverlay = document.getElementById('drawer-overlay');
    const savedLooksDrawer = document.getElementById('saved-looks-drawer');
    const closeSavedLooksBtn = document.getElementById('close-saved-looks-btn');
    const savedLooksList = document.getElementById('saved-looks-list');
    const savedLooksEmpty = document.getElementById('saved-looks-empty');

    // Chatbot Elements
    const fabChat = document.getElementById('fab-chat');
    const chatWidget = document.getElementById('chat-widget');
    const chatCloseBtn = document.getElementById('chat-close-btn');
    const chatClearBtn = document.getElementById('chat-clear-btn');
    const chatVoiceToggle = document.getElementById('chat-voice-toggle');
    const voiceToggleIcon = document.getElementById('voice-toggle-icon');
    const chatVoiceSettingsBtn = document.getElementById('chat-voice-settings-btn');
    const chatVoicePanel = document.getElementById('chat-voice-panel');
    const voiceSpeedControls = document.getElementById('voice-speed-controls');

    const chatActiveOutfitBanner = document.getElementById('chat-active-outfit-banner');
    const toggleActiveLookSummary = document.getElementById('toggle-active-look-summary');
    const activeLookDetails = document.getElementById('active-look-details');
    const activeLookTitle = document.getElementById('active-look-title');
    const activeLookChips = document.getElementById('active-look-chips');
    const activeLookChevron = document.getElementById('active-look-chevron');
    const activeLookQuickQuestions = document.getElementById('active-look-quick-questions');

    const chatMessages = document.getElementById('chat-messages');
    const chatForm = document.getElementById('chat-form');
    const chatInput = document.getElementById('chat-input');
    const chatAttachmentBtn = document.getElementById('chat-attachment-btn');
    const chatFileInput = document.getElementById('chat-file-input');
    const chatAttachmentPreview = document.getElementById('chat-attachment-preview');
    const previewImage = document.getElementById('preview-image');
    const removeAttachmentBtn = document.getElementById('remove-attachment-btn');
    const chatMicBtn = document.getElementById('chat-mic-btn');
    const micRecordingIndicator = document.getElementById('mic-recording-indicator');
    const micCancelBtn = document.getElementById('mic-cancel-btn');
    const quickPrompts = document.getElementById('chat-quick-prompts');

    // --- WEATHER LOGIC ---
    function showWeatherError(message) {
        if (!weatherWidget) return;
        weatherWidget.classList.remove('loading', 'clickable', 'active');
        weatherWidget.classList.add('error');
        if (weatherCity) weatherCity.textContent = 'Weather Unavailable';
        if (weatherDesc) weatherDesc.textContent = message;
        if (weatherTemp) weatherTemp.textContent = '--';
        if (weatherFeelsLike) weatherFeelsLike.textContent = '';
        if (extraDetailsPanel) extraDetailsPanel.classList.remove('open');
        if (suggestionBtn) suggestionBtn.disabled = true;
        if (hourlyContainer) hourlyContainer.innerHTML = `<span class="text-xs text-red-300">Could not retrieve atmospheric data.</span>`;
        try { sessionStorage.removeItem(CACHE_KEY); } catch (e) { }
    }

    function updateWeatherUI(data) {
        if (!weatherWidget) return;
        if (weatherTemp) weatherTemp.textContent = `${Math.round(data.temp)}°C`;
        if (weatherDesc) weatherDesc.textContent = data.description;
        if (weatherCity) {
            weatherCity.textContent = data.local_time ? `${data.city} (${data.local_time})` : data.city;
        }
        if (weatherFeelsLike) weatherFeelsLike.textContent = `Feels like: ${Math.round(data.feels_like)}°C`;

        if (weatherIcon) {
            weatherIcon.innerHTML = '';
            const iconImg = document.createElement('img');
            iconImg.src = data.icon.startsWith('//') ? `https:${data.icon}` : data.icon;
            iconImg.alt = data.description;
            iconImg.className = 'w-10 h-10 object-contain drop-shadow-sm';
            weatherIcon.appendChild(iconImg);
        }

        if (dataWind) dataWind.textContent = `${data.wind_kph} kph`;
        if (dataHumidity) dataHumidity.textContent = `${data.humidity} %`;
        if (dataVis) dataVis.textContent = `${data.vis_km} km`;
        if (dataUv) dataUv.textContent = data.uv;
        if (sunriseTimeEl) sunriseTimeEl.textContent = data.sunrise || '--:--';
        if (sunsetTimeEl) sunsetTimeEl.textContent = data.sunset || '--:--';

        renderHourlyForecast(data.hourly_forecast);
        weatherWidget.classList.remove('loading');
        weatherWidget.classList.add('clickable');
        if (suggestionBtn) suggestionBtn.disabled = false;
    }

    function renderHourlyForecast(hourly) {
        if (!hourlyContainer) return;
        hourlyContainer.innerHTML = '';
        if (!hourly || hourly.length === 0) {
            hourlyContainer.innerHTML = `<span class="text-xs text-[#706D65] italic w-full text-center py-2">Hourly forecast unavailable.</span>`;
            return;
        }

        const fragment = document.createDocumentFragment();
        hourly.forEach(hour => {
            const hourDiv = document.createElement('div');
            const isNow = hour.rel_label === 'Now';
            hourDiv.className = `hour-item flex flex-col items-center justify-between p-2 rounded-xl border text-center transition-all min-w-[58px] flex-shrink-0 ${isNow ? 'bg-[#FDF3EE] border-[#BA512A]/40 ring-1 ring-[#BA512A]/20' : 'bg-white border-[#E5E2DA]'}`;
            hourDiv.innerHTML = `
                <div class="flex flex-col items-center">
                    <span class="text-[9px] font-bold ${isNow ? 'text-[#BA512A] uppercase' : 'text-[#706D65]'}">${hour.rel_label || ''}</span>
                    <span class="hour-time font-semibold text-[11px] text-[#181715]">${hour.time}</span>
                </div>
                <img src="${hour.condition_icon || ''}" alt="" class="w-6 h-6 my-1 object-contain" onerror="this.style.display='none'">
                <span class="hour-temp font-tabular font-bold text-xs text-[#181715]">${Math.round(hour.temp_c)}°</span>
                ${hour.chance_of_rain > 0 ? `<span class="hour-rain font-tabular text-[10px] text-sky-600 font-medium"><i class="fa-solid fa-umbrella text-[8px]"></i> ${hour.chance_of_rain}%</span>` : ''}
            `;
            fragment.appendChild(hourDiv);
        });
        hourlyContainer.appendChild(fragment);
    }

    async function fetchWeather() {
        try {
            const cachedString = sessionStorage.getItem(CACHE_KEY);
            if (cachedString) {
                const cachedData = JSON.parse(cachedString);
                if (Date.now() - cachedData.timestamp < CACHE_DURATION_MS && cachedData.weather) {
                    updateWeatherUI(cachedData.weather);
                    userLocation = cachedData.location;
                    if (suggestionBtn) suggestionBtn.disabled = false;
                    return;
                }
            }
        } catch (e) {
            console.warn("Weather cache read error:", e);
        }

        if (!navigator.geolocation) {
            showWeatherError("Geolocation is not supported by your browser.");
            return;
        }

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                userLocation = {
                    lat: position.coords.latitude,
                    lon: position.coords.longitude
                };
                await getWeatherData(userLocation.lat, userLocation.lon);
            },
            (error) => {
                console.warn("Geolocation permission error:", error);
                // Fallback to Mbombela / Nelspruit coordinates for consistent context
                userLocation = { lat: -25.4753, lon: 30.9694 };
                getWeatherData(userLocation.lat, userLocation.lon);
            },
            { timeout: 10000, enableHighAccuracy: false }
        );
    }

    async function getWeatherData(lat, lon) {
        try {
            const res = await fetch('/api/weather', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ lat, lon })
            });
            if (!res.ok) throw new Error("Could not retrieve atmospheric data.");
            const data = await res.json();
            updateWeatherUI(data);

            try {
                sessionStorage.setItem(CACHE_KEY, JSON.stringify({
                    timestamp: Date.now(),
                    weather: data,
                    location: { lat, lon }
                }));
            } catch (e) { }
        } catch (err) {
            showWeatherError(err.message);
        }
    }

    if (weatherWidget) {
        weatherWidget.addEventListener('click', () => {
            if (weatherWidget.classList.contains('loading') || weatherWidget.classList.contains('error')) return;
            weatherWidget.classList.toggle('active');
            if (extraDetailsPanel) extraDetailsPanel.classList.toggle('open');
        });
    }

    // --- OUTFIT RECOMMENDATIONS & ERROR STATES LOGIC ---
    async function getOutfitSuggestion(resetExclusions = false) {
        if (!userLocation.lat || !userLocation.lon) {
            alert("Waiting for weather location coordinates. Please allow location access.");
            return;
        }

        if (resetExclusions) {
            lastSuggestedOutfit = null;
        }

        suggestionCard.classList.remove('hidden');
        suggestionCard.classList.add('flex');
        loadingMessage.classList.remove('hidden');
        suggestionContent.classList.add('hidden');
        if (suggestionErrorState) suggestionErrorState.classList.add('hidden');
        suggestionBtn.disabled = true;

        const excludeIds = lastSuggestedOutfit ? lastSuggestedOutfit.map(i => i.id).filter(Boolean) : [];

        try {
            const res = await fetch('/api/recommendations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    lat: userLocation.lat,
                    lon: userLocation.lon,
                    exclude_item_ids: excludeIds
                })
            });

            const result = await res.json();
            loadingMessage.classList.add('hidden');
            suggestionBtn.disabled = false;

            // Handle No Outfit Generated Error State
            if (result.error || result.missing_item_suggestion) {
                renderOutfitErrorState(result, excludeIds);
                return;
            }

            // Successful Outfit Generation
            if (suggestionErrorState) suggestionErrorState.classList.add('hidden');
            suggestionContent.classList.remove('hidden');

            currentDisplayedResult = result;
            activeOutfitContext = result;
            renderSuggestionResult(result);
            updateActiveLookChatBanner(result);

        } catch (err) {
            loadingMessage.classList.add('hidden');
            suggestionBtn.disabled = false;
            renderOutfitErrorState({ error: `Connection to styling engine failed: ${err.message}` }, excludeIds);
        }
    }

    function renderOutfitErrorState(result, excludeIds = []) {
        if (!suggestionErrorState) return;
        suggestionContent.classList.add('hidden');
        suggestionErrorState.classList.remove('hidden');

        if (result.missing_item_suggestion) {
            errorStateTitle.textContent = "Wardrobe Missing Pieces for Upcoming Weather";
            errorStateMessage.textContent = `${result.missing_item_suggestion.message} Recommendation: ${result.missing_item_suggestion.recommendation}`;
            if (errorStateIcon) errorStateIcon.className = "fa-solid fa-cloud-sun-rain text-xl";
        } else {
            errorStateTitle.textContent = "Unable to Assemble a Complete Outfit";
            errorStateMessage.textContent = result.error || "No available combination matches current climate parameters.";
            if (errorStateIcon) errorStateIcon.className = "fa-solid fa-vest text-xl";
        }

        // Metrics breakdown
        if (errorStateMetrics) {
            errorStateMetrics.innerHTML = '';
            if (result.laundry_count !== undefined && result.laundry_count > 0) {
                const laundryPill = document.createElement('span');
                laundryPill.className = "px-3 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-full text-[11px] font-semibold";
                laundryPill.innerHTML = `<i class="fa-solid fa-soap mr-1 text-amber-600"></i> ${result.laundry_count} Piece${result.laundry_count > 1 ? 's' : ''} in Laundry`;
                errorStateMetrics.appendChild(laundryPill);
            }

            if (result.total_items !== undefined) {
                const availableCount = Math.max(0, (result.total_items || 0) - (result.laundry_count || 0));
                const totalPill = document.createElement('span');
                totalPill.className = "px-3 py-1 bg-[#F3F1EC] text-[#181715] border border-[#E5E2DA] rounded-full text-[11px] font-semibold";
                totalPill.innerHTML = `<i class="fa-solid fa-shirt mr-1 text-[#706D65]"></i> ${availableCount} Ready to Wear`;
                errorStateMetrics.appendChild(totalPill);
            }

            if (excludeIds.length > 0) {
                const exclPill = document.createElement('span');
                exclPill.className = "px-3 py-1 bg-[#FDF3EE] text-[#BA512A] border border-[#F6DACD] rounded-full text-[11px] font-semibold";
                exclPill.innerHTML = `<i class="fa-solid fa-filter mr-1"></i> ${excludeIds.length} Past Outfits Excluded`;
                errorStateMetrics.appendChild(exclPill);
            }
        }
    }

    if (errorActionClearExcludes) {
        errorActionClearExcludes.addEventListener('click', () => {
            getOutfitSuggestion(true);
        });
    }

    if (errorActionAskStylist) {
        errorActionAskStylist.addEventListener('click', () => {
            openChatWithPrompt("My wardrobe couldn't generate an outfit for today's weather. What pieces should I add or how should I adapt?");
        });
    }

    function renderSuggestionResult(result) {
        if (!result.outfit_details || result.outfit_details.length === 0) return;

        suggestionGreeting.textContent = result.greeting || "Here is your curated look:";
        whyItWorksText.textContent = result.why_it_works || "Coordinated for comfort and style balance.";
        notesText.textContent = result.notes || "Wear with confidence!";
        lastSuggestedOutfit = result.outfit_details.map(item => ({ id: item.id || item.filename }));

        // Hourly Weather Trajectory Banner
        if (result.weather_insight && weatherTrajectoryBanner && weatherTrajectoryText) {
            weatherTrajectoryText.textContent = result.weather_insight;
            weatherTrajectoryBanner.classList.remove('hidden');
        } else if (weatherTrajectoryBanner) {
            weatherTrajectoryBanner.classList.add('hidden');
        }

        outfitDisplayArea.innerHTML = '';
        const fragment = document.createDocumentFragment();

        result.outfit_details.forEach(item => {
            const card = document.createElement('div');
            card.className = 'outfit-item group';
            const imgUrl = item.imageUrl || item.url || '/static/uploads/' + (item.filename || '');
            const typeLabel = item.type || item.category || 'Wardrobe Item';
            const subcatDetail = item.subcategory && item.subcategory !== item.name ? ` · ${item.subcategory}` : '';

            card.innerHTML = `
                <div class="image-box">
                    <img src="${imgUrl}" alt="${item.name}" loading="lazy" onerror="this.src='https://placehold.co/240x280/F3F1EC/706D65?text=Item'">
                    <span class="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[9px] font-bold bg-[#181715]/80 text-[#FAF9F6] backdrop-blur-sm uppercase tracking-wider">${typeLabel}</span>
                </div>
                <div class="outfit-item-info">
                    <h4>${item.name || 'Unnamed piece'}</h4>
                    <p>${typeLabel}${subcatDetail}</p>
                </div>
            `;

            // Clicking an item opens chat to ask the stylist about it
            card.addEventListener('click', () => {
                openChatWithPrompt(`Can you recommend an alternative or how to best style my "${item.name}" in this outfit?`);
            });

            fragment.appendChild(card);
        });

        outfitDisplayArea.appendChild(fragment);

        // Reset save button state
        saveOutfitBtn.classList.remove('hidden');
        saveOutfitBtn.innerHTML = '<i class="fa-regular fa-heart mr-1.5 text-xs"></i> Save Look';
        saveOutfitBtn.disabled = false;
    }

    if (suggestionBtn) suggestionBtn.addEventListener('click', () => getOutfitSuggestion(false));
    if (getAnotherSuggestionBtn) getAnotherSuggestionBtn.addEventListener('click', () => getOutfitSuggestion(false));

    // Discuss current outfit directly with AI stylist
    if (discussOutfitBtn) {
        discussOutfitBtn.addEventListener('click', () => {
            toggleChat(true);
            if (activeOutfitContext && activeOutfitContext.outfit_details) {
                const names = activeOutfitContext.outfit_details.map(i => i.name).slice(0, 2).join(' and ');
                chatInput.value = `I love this combination with ${names}. How should I accessorize or style it for today's weather?`;
                chatInput.focus();
            }
        });
    }

    // Save look button (Persists to Firestore + Local)
    if (saveOutfitBtn) {
        saveOutfitBtn.addEventListener('click', async () => {
            if (!currentDisplayedResult || !currentDisplayedResult.outfit_details) return;

            saveOutfitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1.5 text-xs"></i> Saving...';
            saveOutfitBtn.disabled = true;

            try {
                const res = await fetch('/api/outfits/save', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(currentDisplayedResult)
                });
                const data = await res.json();
                if (data.status === 'success') {
                    saveOutfitBtn.innerHTML = '<i class="fa-solid fa-heart mr-1.5 text-xs text-[#BA512A]"></i> Look Saved';
                    loadSavedOutfits();
                } else {
                    saveOutfitBtn.innerHTML = '<i class="fa-regular fa-heart mr-1.5 text-xs"></i> Save Look';
                    saveOutfitBtn.disabled = false;
                }
            } catch (err) {
                console.error("Save outfit error:", err);
                saveOutfitBtn.innerHTML = '<i class="fa-regular fa-heart mr-1.5 text-xs"></i> Save Look';
                saveOutfitBtn.disabled = false;
            }
        });
    }

    // --- SAVED LOOKS (LOOKBOOK) LOGIC ---
    async function loadSavedOutfits() {
        try {
            const res = await fetch('/api/outfits/saved');
            if (!res.ok) return;
            const data = await res.json();
            const outfits = data.saved_outfits || [];

            if (savedLooksCounter) {
                savedLooksCounter.textContent = outfits.length;
            }

            renderSavedLooksDrawer(outfits);
        } catch (e) {
            console.error("Failed to load saved outfits:", e);
        }
    }

    function renderSavedLooksDrawer(outfits) {
        if (!savedLooksList) return;
        savedLooksList.innerHTML = '';

        if (!outfits || outfits.length === 0) {
            if (savedLooksEmpty) {
                savedLooksList.appendChild(savedLooksEmpty);
                savedLooksEmpty.classList.remove('hidden');
            }
            return;
        }

        const fragment = document.createDocumentFragment();

        outfits.forEach(outfit => {
            const card = document.createElement('div');
            card.className = 'bg-white border border-[#E5E2DA] rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow';

            // Items mini thumbnail gallery
            const items = outfit.outfit_details || [];
            let thumbsHtml = '';
            items.forEach(itm => {
                const img = itm.imageUrl || itm.url || '';
                thumbsHtml += `
                    <div class="w-14 h-16 rounded-lg bg-[#F8F6F2] border border-[#E5E2DA] overflow-hidden flex-shrink-0" title="${itm.name}">
                        <img src="${img}" alt="${itm.name}" class="w-full h-full object-cover" onerror="this.src='https://placehold.co/100x120/F3F1EC/706D65?text=Piece'">
                    </div>
                `;
            });

            // Date & Weather note
            const savedDate = outfit.saved_at ? new Date(outfit.saved_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'Saved Look';
            const weatherSnap = outfit.weather_snapshot || {};
            const weatherLabel = weatherSnap.temp ? `${Math.round(weatherSnap.temp)}°C · ${weatherSnap.city || 'Local'}` : 'Curated Look';

            card.innerHTML = `
                <div class="flex items-start justify-between gap-2 mb-2">
                    <div>
                        <span class="text-[9px] font-bold uppercase tracking-wider text-[#BA512A] block">${savedDate} · ${weatherLabel}</span>
                        <h4 class="text-xs font-bold text-[#181715] line-clamp-1">${outfit.greeting || 'Curated Look'}</h4>
                    </div>
                    <button class="delete-saved-btn text-[#99958C] hover:text-red-600 p-1 rounded transition-colors text-xs" title="Remove saved look">
                        <i class="fa-regular fa-trash-can"></i>
                    </button>
                </div>

                <div class="flex items-center gap-2 overflow-x-auto hide-scroll py-1.5 mb-3">
                    ${thumbsHtml}
                </div>

                <div class="flex items-center gap-2 pt-2 border-t border-[#F0ECE1]">
                    <button class="wear-saved-btn btn-atelier btn-atelier-accent flex-1 text-[11px] py-1.5">
                        <i class="fa-solid fa-eye mr-1 text-[10px]"></i> View Look
                    </button>
                    <button class="chat-saved-btn btn-atelier btn-atelier-secondary flex-1 text-[11px] py-1.5">
                        <i class="fa-solid fa-comment-dots mr-1 text-[10px] text-[#BA512A]"></i> Ask Stylist
                    </button>
                </div>
            `;

            // Card Action Listeners
            const wearBtn = card.querySelector('.wear-saved-btn');
            wearBtn.addEventListener('click', () => {
                currentDisplayedResult = outfit;
                activeOutfitContext = outfit;
                suggestionCard.classList.remove('hidden');
                suggestionCard.classList.add('flex');
                if (suggestionErrorState) suggestionErrorState.classList.add('hidden');
                suggestionContent.classList.remove('hidden');
                renderSuggestionResult(outfit);
                updateActiveLookChatBanner(outfit);
                closeSavedLooksModal();
                window.scrollTo({ top: suggestionCard.offsetTop - 80, behavior: 'smooth' });
            });

            const chatBtn = card.querySelector('.chat-saved-btn');
            chatBtn.addEventListener('click', () => {
                activeOutfitContext = outfit;
                updateActiveLookChatBanner(outfit);
                closeSavedLooksModal();
                toggleChat(true);
                chatInput.value = `Can you give me styling advice for this saved outfit?`;
                chatInput.focus();
            });

            const delBtn = card.querySelector('.delete-saved-btn');
            delBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (!confirm("Remove this look from your lookbook?")) return;
                try {
                    await fetch('/api/outfits/delete', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ id: outfit.id })
                    });
                    loadSavedOutfits();
                } catch (err) {
                    console.error("Delete outfit error:", err);
                }
            });

            fragment.appendChild(card);
        });

        savedLooksList.appendChild(fragment);
    }

    function openSavedLooksModal() {
        if (!savedLooksDrawer || !drawerOverlay) return;
        loadSavedOutfits();
        savedLooksDrawer.classList.add('open');
        drawerOverlay.classList.add('open');
    }

    function closeSavedLooksModal() {
        if (!savedLooksDrawer || !drawerOverlay) return;
        savedLooksDrawer.classList.remove('open');
        drawerOverlay.classList.remove('open');
    }

    if (openSavedLooksBtn) openSavedLooksBtn.addEventListener('click', openSavedLooksModal);
    if (closeSavedLooksBtn) closeSavedLooksBtn.addEventListener('click', closeSavedLooksModal);
    if (drawerOverlay) drawerOverlay.addEventListener('click', closeSavedLooksModal);

    // --- CHATBOT WITH ACTIVE LOOK CONTEXT, VOICE PERSONA & PACE ADJUSTMENT ---

    // Toggle Chat Widget
    function toggleChat(forceOpen = null) {
        const isOpen = forceOpen !== null ? forceOpen : !chatWidget.classList.contains('open');
        if (isOpen) {
            chatWidget.classList.add('open');
            chatInput.focus();
            loadChatHistory();
        } else {
            chatWidget.classList.remove('open');
            stopAudioPlayback();
        }
    }

    if (fabChat) fabChat.addEventListener('click', () => toggleChat());
    if (chatCloseBtn) chatCloseBtn.addEventListener('click', () => toggleChat(false));

    function openChatWithPrompt(promptText) {
        toggleChat(true);
        chatInput.value = promptText;
        chatInput.focus();
    }

    // Update Auto-Voice Toggle UI
    function updateVoiceToggleUI() {
        if (!chatVoiceToggle || !voiceToggleIcon) return;
        if (autoVoiceEnabled) {
            chatVoiceToggle.classList.add('text-[#BA512A]', 'bg-[#FDF3EE]');
            chatVoiceToggle.classList.remove('text-[#FAF9F6]/75');
            voiceToggleIcon.className = 'fa-solid fa-volume-high text-xs text-[#BA512A]';
            chatVoiceToggle.title = 'Gemini Voice Auto-Read: Enabled';
        } else {
            chatVoiceToggle.classList.remove('text-[#BA512A]', 'bg-[#FDF3EE]');
            chatVoiceToggle.classList.add('text-[#FAF9F6]/75');
            voiceToggleIcon.className = 'fa-solid fa-volume-xmark text-xs';
            chatVoiceToggle.title = 'Gemini Voice Auto-Read: Disabled (Click to enable)';
        }
    }
    updateVoiceToggleUI();

    if (chatVoiceToggle) {
        chatVoiceToggle.addEventListener('click', () => {
            autoVoiceEnabled = !autoVoiceEnabled;
            localStorage.setItem('outfitai_auto_voice', autoVoiceEnabled ? 'true' : 'false');
            updateVoiceToggleUI();
        });
    }

    // Voice Settings Popdown Panel Toggle
    if (chatVoiceSettingsBtn && chatVoicePanel) {
        chatVoiceSettingsBtn.addEventListener('click', () => {
            chatVoicePanel.classList.toggle('open');
            chatVoiceSettingsBtn.classList.toggle('bg-white/10');
        });
    }

    // Voice Speed Selector
    if (voiceSpeedControls) {
        const speedButtons = voiceSpeedControls.querySelectorAll('.speed-pill');
        speedButtons.forEach(btn => {
            const spd = parseFloat(btn.getAttribute('data-speed'));
            if (spd === currentVoiceSpeed) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }

            btn.addEventListener('click', () => {
                speedButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentVoiceSpeed = spd;
                localStorage.setItem('outfitai_voice_speed', spd.toString());

                // Update playing audio immediately in real-time
                if (currentAudioPlayer) {
                    currentAudioPlayer.playbackRate = currentVoiceSpeed;
                }
            });
        });
    }

    // Voice Persona Selector
    const voicePersonaButtons = document.querySelectorAll('.voice-persona-chip');
    voicePersonaButtons.forEach(btn => {
        const vName = btn.getAttribute('data-voice');
        if (vName === currentVoiceName) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }

        btn.addEventListener('click', () => {
            voicePersonaButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentVoiceName = vName;
            localStorage.setItem('outfitai_voice_name', vName);
        });
    });

    // Update Active Look Banner in Chat
    function updateActiveLookChatBanner(outfitData) {
        if (!chatActiveOutfitBanner || !outfitData || !outfitData.outfit_details) return;

        const items = outfitData.outfit_details;
        const names = items.map(i => i.name).slice(0, 2).join(' + ');
        if (activeLookTitle) {
            activeLookTitle.textContent = `Look on Screen: ${names}`;
        }

        if (activeLookChips) {
            activeLookChips.innerHTML = '';
            items.forEach(itm => {
                const chip = document.createElement('div');
                chip.className = 'flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white border border-[#E5E2DA] flex-shrink-0 text-[10px] text-[#181715]';
                const img = itm.imageUrl || itm.url || '';
                chip.innerHTML = `
                    <img src="${img}" class="w-4 h-4 rounded object-cover" onerror="this.style.display='none'">
                    <span class="font-semibold truncate max-w-[120px]">${itm.name}</span>
                `;
                activeLookChips.appendChild(chip);
            });
        }

        chatActiveOutfitBanner.classList.remove('hidden');
    }

    if (toggleActiveLookSummary && activeLookDetails && activeLookChevron) {
        toggleActiveLookSummary.addEventListener('click', () => {
            const isHidden = activeLookDetails.classList.contains('hidden');
            if (isHidden) {
                activeLookDetails.classList.remove('hidden');
                activeLookChevron.classList.add('rotate-180');
            } else {
                activeLookDetails.classList.add('hidden');
                activeLookChevron.classList.remove('rotate-180');
            }
        });
    }

    if (activeLookQuickQuestions) {
        activeLookQuickQuestions.querySelectorAll('.prompt-chip').forEach(btn => {
            btn.addEventListener('click', () => {
                const prompt = btn.getAttribute('data-prompt');
                if (prompt) {
                    chatInput.value = prompt;
                    chatForm.dispatchEvent(new Event('submit'));
                }
            });
        });
    }

    // Stop current audio playback immediately (both HTML5 and SpeechSynthesis)
    function stopAudioPlayback() {
        if (currentAudioPlayer) {
            currentAudioPlayer.pause();
            currentAudioPlayer = null;
        }
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
            window.speechSynthesis.cancel();
        }
        document.querySelectorAll('.msg-voice-btn.playing').forEach(btn => {
            btn.classList.remove('playing');
            btn.innerHTML = '<i class="fa-solid fa-volume-high text-[9px]"></i> <span>Listen</span>';
        });
    }

    // Background prefetch audio so studio-quality speech is ready in cache
    function prefetchAudio(text) {
        if (!text) return;
        const cleanText = text.replace(/[*_#`~]/g, '').trim();
        const cacheKey = `${currentVoiceName}:${cleanText}`;
        if (audioCache.has(cacheKey)) return;
        fetch('/api/chatbot/tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: cleanText, voice: currentVoiceName })
        }).then(r => r.json()).then(data => {
            if (data && data.audio_base64) {
                audioCache.set(cacheKey, data.audio_base64);
            }
        }).catch(() => {});
    }

    // Instant browser speech synthesis (starts in <15ms with 0 network latency)
    function playInstantBrowserSpeech(cleanText, voiceBtn) {
        if (!('speechSynthesis' in window)) return;
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.rate = currentVoiceSpeed || 1.0;

        // Apply distinct vocal timbre and pitch for selected persona
        if (currentVoiceName === 'Aoede') {
            utterance.pitch = 1.15;
        } else if (currentVoiceName === 'Puck') {
            utterance.pitch = 1.3;
        } else if (currentVoiceName === 'Charon') {
            utterance.pitch = 0.82;
        } else if (currentVoiceName === 'Fenrir') {
            utterance.pitch = 0.72;
        } else {
            utterance.pitch = 1.0;
        }

        const voices = window.speechSynthesis.getVoices();
        if (voices && voices.length > 0) {
            const eng = voices.filter(v => v.lang.startsWith('en'));
            if (eng.length > 0) {
                if (currentVoiceName === 'Charon' || currentVoiceName === 'Fenrir') {
                    const m = eng.find(v => v.name.toLowerCase().includes('male') || v.name.toLowerCase().includes('david') || v.name.toLowerCase().includes('daniel') || v.name.toLowerCase().includes('george') || v.name.toLowerCase().includes('alex'));
                    if (m) utterance.voice = m;
                } else if (currentVoiceName === 'Aoede' || currentVoiceName === 'Kore') {
                    const f = eng.find(v => v.name.toLowerCase().includes('female') || v.name.toLowerCase().includes('samantha') || v.name.toLowerCase().includes('karen') || v.name.toLowerCase().includes('victoria') || v.name.toLowerCase().includes('serena'));
                    if (f) utterance.voice = f;
                }
            }
        }

        utterance.onend = () => {
            if (voiceBtn) {
                voiceBtn.classList.remove('playing');
                voiceBtn.innerHTML = '<i class="fa-solid fa-volume-high text-[9px]"></i> <span>Listen</span>';
            }
        };

        utterance.onerror = () => {
            if (voiceBtn) {
                voiceBtn.classList.remove('playing');
                voiceBtn.innerHTML = '<i class="fa-solid fa-volume-high text-[9px]"></i> <span>Listen</span>';
            }
        };

        window.speechSynthesis.speak(utterance);
    }

    // Play Voice with Instantaneous 0ms Response
    async function playGeminiAudio(text, voiceBtn = null, preloadedBase64 = null) {
        stopAudioPlayback();

        if (voiceBtn) {
            voiceBtn.classList.add('playing');
            voiceBtn.innerHTML = `
                <div class="flex items-center gap-0.5 h-3">
                    <span class="wave-bar"></span>
                    <span class="wave-bar"></span>
                    <span class="wave-bar"></span>
                </div>
                <span class="ml-1">Speaking</span>
            `;
        }

        try {
            const cleanText = text.replace(/[*_#`~]/g, '').trim();
            const cacheKey = `${currentVoiceName}:${cleanText}`;

            let base64Audio = preloadedBase64 || audioCache.get(cacheKey);

            if (base64Audio) {
                // Instant playback from audio cache (0ms)
                const audio = new Audio("data:audio/wav;base64," + base64Audio);
                audio.playbackRate = currentVoiceSpeed;
                currentAudioPlayer = audio;

                audio.onended = () => {
                    if (voiceBtn) {
                        voiceBtn.classList.remove('playing');
                        voiceBtn.innerHTML = '<i class="fa-solid fa-volume-high text-[9px]"></i> <span>Listen</span>';
                    }
                    currentAudioPlayer = null;
                };

                audio.onerror = () => {
                    if (voiceBtn) {
                        voiceBtn.classList.remove('playing');
                        voiceBtn.innerHTML = '<i class="fa-solid fa-volume-xmark text-[9px]"></i> <span>Audio Error</span>';
                    }
                    currentAudioPlayer = null;
                };

                await audio.play();
                return;
            }

            // If not cached yet, fire INSTANTLY with Web Speech Synthesis (0ms wait)
            if ('speechSynthesis' in window) {
                playInstantBrowserSpeech(cleanText, voiceBtn);
                // Prefetch high-def audio in background for subsequent playbacks
                prefetchAudio(cleanText);
                return;
            }

            // Fallback for environments without speech synthesis
            const res = await fetch('/api/chatbot/tts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: cleanText, voice: currentVoiceName })
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            base64Audio = data.audio_base64;

            if (base64Audio) {
                audioCache.set(cacheKey, base64Audio);
                const audio = new Audio("data:audio/wav;base64," + base64Audio);
                audio.playbackRate = currentVoiceSpeed;
                currentAudioPlayer = audio;
                audio.onended = () => stopAudioPlayback();
                await audio.play();
            }

        } catch (err) {
            console.error("Voice playback error:", err);
            if (voiceBtn) {
                voiceBtn.classList.remove('playing');
                voiceBtn.innerHTML = '<i class="fa-solid fa-volume-high text-[9px]"></i> <span>Listen</span>';
            }
        }
    }

    // Add message to chat DOM
    function appendMessageElement(role, text, imageBase64 = null, audioBase64 = null) {
        const bubble = document.createElement('div');
        bubble.className = `chat-bubble ${role === 'user' ? 'user' : 'bot'}`;

        if (imageBase64) {
            const img = document.createElement('img');
            img.src = imageBase64;
            img.className = 'w-32 h-auto rounded-lg mb-2 border border-[#E5E2DA] object-cover';
            bubble.appendChild(img);
        }

        const textDiv = document.createElement('div');
        if (role === 'user') {
            textDiv.textContent = text;
        } else {
            // Format bold and linebreaks nicely
            let formatted = text
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/\n\n/g, '<br><br>')
                .replace(/\n/g, '<br>');
            textDiv.innerHTML = formatted;
        }
        bubble.appendChild(textDiv);

        // Add Listen button on bot replies
        if (role !== 'user') {
            const voiceBtn = document.createElement('button');
            voiceBtn.type = 'button';
            voiceBtn.className = 'msg-voice-btn';
            voiceBtn.innerHTML = '<i class="fa-solid fa-volume-high text-[9px]"></i> <span>Listen</span>';
            voiceBtn.addEventListener('click', () => {
                playGeminiAudio(text, voiceBtn);
            });
            bubble.appendChild(voiceBtn);

            // Trigger silent background prefetch immediately so audio is ready
            prefetchAudio(text);

            // Auto-play voice if enabled and audioBase64 exists
            if (audioBase64 && autoVoiceEnabled) {
                playGeminiAudio(text, voiceBtn, audioBase64);
            }
        }

        chatMessages.appendChild(bubble);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        return bubble;
    }

    // Load persistent chat history from server
    let historyLoaded = false;
    async function loadChatHistory() {
        if (historyLoaded) return;
        try {
            const res = await fetch('/api/chat/history');
            if (res.ok) {
                const data = await res.json();
                chatMessages.innerHTML = '';

                if (data.messages && data.messages.length > 0) {
                    data.messages.forEach(msg => {
                        appendMessageElement(msg.role, msg.text);
                    });
                } else {
                    // Friendly greeting on empty conversation
                    appendMessageElement('bot', "Hello! I'm your OutfitAI fashion stylist. I have complete access to your personal wardrobe and the live forecast. Ask me for outfit pairings, weather recommendations, or upload any garment photo!");
                }
                historyLoaded = true;
                chatMessages.scrollTop = chatMessages.scrollHeight;
            }
        } catch (e) {
            console.error("Failed to load chat history:", e);
        }
    }

    // Clear Chat History
    if (chatClearBtn) {
        chatClearBtn.addEventListener('click', async () => {
            if (!confirm("Clear your chat conversation history?")) return;
            try {
                const res = await fetch('/api/chat/clear', { method: 'POST' });
                if (res.ok) {
                    stopAudioPlayback();
                    chatMessages.innerHTML = '';
                    appendMessageElement('bot', "Conversation refreshed! How can I style you today?");
                }
            } catch (e) {
                alert("Could not clear history: " + e.message);
            }
        });
    }

    // Quick Prompts Chips
    if (quickPrompts) {
        quickPrompts.querySelectorAll('.prompt-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                const prompt = chip.getAttribute('data-prompt');
                if (prompt) {
                    chatInput.value = prompt;
                    chatForm.dispatchEvent(new Event('submit'));
                }
            });
        });
    }

    // File Attachment Handling
    if (chatAttachmentBtn && chatFileInput) {
        chatAttachmentBtn.addEventListener('click', () => chatFileInput.click());

        chatFileInput.addEventListener('change', () => {
            const file = chatFileInput.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onloadend = () => {
                    attachedImageBase64 = reader.result;
                    previewImage.src = reader.result;
                    chatAttachmentPreview.classList.remove('hidden');
                };
                reader.readAsDataURL(file);
            }
            chatFileInput.value = '';
        });
    }

    if (removeAttachmentBtn) {
        removeAttachmentBtn.addEventListener('click', () => {
            attachedImageBase64 = null;
            previewImage.src = '#';
            chatAttachmentPreview.classList.add('hidden');
        });
    }

    // Speech-to-Text (STT) Microphone Feature
    if (chatMicBtn) {
        const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRec) {
            speechRecognition = new SpeechRec();
            speechRecognition.continuous = false;
            speechRecognition.interimResults = true;
            speechRecognition.lang = 'en-US';

            speechRecognition.onstart = () => {
                isRecordingVoice = true;
                chatMicBtn.classList.add('mic-recording');
                if (micRecordingIndicator) micRecordingIndicator.classList.remove('hidden');
            };

            speechRecognition.onresult = (event) => {
                let transcript = '';
                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    transcript += event.results[i][0].transcript;
                }
                chatInput.value = transcript;
            };

            speechRecognition.onerror = (event) => {
                console.warn("Speech recognition error:", event.error);
                stopSpeechRec();
            };

            speechRecognition.onend = () => {
                stopSpeechRec();
            };

            function stopSpeechRec() {
                isRecordingVoice = false;
                chatMicBtn.classList.remove('mic-recording');
                if (micRecordingIndicator) micRecordingIndicator.classList.add('hidden');
            }

            chatMicBtn.addEventListener('click', () => {
                if (isRecordingVoice) {
                    speechRecognition.stop();
                } else {
                    speechRecognition.start();
                }
            });

            if (micCancelBtn) {
                micCancelBtn.addEventListener('click', () => {
                    speechRecognition.abort();
                    stopSpeechRec();
                });
            }
        } else {
            chatMicBtn.title = "Voice recognition is not supported in this browser.";
            chatMicBtn.classList.add('opacity-40');
            chatMicBtn.addEventListener('click', () => {
                alert("Voice input is not supported in this browser. Please use Chrome or Safari.");
            });
        }
    }

    // Submit Chat Message with Active Look Context and Voice Selection
    if (chatForm) {
        chatForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const text = chatInput.value.trim();
            if (!text && !attachedImageBase64) return;

            // Append user turn
            appendMessageElement('user', text, attachedImageBase64);
            chatInput.value = '';

            const currentImage = attachedImageBase64;
            attachedImageBase64 = null;
            if (chatAttachmentPreview) chatAttachmentPreview.classList.add('hidden');

            // Typing indicator
            const typingBubble = document.createElement('div');
            typingBubble.className = 'chat-bubble bot text-xs text-[#706D65] flex items-center gap-1.5';
            typingBubble.innerHTML = `
                <span class="w-1.5 h-1.5 rounded-full bg-[#BA512A] animate-bounce"></span>
                <span class="w-1.5 h-1.5 rounded-full bg-[#BA512A] animate-bounce" style="animation-delay: 0.15s"></span>
                <span class="w-1.5 h-1.5 rounded-full bg-[#BA512A] animate-bounce" style="animation-delay: 0.3s"></span>
                <span class="ml-1 text-[11px]">Consulting your wardrobe archive...</span>
            `;
            chatMessages.appendChild(typingBubble);
            chatMessages.scrollTop = chatMessages.scrollHeight;

            try {
                const payload = {
                    prompt: text,
                    imageBase64: currentImage,
                    voice: autoVoiceEnabled,
                    voiceName: currentVoiceName,
                    activeOutfit: activeOutfitContext
                };

                if (userLocation.lat) {
                    payload.currentWeather = userLocation;
                }

                const res = await fetch('/api/chatbot', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                const data = await res.json();
                typingBubble.remove();

                if (data.error) throw new Error(data.error);

                const botReply = data.response || "I couldn't compose advice right now.";
                const audioBase64 = data.audio ? data.audio.audio_base64 : null;

                // Pre-cache voice reply in audioCache
                if (audioBase64) {
                    const cleanRep = botReply.replace(/[*_#`~]/g, '').trim();
                    audioCache.set(`${currentVoiceName}:${cleanRep}`, audioBase64);
                }

                appendMessageElement('model', botReply, null, audioBase64);

            } catch (err) {
                typingBubble.remove();
                appendMessageElement('model', `I encountered an issue consulting your wardrobe: ${err.message}`);
            }
        });
    }

    // Initial weather fetch & saved looks fetch on page load
    fetchWeather();
    loadSavedOutfits();
});