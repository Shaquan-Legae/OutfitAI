import os
import google.generativeai as genai
from dotenv import load_dotenv
import datetime
import base64
import io
import json
from PIL import Image
from collections import deque

# --- Load Environment Variables ---
load_dotenv()
API_KEY = os.getenv('GEMINI_API_KEY')

if not API_KEY:
    print("CRITICAL: GEMINI_API_KEY not found in .env file.")
    genai = None
else:
    try:
        # NOTE: Gemini TTS requires a specific client configuration for audio
        genai.configure(api_key=API_KEY)
    except Exception as e:
        print(f"Error configuring Gemini: {e}")
        genai = None

# --- Model Configuration ---
generation_config = {
    "temperature": 0.7,
    "top_p": 1,
    "top_k": 1,
    "max_output_tokens": 2048,
}

safety_settings = [
    {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
    {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
    {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
    {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
]

MODEL_NAME = "gemini-2.5-flash-preview-09-2025"
TTS_MODEL_NAME = "gemini-2.5-flash-preview-tts" # Dedicated TTS model

# --- Chat Context ---
MAX_CHAT_HISTORY = 10 


# --- Initialize Chat Session ---
def initialize_gemini_chat():
    """
    Initializes a context-aware chat session (without system instruction keyword, 
    as it is added to the prompt in app.py).
    Returns a dict storing both the Gemini chat and local history.
    """
    if not genai:
        print("Gemini API not configured. Chat is disabled.")
        return None

    try:
        model = genai.GenerativeModel(
            model_name=MODEL_NAME,
            generation_config=generation_config,
            safety_settings=safety_settings
        )
        # Standard default history setup
        chat = model.start_chat(history=[
            {
                "role": "model",
                "parts": [
                    "Got it! I'm OutfitAI, ready to help you look great for class or any event. Ask me anything or show an item."
                ]
            }
        ])
        
        # Wrap Gemini chat with local context
        return {
            "chat": chat,
            "history": deque(maxlen=MAX_CHAT_HISTORY)
        }
    except Exception as e:
        print(f"Error initializing Gemini model: {e}")
        return None


# --- Chat with context awareness and optional image (FIXED ARGUMENTS) ---
def chat_with_gemini(session_obj, user_prompt, image_base64=None):
    """
    Sends a message to Gemini. user_prompt MUST contain the system instruction 
    and all relevant context (weather, wardrobe).
    """
    if not session_obj:
        return "Chat feature is offline."

    chat_session = session_obj["chat"]
    local_history = session_obj["history"]

    # Append user prompt to local history (prompt already contains all context)
    if user_prompt:
        local_history.append({"role": "user", "content": user_prompt})

    # Build content parts for Gemini API
    content_parts = []
    if user_prompt:
        # Note: user_prompt now contains the System Instruction + Wardrobe/Weather Context + User Query
        content_parts.append(user_prompt)

    if image_base64:
        try:
            # Decode the base64 string to an image object
            image_data = base64.b64decode(image_base64.split(",")[1])
            img = Image.open(io.BytesIO(image_data))
            content_parts.append(img)
            print("Image decoded and added to chat content.")
        except Exception as img_e:
            print(f"Error decoding image: {img_e}")
            content_parts.append("[System note: Issue processing image]")

    if not content_parts:
        return "Please provide a message or an image."

    # --- Send to Gemini ---
    try:
        response = chat_session.send_message(content_parts)
        if not response.parts:
            safety_feedback = getattr(response, "prompt_feedback", "Possibly blocked by safety filter.")
            return f"Could not process request. Reason: {safety_feedback}"

        bot_text = response.text.strip()

        # Store bot reply in local history
        local_history.append({"role": "bot", "content": bot_text})

        return bot_text

    except Exception as e:
        print(f"Error during Gemini chat: {e}")
        return "AI is having trouble thinking right now. Try again later."


# --- Text-to-Speech Generation ---
def generate_tts_audio(text_to_speak, voice_name="Kore"):
    """
    Generates base64 encoded PCM audio data from text using the Gemini TTS model.
    """
    if not genai:
        return {"error": "TTS engine offline. Check API key."}
    
    try:
        # TTS configuration specifies AUDIO modality and the voice
        tts_config = {
            "response_modalities": ["AUDIO"],
            "speech_config": {
                "voice_config": {
                    "prebuilt_voice_config": {"voice_name": voice_name}
                }
            }
        }
        
        # We use generate_content for TTS, targeting the specialized model
        model = genai.GenerativeModel(TTS_MODEL_NAME)
        
        response = model.generate_content(
            contents=[text_to_speak],
            config=tts_config
        )
        
        # Extract audio data and MIME type from the response part
        if response.parts and response.parts[0].inline_data:
            audio_data = response.parts[0].inline_data.data
            mime_type = response.parts[0].inline_data.mime_type
            
            return {
                "audio_data": audio_data,
                "mime_type": mime_type
            }
        else:
            return {"error": "TTS failed to generate valid audio data."}

    except Exception as e:
        print(f"Error generating TTS audio: {e}")
        return {"error": f"Failed to generate audio: {e}"}


# --- Outfit Recommendation ---
def get_outfit_recommendation(weather_info, all_wardrobe_items, user_name):
    if not genai:
        return {"error": "Recommendation engine offline. Check API key."}

    if not all_wardrobe_items:
        return {"error": f"Hi {user_name}! Your wardrobe is empty. Upload items first."}

    try:
        model = genai.GenerativeModel(
            model_name=MODEL_NAME,
            generation_config=generation_config,
            safety_settings=safety_settings
        )
    except Exception as model_init_e:
        print(f"Error initializing recommendation model: {model_init_e}")
        return {"error": f"Sorry {user_name}, the AI model failed to initialize. Please check the logs."}

    # Weather/Date Context Generation
    now = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=2))) 
    current_time_str = now.strftime('%I:%M %p')
    current_date_str = now.strftime('%A, %B %d')

    wardrobe_list = "\n".join([
        f"- \"{item.get('name', 'Unnamed')}\" (ID: {item.get('id', 'N/A')}, Category: {item.get('category', 'Other')}, Description: {item.get('description', 'N/A')})"
        for item in all_wardrobe_items
    ])

    prompt = f"""
**ROLE:** You are "OutfitAI", a precise and creative university fashion stylist AI.
**USER:** My name is {user_name}.
**CONTEXT:** Location: Mbombela, South Africa, Date: {current_date_str}, Time: {current_time_str}
**CURRENT WEATHER:** Conditions: {weather_info.get('description', 'N/A')}, Temp: {weather_info.get('temp', 'N/A')}°C, Feels Like: {weather_info.get('feels_like', 'N/A')}°C, Wind: {weather_info.get('wind_kph', 'N/A')} kph
**AVAILABLE WARDROBE ITEMS (MUST USE ONLY THESE):**
{wardrobe_list}

**TASK:**
1. Analyze weather & wardrobe.
2. Select a complete outfit using ONLY items listed. If the items are weather inappropriate OR incomplete, return the structure for a *missing item suggestion* instead of a full outfit.
3. Return strict JSON. **DO NOT** wrap JSON in markdown.

**--- Successful Outfit Output Format (JSON) ---**
{{
    "greeting": "Hello {user_name}! Here is your outfit suggestion...",
    "outfit": [
        {{"type": "Top", "name": "Exact Item Name", "id": "Exact Item ID"}},
        {{"type": "Bottom", "name": "Exact Item Name", "id": "Exact Item ID"}},
        {{"type": "Shoes", "name": "Exact Item Name", "id": "Exact Item ID"}}
    ],
    "why_it_works": "Brief explanation why this outfit fits the weather and occasion.",
    "notes": "Optional tips or missing accessories."
}}

**--- Missing Item Suggestion Output Format (JSON) ---**
If the wardrobe is inappropriate for the weather (e.g., too few warm items for cold weather), use this:
{{
    "greeting": "Heads up! Your wardrobe is limited for this weather. ⚠️",
    "missing_item_suggestion": {{
        "message": "The temperature is {weather_info.get('temp')}°C with {weather_info.get('description')}, but you only have light jackets. You need a thicker layer for warmth.",
        "recommendation": "add a heavy winter coat, like a black puffer jacket, to your wardrobe."
    }},
    "why_it_works": "The AI prioritized your safety/comfort over style, recommending a missing item."
}}
"""

    try:
        response = model.generate_content(prompt)
        if not response.parts:
            safety_feedback = getattr(response, "prompt_feedback", "Reason unclear")
            return {"error": f"Sorry {user_name}, couldn't generate a recommendation. Reason: {safety_feedback}"}

        raw_text = response.text.strip()
        print(f"DEBUG: Raw response:\n{raw_text}")

        # Clean markdown if present
        if raw_text.startswith("```json"):
            raw_text = raw_text[7:-3].strip()
        elif raw_text.startswith("```"):
            raw_text = raw_text[3:-3].strip()

        try:
            json_data = json.loads(raw_text)
            return json_data
        except json.JSONDecodeError as json_e:
            print(f"JSON parsing failed: {json_e}\nText: {raw_text}")
            return {"error": f"Sorry {user_name}, AI output couldn't be parsed. Please try again."}

    except Exception as e:
        print(f"Error generating recommendation: {e}")
        return {"error": f"Sorry {user_name}, cannot generate recommendation right now. Try again later."}
# --- End of gemini_service.py ---