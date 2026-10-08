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
        'days': 2, # Fetch 2 days to cleanly span upcoming hours across midnight
        'aqi': 'no', 
        'alerts': 'no' 
    }
    
    try:
        response = requests.get(BASE_URL, params=params)
        response.raise_for_status()  # Raises an HTTPError for bad responses (4xx or 5xx)
        data = response.json()
        
        # --- Extract current, location, and astro data ---
        location_data = data.get('location', {})
        current_weather = data.get('current', {})
        forecast_days = data.get('forecast', {}).get('forecastday', [])
        first_day = forecast_days[0] if forecast_days else {}
        astro_data = first_day.get('astro', {})

        # Determine exact location local time
        localtime_str = location_data.get('localtime')
        try:
            if localtime_str:
                local_dt = datetime.datetime.strptime(localtime_str, "%Y-%m-%d %H:%M")
            else:
                local_dt = datetime.datetime.now()
        except Exception:
            local_dt = datetime.datetime.now()

        current_hour_dt = local_dt.replace(minute=0, second=0, microsecond=0)

        # Collect all raw hours from today and tomorrow
        all_raw_hours = []
        for f_day in forecast_days:
            all_raw_hours.extend(f_day.get('hour', []))

        # Process upcoming hours from current local hour forward
        processed_hourly = []
        upcoming_trajectory = []
        for h_entry in all_raw_hours:
            h_time_str = h_entry.get('time')
            if not h_time_str:
                continue
            try:
                h_dt = datetime.datetime.strptime(h_time_str, "%Y-%m-%d %H:%M")
            except Exception:
                continue

            if h_dt >= current_hour_dt and len(processed_hourly) < 12:
                offset_hours = int((h_dt - current_hour_dt).total_seconds() // 3600)
                rel_label = "Now" if offset_hours == 0 else f"+{offset_hours}h"
                time_label = h_dt.strftime('%I%p').lower().lstrip('0')
                
                cond_text = h_entry.get('condition', {}).get('text', 'N/A')
                temp_val = h_entry.get('temp_c')
                rain_chance = h_entry.get('chance_of_rain', 0)
                wind_k = h_entry.get('wind_kph', 0)

                processed_hourly.append({
                    'time': time_label,
                    'full_time': h_dt.strftime('%H:%M'),
                    'offset_hours': offset_hours,
                    'rel_label': rel_label,
                    'temp_c': temp_val,
                    'condition': cond_text,
                    'condition_icon': f"https:{h_entry.get('condition', {}).get('icon')}" if h_entry.get('condition', {}).get('icon') else None,
                    'chance_of_rain': rain_chance,
                    'wind_kph': wind_k
                })

                if offset_hours in [0, 1, 2, 3, 4, 6]:
                    upcoming_trajectory.append(
                        f"{time_label} ({rel_label}): {temp_val}°C, {cond_text}, {rain_chance}% rain"
                    )


        # --- Assemble the combined data ---
        enhanced_weather_data = {
            'city': location_data.get('name', 'Unknown Location'),
            'region': location_data.get('region', ''),
            'country': location_data.get('country', ''),
            'local_time': local_dt.strftime('%H:%M'),
            'local_date': local_dt.strftime('%Y-%m-%d'),
            'temp': current_weather.get('temp_c'),
            'feels_like': current_weather.get('feelslike_c'),
            'description': current_weather.get('condition', {}).get('text', 'N/A'),
            'icon': f"https:{current_weather.get('condition', {}).get('icon')}" if current_weather.get('condition', {}).get('icon') else None,
            'wind_kph': current_weather.get('wind_kph'),
            'humidity': current_weather.get('humidity'),
            'vis_km': current_weather.get('vis_km'),
            'uv': current_weather.get('uv'),
            'sunrise': astro_data.get('sunrise'),
            'sunset': astro_data.get('sunset'),
            'hourly_forecast': processed_hourly,
            'hourly_trajectory_summary': " -> ".join(upcoming_trajectory)
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
