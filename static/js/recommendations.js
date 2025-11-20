document.addEventListener('DOMContentLoaded', () => {
    // --- VARIABLES ---
    let userLocation = { lat: null, lon: null };
    let attachedImageBase64 = null;
    let lastSuggestedOutfit = null;
    let currentDisplayedResult = null; 

    const CACHE_KEY = 'weatherDataCache';
    const CACHE_DURATION_MS = 30 * 60 * 1000;

    // --- ELEMENTS ---
    const weatherWidget = document.getElementById('weather-widget');
    const weatherIcon = weatherWidget.querySelector('.weather-icon');
    const weatherTemp = weatherWidget.querySelector('.weather-temp');
    const weatherDesc = weatherWidget.querySelector('.weather-desc');
    const weatherCity = weatherWidget.querySelector('.weather-city');
    const weatherFeelsLike = weatherWidget.querySelector('.weather-feels-like');
    const extraDetailsPanel = document.getElementById('weather-extra-details');
    const dataWind = document.getElementById('data-wind');
    const dataHumidity = document.getElementById('data-humidity');
    const dataVis = document.getElementById('data-vis');
    const dataUv = document.getElementById('data-uv');
    const sunriseTimeEl = document.getElementById('sunrise-time');
    const sunsetTimeEl = document.getElementById('sunset-time');
    const hourlyContainer = document.getElementById('hourly-forecast-container');

    const suggestionBtn = document.getElementById('get-suggestion-btn');
    const suggestionCard = document.getElementById('suggestion-output');
    const loadingMessage = suggestionCard.querySelector('.loading-message');
    const suggestionContent = document.getElementById('suggestion-content');
    const suggestionGreeting = document.getElementById('suggestion-greeting');
    const outfitDisplayArea = document.getElementById('outfit-display-area');
    const whyItWorksText = document.getElementById('why-it-works-text');
    const notesText = document.getElementById('notes-text');
    const getAnotherSuggestionBtn = document.getElementById('get-another-suggestion-btn');
    
    // Saved Outfits Elements
    const saveOutfitBtn = document.getElementById('save-outfit-btn');
    const savedOutfitsContainer = document.getElementById('saved-outfits-container');

    const fab = document.getElementById('fab-chat');
    const chatWidget = document.getElementById('chat-widget');
    const closeBtn = document.getElementById('chat-close-btn');
    const chatForm = document.getElementById('chat-form');
    const chatInput = document.getElementById('chat-input');
    const chatMessages = document.getElementById('chat-messages');
    const attachmentBtn = document.getElementById('chat-attachment-btn');
    const fileInput = document.getElementById('chat-file-input');
    const attachmentPreview = document.getElementById('chat-attachment-preview');
    const previewImage = document.getElementById('preview-image');
    const removeAttachmentBtn = document.getElementById('remove-attachment-btn');

    // --- WEATHER LOGIC ---
    function showWeatherError(message) {
        weatherWidget.classList.remove('loading', 'clickable', 'active');
        weatherWidget.classList.add('from-red-500', 'to-red-600');
        weatherCity.textContent = 'Error';
        weatherDesc.textContent = message;
        weatherTemp.textContent = '--';
        weatherFeelsLike.textContent = '';
        extraDetailsPanel.classList.remove('open');
        suggestionBtn.disabled = true;
        if (hourlyContainer) hourlyContainer.innerHTML = `<span class="text-white/80 text-sm">Unable to load.</span>`;
        sessionStorage.removeItem(CACHE_KEY);
    }

    function updateWeatherUI(data) {
        weatherTemp.textContent = `${Math.round(data.temp)}°C`;
        weatherDesc.textContent = data.description;
        weatherCity.textContent = data.city;
        weatherFeelsLike.textContent = `Feels like: ${Math.round(data.feels_like)}°C`;
        weatherIcon.innerHTML = '';
        const iconImg = document.createElement('img');
        iconImg.src = data.icon.startsWith('//') ? `https:${data.icon}` : data.icon;
        iconImg.alt = data.description;
        iconImg.className = 'w-full h-full object-contain drop-shadow-md';
        weatherIcon.appendChild(iconImg);
        dataWind.textContent = `${data.wind_kph} kph`;
        dataHumidity.textContent = `${data.humidity} %`;
        dataVis.textContent = `${data.vis_km} km`;
        dataUv.textContent = data.uv;
        if (sunriseTimeEl) sunriseTimeEl.textContent = data.sunrise || '--:--';
        if (sunsetTimeEl) sunsetTimeEl.textContent = data.sunset || '--:--';
        renderHourlyForecast(data.hourly_forecast);
        weatherWidget.classList.remove('loading');
        weatherWidget.classList.add('clickable');
        suggestionBtn.disabled = false;
    }

    function renderHourlyForecast(hourly) {
        if (!hourlyContainer) return;
        hourlyContainer.innerHTML = '';
        if (!hourly || hourly.length === 0) {
            hourlyContainer.innerHTML = `<span class="text-slate-400 text-sm w-full text-center">No data.</span>`;
            return;
        }
        const fragment = document.createDocumentFragment();
        hourly.forEach(hour => {
            const hourDiv = document.createElement('div');
            hourDiv.className = 'hour-item'; 
            hourDiv.innerHTML = `
                <span class="hour-time">${hour.time}</span>
                <img src="${hour.condition_icon || ''}" alt="icon">
                <span class="hour-temp">${Math.round(hour.temp_c)}°</span>
                ${hour.chance_of_rain > 0 ? `<span class="hour-rain"><i class="fa-solid fa-umbrella"></i> ${hour.chance_of_rain}%</span>` : ''}
            `;
            fragment.appendChild(hourDiv);
        });
        hourlyContainer.appendChild(fragment);
    }

    async function fetchWeather() {
        try {
            const cachedDataString = sessionStorage.getItem(CACHE_KEY);
            if (cachedDataString) {
                const cachedData = JSON.parse(cachedDataString);
                if (Date.now() - cachedData.timestamp < CACHE_DURATION_MS && cachedData.weather) {
                    updateWeatherUI(cachedData.weather);
                    userLocation = cachedData.location;
                    suggestionBtn.disabled = false;
                    return;
                } else { sessionStorage.removeItem(CACHE_KEY); }
            }
        } catch (e) {}

        if (!navigator.geolocation) { showWeatherError('Geolocation not supported.'); return; }
        weatherWidget.classList.add('loading');
        suggestionBtn.disabled = true;

        navigator.geolocation.getCurrentPosition(async (position) => {
            userLocation.lat = position.coords.latitude;
            userLocation.lon = position.coords.longitude;
            try {
                const response = await fetch('/api/weather', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(userLocation)
                });
                if (!response.ok) throw new Error('Weather fetch failed');
                const weatherData = await response.json();
                sessionStorage.setItem(CACHE_KEY, JSON.stringify({ weather: weatherData, location: userLocation, timestamp: Date.now() }));
                updateWeatherUI(weatherData);
            } catch (error) { showWeatherError('Failed to load weather.'); }
        }, () => showWeatherError('Location denied.'));
    }

    weatherWidget.addEventListener('click', () => {
        if (weatherWidget.classList.contains('clickable')) {
            weatherWidget.classList.toggle('active');
            extraDetailsPanel.classList.toggle('open');
        }
    });

    // --- OUTFIT GENERATION ---
    async function getOutfitSuggestion(e) {
        if (!userLocation.lat) { fetchWeather(); return; }
        suggestionBtn.disabled = true;
        getAnotherSuggestionBtn.disabled = true;
        suggestionCard.classList.remove('hidden');
        suggestionCard.classList.add('flex');
        loadingMessage.classList.remove('hidden');
        suggestionContent.classList.add('hidden');
        saveOutfitBtn.classList.add('hidden'); // Hide save button while loading

        const isSuggestAnother = e && e.currentTarget.id === 'get-another-suggestion-btn';
        const payload = { lat: userLocation.lat, lon: userLocation.lon };
        if (isSuggestAnother && lastSuggestedOutfit) { payload.exclude_item_ids = lastSuggestedOutfit.map(item => item.id); }

        try {
            const response = await fetch('/api/recommendations', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
            });
            const result = await response.json();
            if (result.error) throw new Error(result.error);

            if (!isSuggestAnother) lastSuggestedOutfit = null;
            
            // Store result for saving
            currentDisplayedResult = result; 
            renderOutfitResult(result);
            saveOutfitBtn.classList.remove('hidden'); // Show save button

        } catch (error) {
            loadingMessage.classList.add('hidden');
            suggestionContent.classList.remove('hidden');
            suggestionGreeting.textContent = 'Oops!';
            whyItWorksText.textContent = `Error: ${error.message}`;
            outfitDisplayArea.innerHTML = '';
        } finally {
            suggestionBtn.disabled = false;
            getAnotherSuggestionBtn.disabled = false;
        }
    }

    function renderOutfitResult(result) {
        loadingMessage.classList.add('hidden');
        suggestionContent.classList.remove('hidden');

        if (result.missing_item_suggestion) {
            suggestionGreeting.textContent = result.greeting || "Wardrobe Update Needed";
            whyItWorksText.innerHTML = `<span class="text-red-500 font-bold">Missing:</span> ${result.missing_item_suggestion.message}`;
            notesText.textContent = `Recommendation: ${result.missing_item_suggestion.recommendation}`;
            outfitDisplayArea.innerHTML = '';
            saveOutfitBtn.classList.add('hidden');
            return;
        }

        if (result.outfit_details && result.outfit_details.length > 0) {
            suggestionGreeting.textContent = result.greeting || "Here is your look:";
            whyItWorksText.textContent = result.why_it_works || '';
            notesText.textContent = result.notes || '';
            lastSuggestedOutfit = result.outfit_details.map(item => ({ id: item.id || item.filename }));

            outfitDisplayArea.innerHTML = '';
            const fragment = document.createDocumentFragment();
            result.outfit_details.forEach(item => {
                const itemDiv = document.createElement('div');
                itemDiv.className = 'outfit-item';
                const imageUrl = item.url || `https://placehold.co/160x180/e2e8f0/64748b?text=${encodeURIComponent(item.name)}`;
                itemDiv.innerHTML = `
                    <img src="${imageUrl}" alt="${item.name}">
                    <div class="outfit-item-info">
                        <h4>${item.name || 'Item'}</h4>
                        <p>${item.category || ''}</p>
                    </div>
                `;
                itemDiv.addEventListener('click', () => openChatWithSuggestion(`Can you suggest a different ${item.category} instead of the "${item.name}"?`));
                fragment.appendChild(itemDiv);
            });
            outfitDisplayArea.appendChild(fragment);
            
            // Reset Save Button State
            saveOutfitBtn.innerHTML = '<i class="fa-regular fa-heart mr-2"></i> Save Look';
            saveOutfitBtn.classList.remove('text-red-500', 'bg-red-50', 'border-red-200');
            saveOutfitBtn.disabled = false;
        }
    }

    suggestionBtn.addEventListener('click', getOutfitSuggestion);
    getAnotherSuggestionBtn.addEventListener('click', getOutfitSuggestion);

    // --- SAVED OUTFITS (BUBBLES) ---
    saveOutfitBtn.addEventListener('click', () => {
        if (!currentDisplayedResult || !currentDisplayedResult.outfit_details) return;

        // Visual feedback on button
        saveOutfitBtn.innerHTML = '<i class="fa-solid fa-heart mr-2"></i> Saved';
        saveOutfitBtn.classList.add('text-red-500', 'bg-red-50', 'border-red-200');
        saveOutfitBtn.disabled = true;

        createSavedBubble(currentDisplayedResult);
    });

    function createSavedBubble(outfitData) {
        // Use the first item's image as the thumbnail
        const thumbnailItem = outfitData.outfit_details[0];
        const imageUrl = thumbnailItem.url || 'https://placehold.co/100x100';

        // Create Bubble Wrapper
        const bubble = document.createElement('div');
        // FIX: Applying explicit Tailwind sizing classes here to prevent huge images
        bubble.className = 'w-14 h-14 rounded-full border-2 border-white shadow-lg cursor-pointer overflow-hidden hover:scale-110 transition-transform relative bg-white animate-pop-in';
        
        // Create Image
        const img = document.createElement('img');
        img.src = imageUrl;
        img.className = 'w-full h-full object-cover';
        
        bubble.appendChild(img);
        
        // Add click listener to restore this outfit
        bubble.addEventListener('click', () => {
            // Scroll up to viewing area
            window.scrollTo({ top: weatherWidget.offsetHeight, behavior: 'smooth' });
            // Re-render this specific outfit
            currentDisplayedResult = outfitData;
            renderOutfitResult(outfitData);
            // Update save button to show it's already saved
            saveOutfitBtn.innerHTML = '<i class="fa-solid fa-heart mr-2"></i> Saved';
            saveOutfitBtn.classList.add('text-red-500', 'bg-red-50', 'border-red-200');
            saveOutfitBtn.disabled = true;
        });

        savedOutfitsContainer.appendChild(bubble);
    }

    // --- CHAT LOGIC ---
    const toggleChat = () => {
        chatWidget.classList.toggle('open');
        const icon = fab.querySelector('i');
        icon.className = chatWidget.classList.contains('open') ? 'fa-solid fa-chevron-down' : 'fa-solid fa-comment-dots';
        if(chatWidget.classList.contains('open')) setTimeout(() => chatInput.focus(), 300);
    };

    fab.addEventListener('click', toggleChat);
    closeBtn.addEventListener('click', toggleChat);
    attachmentBtn.addEventListener('click', () => fileInput.click());
    
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onloadend = () => {
                attachedImageBase64 = reader.result;
                previewImage.src = reader.result;
                attachmentPreview.classList.remove('hidden');
            };
            reader.readAsDataURL(file);
        }
        fileInput.value = '';
    });

    removeAttachmentBtn.addEventListener('click', () => {
        attachedImageBase64 = null;
        previewImage.src = '#';
        attachmentPreview.classList.add('hidden');
    });

    function addChatMessage(sender, message, imageBase64 = null) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${sender}`;
        if (imageBase64) {
            const img = document.createElement('img');
            img.src = imageBase64;
            img.className = 'chat-image';
            msgDiv.appendChild(img);
        }
        const textDiv = document.createElement('div');
        if (sender === 'bot') {
            textDiv.innerHTML = message.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
        } else {
            textDiv.textContent = message;
        }
        msgDiv.appendChild(textDiv);
        chatMessages.appendChild(msgDiv);
        
        // GENTLE SCROLL: Only snap to bottom if we are already near the bottom
        // or if it's the user's own message.
        const isNearBottom = chatMessages.scrollHeight - chatMessages.scrollTop - chatMessages.clientHeight < 100;
        if (sender === 'user' || isNearBottom) {
            chatMessages.scrollTo({ top: chatMessages.scrollHeight, behavior: 'smooth' });
        }
        return msgDiv;
    }

    function openChatWithSuggestion(text) {
        if (!chatWidget.classList.contains('open')) toggleChat();
        chatInput.value = text;
        chatInput.focus();
    }

    chatForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const text = chatInput.value.trim();
        if (!text && !attachedImageBase64) return;

        addChatMessage('user', text, attachedImageBase64);
        chatInput.value = '';
        const tempImage = attachedImageBase64;
        attachedImageBase64 = null;
        attachmentPreview.classList.add('hidden');

        const typingDiv = addChatMessage('bot', '...');
        typingDiv.classList.add('animate-pulse');

        try {
            const payload = { prompt: text || "Describe this image.", imageBase64: tempImage };
            if (userLocation.lat) payload.currentWeather = userLocation;
            if (lastSuggestedOutfit) payload.lastSuggestedOutfit = lastSuggestedOutfit;

            const response = await fetch('/api/chatbot', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
            });
            const result = await response.json();
            typingDiv.remove();
            if (result.error) throw new Error(result.error);
            addChatMessage('bot', result.response || "I'm not sure how to answer that.");
        } catch (error) {
            typingDiv.remove();
            addChatMessage('bot', `Error: ${error.message}`);
        }
    });

    fetchWeather();
});