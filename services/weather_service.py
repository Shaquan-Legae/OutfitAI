import requests
import os
from dotenv import load_dotenv # Import dotenv
import datetime # Needed for parsing time

# Load environment variables from .env file
load_dotenv() 

# --- Get the key for WeatherAPI.com ---
API_KEY = os.getenv('WEATHERAPI_KEY')

# --- UPDATED Endpoint for Forecast Data ---
BASE_URL = "https://api.weatherapi.com/v1/forecast.json" 

def get_weather_by_coords(lat, lon):
    """
    Fetches today's forecast data (including hourly and astro) 
    from WeatherAPI.com using coordinates.
    """
    if not API_KEY:
        print("Error: WEATHERAPI_KEY not set in .env file.")
        return None
    
    # WeatherAPI.com takes the location as a single 'q' parameter
    location_query = f"{lat},{lon}"
        
    params = {
        'key': API_KEY,
        'q': location_query,
        'days': 1, # Get forecast for today only
        'aqi': 'no', 
        'alerts': 'no' 
    }
    
    try:
        response = requests.get(BASE_URL, params=params)
        response.raise_for_status()  # Raises an HTTPError for bad responses (4xx or 5xx)
        data = response.json()
        
        # --- Extract current, hourly, and astro data ---
        current_weather = data.get('current', {})
        forecast_day = data.get('forecast', {}).get('forecastday', [])[0] # Get today's forecast
        astro_data = forecast_day.get('astro', {})
        hourly_data = forecast_day.get('hour', [])

        # --- Process hourly data (select relevant hours if needed, format time) ---
        processed_hourly = []
        now_hour = datetime.datetime.now().hour 
        # Only show upcoming hours for today, limited to e.g., 12 hours
        count = 0
        for hour_data in hourly_data:
            hour_time_str = hour_data.get('time') # e.g., "2025-10-22 17:00"
            if hour_time_str:
                 hour_dt = datetime.datetime.fromisoformat(hour_time_str)
                 # Only include hours from the current hour onwards
                 if hour_dt.hour >= now_hour and count < 12: # Limit to next 12 hours
                    processed_hourly.append({
                        'time': hour_dt.strftime('%I%p').lower(), # Format as "05pm"
                        'temp_c': hour_data.get('temp_c'),
                        'condition_icon': f"https:{hour_data.get('condition', {}).get('icon')}" if hour_data.get('condition', {}).get('icon') else None,
                        'chance_of_rain': hour_data.get('chance_of_rain', 0) # Percentage
                    })
                    count += 1
            if count >= 12: # Stop after 12 hours
                 break


        # --- Assemble the combined data ---
        enhanced_weather_data = {
            # Current conditions (from 'current' object)
            'city': data.get('location', {}).get('name', 'Unknown Location'),
            'temp': current_weather.get('temp_c'),
            'feels_like': current_weather.get('feelslike_c'),
            'description': current_weather.get('condition', {}).get('text', 'N/A'),
            'icon': f"https:{current_weather.get('condition', {}).get('icon')}" if current_weather.get('condition', {}).get('icon') else None,
            'wind_kph': current_weather.get('wind_kph'),
            'humidity': current_weather.get('humidity'),
            'vis_km': current_weather.get('vis_km'),
            'uv': current_weather.get('uv'),
            # Astro data
            'sunrise': astro_data.get('sunrise'),
            'sunset': astro_data.get('sunset'),
            # Hourly forecast data
            'hourly_forecast': processed_hourly 
        }
        return enhanced_weather_data
        
    except requests.exceptions.RequestException as e:
        print(f"Error fetching forecast data from WeatherAPI.com: {e}")
        return None
    except (KeyError, IndexError) as e:
        print(f"Error parsing forecast data received from WeatherAPI.com: {e}")
        return None
    except Exception as e: # Catch any other unexpected errors
        print(f"An unexpected error occurred in get_weather_by_coords: {e}")
        return None
