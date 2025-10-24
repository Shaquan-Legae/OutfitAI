document.addEventListener('DOMContentLoaded', () => {
    // --- Cache settings ---
    const CACHE_KEY = 'weatherDataCache'; // Key for sessionStorage
    const CACHE_DURATION_MS = 30 * 60 * 1000; // Cache duration: 30 minutes
    // --- Global variable for location ---
    let userLocation = { lat: null, lon: null }; // Keep track of location

    // --- Get Weather Elements ---
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
    // --- NEW elements for Hourly and Astro ---
    const hourlyContainer = document.getElementById('hourly-forecast-container');
    const sunriseTimeEl = document.getElementById('sunrise-time');
    const sunsetTimeEl = document.getElementById('sunset-time');

    // --- Rain Icon SVG (for hourly forecast) ---
     const rainIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 13.367c.667.14.933.28.933.733 0 .4-.267.567-.8.633M12 14.633c.667.14.933.28.933.733 0 .4-.267.567-.8.633M8 13.367c.667.14.933.28.933.733 0 .4-.267.567-.8.633M12 4v8M8 8l-4 4M16 8l4 4"/></svg>`;


    // --- UI Update Functions ---
    function showWeatherError(message) {
        weatherWidget.classList.remove('loading', 'clickable', 'active');
        weatherWidget.classList.add('error');
        weatherCity.textContent = 'Error'; weatherDesc.textContent = message;
        weatherTemp.textContent = ':('; weatherFeelsLike.textContent = ''; 
        extraDetailsPanel.classList.remove('open'); 
        if (hourlyContainer) hourlyContainer.innerHTML = `<span class="error-hourly">Could not load hourly data.</span>`; 
        if (sunriseTimeEl) sunriseTimeEl.textContent = 'Error';
        if (sunsetTimeEl) sunsetTimeEl.textContent = 'Error';
        try { sessionStorage.removeItem(CACHE_KEY); } catch(e) { console.error("Error removing weather cache:", e); }
    }

    function updateWeatherUI(data) {
        // Update current weather card
        weatherTemp.textContent = `${Math.round(data.temp)}°C`;
        weatherDesc.textContent = data.description;
        weatherCity.textContent = data.city;
        weatherFeelsLike.textContent = `Feels like: ${Math.round(data.feels_like)}°C`;
        weatherIcon.innerHTML = ''; 
        const iconImg = document.createElement('img');
        iconImg.src = data.icon.startsWith('//') ? `https:${data.icon}` : data.icon;
        iconImg.alt = data.description;
        weatherIcon.appendChild(iconImg);

        // Update current details in expandable panel
        dataWind.textContent = `${data.wind_kph} kph`;
        dataHumidity.textContent = `${data.humidity} %`;
        dataVis.textContent = `${data.vis_km} km`;
        dataUv.textContent = data.uv;

        // --- NEW: Populate Hourly Forecast ---
        if (hourlyContainer) {
            hourlyContainer.innerHTML = ''; // Clear previous/loading state
            if (data.hourly_forecast && data.hourly_forecast.length > 0) {
                data.hourly_forecast.forEach(hour => {
                    const hourDiv = document.createElement('div');
                    hourDiv.className = 'hour-item';
                    
                    const timeSpan = document.createElement('span');
                    timeSpan.className = 'hour-time';
                    timeSpan.textContent = hour.time; // Already formatted e.g., "05pm"
                    
                    const hourIconImg = document.createElement('img');
                    hourIconImg.src = hour.condition_icon || '';
                    hourIconImg.alt = ''; // Decorative
                    hourIconImg.onerror = () => { hourIconImg.style.display = 'none'; }; // Hide if icon fails to load

                    const tempSpan = document.createElement('span');
                    tempSpan.className = 'hour-temp';
                    tempSpan.textContent = `${Math.round(hour.temp_c)}°`;

                    hourDiv.appendChild(timeSpan);
                    hourDiv.appendChild(hourIconImg);
                    hourDiv.appendChild(tempSpan);

                    // Add chance of rain if > 0%
                    if (hour.chance_of_rain > 0) {
                         const rainSpan = document.createElement('span');
                         rainSpan.className = 'hour-rain';
                         rainSpan.innerHTML = `${rainIconSvg} ${hour.chance_of_rain}%`; // Use SVG icon
                         hourDiv.appendChild(rainSpan);
                    }

                    hourlyContainer.appendChild(hourDiv);
                });
            } else {
                hourlyContainer.innerHTML = `<span class="no-hourly-data">Hourly data not available.</span>`;
            }
        }

        // --- NEW: Populate Sunrise/Sunset ---
        if (sunriseTimeEl) sunriseTimeEl.textContent = data.sunrise || '--:-- --';
        if (sunsetTimeEl) sunsetTimeEl.textContent = data.sunset || '--:-- --';

        // Mark as loaded and make clickable
        weatherWidget.classList.remove('loading');
        weatherWidget.classList.add('clickable');
    }

    // --- Fetch Weather Function (with Caching) ---
    async function fetchWeather() {
        // Check cache first
        try {
            const cachedDataString = sessionStorage.getItem(CACHE_KEY);
            if (cachedDataString) {
                const cachedData = JSON.parse(cachedDataString);
                const now = new Date().getTime();
                if (now - cachedData.timestamp < CACHE_DURATION_MS) {
                    console.log("Using cached weather data for index page.");
                    // Ensure cached data has the new fields before using it
                    if (cachedData.weather && cachedData.weather.hourly_forecast && cachedData.weather.sunrise) {
                        updateWeatherUI(cachedData.weather);
                        userLocation = cachedData.location; 
                        return; 
                    } else {
                         console.log("Cached data is old format or incomplete, refetching.");
                         sessionStorage.removeItem(CACHE_KEY); // Remove old format
                    }
                } else {
                    console.log("Cached weather data expired.");
                    sessionStorage.removeItem(CACHE_KEY); 
                }
            }
        } catch (e) { console.error("Error reading weather cache:", e); sessionStorage.removeItem(CACHE_KEY); }

        // If no valid cache, proceed to fetch
        if (!navigator.geolocation) { showWeatherError('Geolocation is not supported.'); return; }
        
        weatherWidget.classList.add('loading');
        weatherWidget.classList.remove('clickable', 'error', 'active');

        navigator.geolocation.getCurrentPosition(async (position) => {
            userLocation.lat = position.coords.latitude;
            userLocation.lon = position.coords.longitude;
            try {
                const response = await fetch('/api/weather', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(userLocation) 
                });
                if (!response.ok) { const errorData = await response.json(); throw new Error(errorData.error || 'Failed to fetch weather'); }
                
                const weatherData = await response.json(); // Expects enhanced data structure now
                
                // Store in cache
                const cacheEntry = { weather: weatherData, location: userLocation, timestamp: new Date().getTime() };
                try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(cacheEntry)); console.log("Weather data cached for index page."); } 
                catch (e) { console.error("Error saving weather cache:", e); }
                
                updateWeatherUI(weatherData);

            } catch (error) { showWeatherError(error.message); }
        }, () => { showWeatherError('Permission to access location was denied.'); });
    }

    // --- Click listener to toggle details panel ---
    weatherWidget.addEventListener('click', () => {
        if (weatherWidget.classList.contains('clickable')) {
            weatherWidget.classList.toggle('active');
            extraDetailsPanel.classList.toggle('open');
        }
    });

    // --- Initial Load ---
    fetchWeather();
});
