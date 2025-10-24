document.addEventListener('DOMContentLoaded', () => {
    // =======================
    // --- GLOBAL VARIABLES ---
    // =======================
    let userLocation = { lat: null, lon: null };
    let attachedImageBase64 = null;
    let lastSuggestedOutfit = null; // Stores last outfit IDs for exclusion

    const CACHE_KEY = 'weatherDataCache';
    const CACHE_DURATION_MS = 30 * 60 * 1000; // 30 minutes

    // =======================
    // --- ELEMENT REFERENCES ---
    // =======================
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
    const suggestionBtn = document.getElementById('get-suggestion-btn');
    const getAnotherSuggestionBtn = document.getElementById('get-another-suggestion-btn');
    const hourlyContainer = document.getElementById('hourly-forecast-container');
    const sunriseTimeEl = document.getElementById('sunrise-time');
    const sunsetTimeEl = document.getElementById('sunset-time');
    const rainIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 13.367c.667.14.933.28.933.733 0 .4-.267.567-.8.633M12 14.633c.667.14.933.28.933.733 0 .4-.267.567-.8.633M8 13.367c.667.14.933.28.933.733 0 .4-.267.567-.8.633M12 4v8M8 8l-4 4M16 8l4 4"/></svg>`;

    const suggestionCard = document.getElementById('suggestion-output');
    const loadingMessage = suggestionCard.querySelector('.loading-message');
    const suggestionContent = document.getElementById('suggestion-content');
    const suggestionGreeting = document.getElementById('suggestion-greeting');
    const outfitDisplayArea = document.getElementById('outfit-display-area');
    const whyItWorksText = document.getElementById('why-it-works-text');
    const notesText = document.getElementById('notes-text');
    const notesContainer = notesText.parentElement;

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

    // =======================
    // --- WEATHER FUNCTIONS (Unchanged from previous versions, included for completeness) ---
    // =======================
    function showWeatherError(message) {
        weatherWidget.classList.remove('loading', 'clickable', 'active');
        weatherWidget.classList.add('error');
        weatherCity.textContent = 'Error';
        weatherDesc.textContent = message;
        weatherTemp.textContent = ':(';
        weatherFeelsLike.textContent = '';
        extraDetailsPanel.classList.remove('open');
        suggestionBtn.disabled = true;
        if (hourlyContainer) hourlyContainer.innerHTML = `<span class="error-hourly">Could not load hourly data.</span>`;
        if (sunriseTimeEl) sunriseTimeEl.textContent = 'Error';
        if (sunsetTimeEl) sunsetTimeEl.textContent = 'Error';
        try { sessionStorage.removeItem(CACHE_KEY); } catch (e) { console.error("Error removing weather cache:", e); }
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
        weatherIcon.appendChild(iconImg);

        dataWind.textContent = `${data.wind_kph} kph`;
        dataHumidity.textContent = `${data.humidity} %`;
        dataVis.textContent = `${data.vis_km} km`;
        dataUv.textContent = data.uv;

        renderHourlyForecast(data.hourly_forecast);
        if (sunriseTimeEl) sunriseTimeEl.textContent = data.sunrise || '--:-- --';
        if (sunsetTimeEl) sunsetTimeEl.textContent = data.sunset || '--:-- --';

        weatherWidget.classList.remove('loading');
        weatherWidget.classList.add('clickable');
        suggestionBtn.disabled = false;
    }

    function renderHourlyForecast(hourly) {
        if (!hourlyContainer) return;
        hourlyContainer.innerHTML = '';
        if (!hourly || hourly.length === 0) {
            hourlyContainer.innerHTML = `<span class="no-hourly-data">Hourly data not available.</span>`;
            return;
        }

        const fragment = document.createDocumentFragment();
        hourly.forEach(hour => {
            const hourDiv = document.createElement('div');
            hourDiv.className = 'hour-item';
            hourDiv.innerHTML = `
                <span class="hour-time">${hour.time}</span>
                <img src="${hour.condition_icon || ''}" alt="" onerror="this.style.display='none'">
                <span class="hour-temp">${Math.round(hour.temp_c)}°</span>
                ${hour.chance_of_rain > 0 ? `<span class="hour-rain">${rainIconSvg} ${hour.chance_of_rain}%</span>` : ''}
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
                const now = Date.now();
                if (now - cachedData.timestamp < CACHE_DURATION_MS && cachedData.weather && cachedData.weather.hourly_forecast) {
                    console.log("Using cached weather data.");
                    updateWeatherUI(cachedData.weather);
                    userLocation = cachedData.location;
                    suggestionBtn.disabled = false;
                    return;
                } else {
                    sessionStorage.removeItem(CACHE_KEY);
                }
            }
        } catch (e) {
            console.error("Error reading weather cache:", e);
            sessionStorage.removeItem(CACHE_KEY);
        }

        if (!navigator.geolocation) {
            showWeatherError('Geolocation is not supported.');
            return;
        }

        weatherWidget.classList.add('loading');
        weatherWidget.classList.remove('clickable', 'error', 'active');
        suggestionBtn.disabled = true;

        navigator.geolocation.getCurrentPosition(async (position) => {
            userLocation.lat = position.coords.latitude;
            userLocation.lon = position.coords.longitude;

            try {
                const response = await fetch('/api/weather', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(userLocation)
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({ error: `Server error ${response.status}` }));
                    throw new Error(errorData.error || 'Failed to fetch weather');
                }

                const weatherData = await response.json();
                sessionStorage.setItem(CACHE_KEY, JSON.stringify({ weather: weatherData, location: userLocation, timestamp: Date.now() }));
                console.log("Weather data cached.");
                updateWeatherUI(weatherData);
            } catch (error) {
                showWeatherError(error.message);
            }
        }, () => showWeatherError('Location permission denied.'));
    }

    weatherWidget.addEventListener('click', () => {
        if (weatherWidget.classList.contains('clickable')) {
            weatherWidget.classList.toggle('active');
            extraDetailsPanel.classList.toggle('open');
        }
    });

    // =======================
    // --- OUTFIT SUGGESTION FUNCTIONS ---
    // =======================
    async function getOutfitSuggestion(e) {
        if (!userLocation.lat || !userLocation.lon) {
            showWeatherError("Location not available.");
            fetchWeather();
            return;
        }

        suggestionBtn.disabled = true;
        getAnotherSuggestionBtn.disabled = true;
        suggestionCard.style.display = 'flex';
        suggestionCard.classList.add('loading');
        loadingMessage.style.display = 'block';
        suggestionContent.style.display = 'none';
        suggestionCard.classList.remove('error');

        const isSuggestAnother = e && e.currentTarget.id === 'get-another-suggestion-btn';
        const payload = { lat: userLocation.lat, lon: userLocation.lon };

        // FIX: Send the IDs of the last suggested outfit to prevent duplicates
        if (isSuggestAnother && lastSuggestedOutfit) {
            payload.exclude_item_ids = lastSuggestedOutfit.map(item => item.id);
        }

        try {
            const response = await fetch('/api/recommendations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) throw new Error(`Server error: ${response.status} ${response.statusText}`);

            const result = await response.json();
            if (result.error) throw new Error(result.error);

            if (!isSuggestAnother) lastSuggestedOutfit = null;

            renderOutfitResult(result);
        } catch (error) {
            console.error("Recommendation error:", error);
            suggestionCard.classList.remove('loading');
            suggestionCard.classList.add('error');
            loadingMessage.style.display = 'none';
            suggestionContent.style.display = 'block';
            suggestionGreeting.textContent = 'Oops! Something went wrong.';
            whyItWorksText.textContent = `Error: ${error.message}`;
            notesText.textContent = 'Please try again.';
            notesContainer.style.display = 'block';
            outfitDisplayArea.innerHTML = '';
            lastSuggestedOutfit = null;
        } finally {
            suggestionBtn.disabled = false;
            getAnotherSuggestionBtn.disabled = suggestionCard.classList.contains('error');
        }
    }

    function renderOutfitResult(result) {
        suggestionCard.classList.remove('loading');
        loadingMessage.style.display = 'none';
        suggestionContent.style.display = 'block';

        // FIX: Handle missing item suggestion (e.g., "add a black tee")
        if (result.missing_item_suggestion) {
            suggestionGreeting.textContent = result.greeting || `Heads up! Your wardrobe is limited for this weather. ⚠️`;
            whyItWorksText.textContent = result.missing_item_suggestion.message || 'No suitable outfit could be generated based on your wardrobe and the current weather.';
            notesText.textContent = `Suggestion: ${result.missing_item_suggestion.recommendation}`;
            notesContainer.style.display = 'block';
            outfitDisplayArea.innerHTML = `<p style="text-align:center; color: #dc3545; font-weight: 600;">Consider adding the suggested item to complete your wardrobe for the weather!</p>`;
            lastSuggestedOutfit = null;
            return;
        }

        if (result.outfit_details && result.outfit_details.length > 0) {
            suggestionGreeting.textContent = result.greeting || `Here's a suggestion for you:`;
            whyItWorksText.textContent = result.why_it_works || 'No explanation provided.';
            notesText.textContent = result.notes || '';
            notesContainer.style.display = result.notes ? 'block' : 'none';
            outfitDisplayArea.innerHTML = '';

            // Store the outfit IDs for exclusion next time
            lastSuggestedOutfit = result.outfit_details.map(item => ({ id: item.id || item.filename, name: item.name, category: item.category }));

            const fragment = document.createDocumentFragment();
            result.outfit_details.forEach(item => {
                const itemDiv = document.createElement('div');
                itemDiv.className = 'outfit-item';
                itemDiv.dataset.itemName = item.name;
                itemDiv.dataset.itemCategory = item.category;

                const imageUrl = item.url || `https://placehold.co/160x180/e9ecef/6c757d?text=${encodeURIComponent(item.name || 'Missing')}`;
                const altText = item.name || 'Outfit item';

                itemDiv.innerHTML = `
                    <img src="${imageUrl}" alt="${altText}" class="outfit-item-image" onerror="this.onerror=null; this.src='https://placehold.co/160x180/e9ecef/dc3545?text=Load+Error';">
                    <div class="outfit-item-info">
                        <h4>${item.name || 'Unnamed Item'}</h4>
                        <p>${item.category || 'N/A'}</p>
                    </div>
                `;

                // Item click opens chat to ask for an alternative
                itemDiv.addEventListener('click', () => openChatWithSuggestion(`Suggest another ${item.category.toLowerCase()} similar to "${item.name}" from my wardrobe.`));
                fragment.appendChild(itemDiv);
            });

            outfitDisplayArea.appendChild(fragment);
        } else {
            suggestionGreeting.textContent = 'Suggestion Not Available';
            whyItWorksText.textContent = 'The AI could not generate an outfit. Please upload more items.';
            notesText.textContent = 'Make sure you have a variety of tops, bottoms, and shoes uploaded.';
            notesContainer.style.display = 'block';
            outfitDisplayArea.innerHTML = '';
            lastSuggestedOutfit = null;
        }

        getAnotherSuggestionBtn.disabled = false;
    }

    suggestionBtn.addEventListener('click', getOutfitSuggestion);
    getAnotherSuggestionBtn.addEventListener('click', getOutfitSuggestion);

    // =======================
    // --- CHAT FUNCTIONS ---
    // =======================
    fab.addEventListener('click', () => chatWidget.classList.add('open'));
    closeBtn.addEventListener('click', () => chatWidget.classList.remove('open'));
    attachmentBtn.addEventListener('click', () => fileInput.click());
    removeAttachmentBtn.addEventListener('click', removeAttachment);

    fileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onloadend = () => {
                attachedImageBase64 = reader.result;
                previewImage.src = reader.result;
                attachmentPreview.style.display = 'block';
            }
            reader.readAsDataURL(file);
        } else removeAttachment();
        fileInput.value = '';
    });

    function removeAttachment() {
        attachedImageBase64 = null;
        previewImage.src = '#';
        attachmentPreview.style.display = 'none';
        fileInput.value = '';
    }
    
    // FIX: Modified to support Markdown-like formatting for bot messages
    function addChatMessage(sender, message, imageBase64 = null) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${sender}`;
        
        if (imageBase64) {
            const img = document.createElement('img');
            img.src = imageBase64;
            img.className = 'chat-image';
            img.alt = 'User attachment';
            msgDiv.appendChild(img);
        }
        
        // Div to hold the message content
        const textContentDiv = document.createElement('div');

        if (message) {
            if (sender === 'bot') {
                // Simple Markdown to HTML conversion for formatting (bold/line breaks)
                let htmlMessage = message.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>'); // **Bold**
                htmlMessage = htmlMessage.replace(/\n/g, '<br>'); // Newlines
                textContentDiv.innerHTML = htmlMessage;
            } else {
                // For user messages, stick to safe text node
                textContentDiv.textContent = message;
            }
        }
        
        msgDiv.appendChild(textContentDiv);
        chatMessages.appendChild(msgDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        return msgDiv;
    }

    function openChatWithSuggestion(message) {
        chatWidget.classList.add('open');
        chatInput.value = message;
        chatInput.focus();
    }

    chatForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const userMessage = chatInput.value.trim();
        if (!userMessage && !attachedImageBase64) return;

        addChatMessage('user', userMessage, attachedImageBase64);
        chatInput.value = '';
        removeAttachment();

        const typingIndicator = addChatMessage('bot typing', '...');

        try {
            const payload = { prompt: userMessage || "Describe this image." };
            if (attachedImageBase64) payload.imageBase64 = attachedImageBase64;
            if (userLocation.lat && userLocation.lon) payload.currentWeather = userLocation;

            // CRITICAL: Fetching Wardrobe Context for Chatbot Consistency
            try {
                const wardrobeResponse = await fetch('/api/wardrobe');
                if (wardrobeResponse.ok) {
                    const wardrobeItems = await wardrobeResponse.json();
                    // Pass simplified details to the server
                    payload.wardrobeContext = wardrobeItems.map(item => ({ 
                        id: item.id, 
                        name: item.name, 
                        category: item.category, 
                        description: item.description 
                    }));
                }
            } catch (wardrobeError) { console.error("Wardrobe fetch error:", wardrobeError); }

            if (lastSuggestedOutfit) payload.lastSuggestedOutfit = lastSuggestedOutfit;

            const response = await fetch('/api/chatbot', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) throw new Error(`Chatbot error: ${response.status} ${response.statusText}`);
            const result = await response.json();
            if (result.error) throw new Error(result.error);

            // FIX: Remove 'typing' indicator and show final formatted response
            typingIndicator.remove();
            addChatMessage('bot', result.response || "Received empty response.");
            
        } catch (error) {
            console.error("Chatbot submit error:", error);
            typingIndicator.textContent = `Error: ${error.message}`;
            typingIndicator.classList.add('bot', 'error');
        }
    });

    // =======================
    // --- INITIAL LOAD ---
    // =======================
    fetchWeather();
});