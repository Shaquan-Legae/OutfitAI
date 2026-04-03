import base64
import datetime
import io
import json
import os
from collections import deque

from dotenv import load_dotenv
from PIL import Image

try:
    from google import genai
    from google.genai import types
except ImportError:
    genai = None
    types = None


class GeminiServiceError(RuntimeError):
    def __init__(self, message, status_code=503):
        super().__init__(message)
        self.status_code = status_code


load_dotenv()
API_KEY = os.getenv("GEMINI_API_KEY")

MODEL_NAME = os.getenv("GEMINI_TEXT_MODEL", "gemini-2.5-flash")
TTS_MODEL_NAME = os.getenv("GEMINI_TTS_MODEL", "gemini-2.5-flash-preview-tts")

GENERATION_CONFIG = {
    "temperature": 0.7,
    "top_p": 1,
    "top_k": 1,
    "max_output_tokens": 2048,
}

SAFETY_SETTINGS = [
    {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
    {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
    {
        "category": "HARM_CATEGORY_SEXUALLY_EXPLICIT",
        "threshold": "BLOCK_MEDIUM_AND_ABOVE",
    },
    {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
]

MAX_CHAT_HISTORY = 10


def _build_client():
    if not genai:
        print("CRITICAL: google-genai is not installed. Install it with `pip install google-genai`.")
        return None

    if not API_KEY:
        print("CRITICAL: GEMINI_API_KEY not found in .env file.")
        return None

    try:
        return genai.Client(api_key=API_KEY)
    except Exception as e:
        print(f"Error creating Gemini client: {e}")
        return None


client = _build_client()


def _extract_text_response(response):
    if getattr(response, "text", None):
        return response.text.strip()

    candidates = getattr(response, "candidates", None) or []
    if not candidates:
        return ""

    parts = getattr(candidates[0].content, "parts", None) or []
    text_parts = [part.text.strip() for part in parts if getattr(part, "text", None)]
    return "\n".join(text_parts).strip()


def _decode_image_from_base64(image_base64):
    raw_payload = image_base64.split(",", 1)[-1]
    image_data = base64.b64decode(raw_payload)
    return Image.open(io.BytesIO(image_data))


def _chat_config():
    return {
        **GENERATION_CONFIG,
        "safety_settings": SAFETY_SETTINGS,
    }


def initialize_gemini_chat():
    if not client:
        print("Gemini API not configured. Chat is disabled.")
        return None

    return {
        "client": client,
        "history": deque(maxlen=MAX_CHAT_HISTORY),
    }


def chat_with_gemini(session_obj, user_prompt, image_base64=None):
    if not session_obj or not session_obj.get("client"):
        raise GeminiServiceError("Chat feature is offline. Check Gemini configuration.")

    message_parts = []
    if user_prompt:
        message_parts.append(user_prompt)

    if image_base64:
        try:
            message_parts.append(_decode_image_from_base64(image_base64))
            print("Image decoded and added to chat content.")
        except Exception as img_e:
            print(f"Error decoding image: {img_e}")
            raise GeminiServiceError("The uploaded image could not be processed.", 400) from img_e

    if not message_parts:
        raise GeminiServiceError("Please provide a message or an image.", 400)

    history = list(session_obj["history"])
    chat = session_obj["client"].chats.create(
        model=MODEL_NAME,
        config=_chat_config(),
        history=history,
    )

    try:
        response = chat.send_message(message_parts if len(message_parts) > 1 else message_parts[0])
        bot_text = _extract_text_response(response)

        if not bot_text:
            safety_feedback = getattr(response, "prompt_feedback", None) or "No response text was returned."
            raise GeminiServiceError(f"Could not process request. Reason: {safety_feedback}", 502)

        session_obj["history"].clear()
        session_obj["history"].extend(chat.get_history(curated=True)[-MAX_CHAT_HISTORY:])
        return bot_text

    except GeminiServiceError:
        raise
    except Exception as e:
        print(f"Error during Gemini chat: {e}")
        raise GeminiServiceError("AI is having trouble thinking right now. Try again later.") from e


def generate_tts_audio(text_to_speak, voice_name="Kore"):
    if not client:
        raise GeminiServiceError("TTS engine is offline. Check Gemini configuration.")

    try:
        response = client.models.generate_content(
            model=TTS_MODEL_NAME,
            contents=text_to_speak,
            config=types.GenerateContentConfig(
                response_modalities=["AUDIO"],
                speech_config=types.SpeechConfig(
                    voice_config=types.VoiceConfig(
                        prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name=voice_name)
                    )
                ),
            ),
        )

        for candidate in response.candidates or []:
            for part in candidate.content.parts or []:
                if getattr(part, "inline_data", None) and part.inline_data.data:
                    return {
                        "audio_data": base64.b64encode(part.inline_data.data).decode("ascii"),
                        "mime_type": part.inline_data.mime_type,
                    }

        raise GeminiServiceError("TTS failed to generate valid audio data.", 502)

    except GeminiServiceError:
        raise
    except Exception as e:
        print(f"Error generating TTS audio: {e}")
        raise GeminiServiceError(f"Failed to generate audio: {e}") from e


def get_outfit_recommendation(weather_info, all_wardrobe_items, user_name):
    if not client:
        raise GeminiServiceError("Recommendation engine is offline. Check Gemini configuration.")

    if not all_wardrobe_items:
        return {"error": f"Hi {user_name}! Your wardrobe is empty. Upload items first."}

    now = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=2)))
    current_time_str = now.strftime("%I:%M %p")
    current_date_str = now.strftime("%A, %B %d")

    wardrobe_list = "\n".join(
        [
            f'- "{item.get("name", "Unnamed")}" (ID: {item.get("id", "N/A")}, '
            f'Category: {item.get("category", "Other")}, '
            f'Description: {item.get("description", "N/A")})'
            for item in all_wardrobe_items
        ]
    )

    prompt = f"""
**ROLE:** You are "OutfitAI", a precise and creative university fashion stylist AI.
**USER:** My name is {user_name}.
**CONTEXT:** Location: Mbombela, South Africa, Date: {current_date_str}, Time: {current_time_str}
**CURRENT WEATHER:** Conditions: {weather_info.get('description', 'N/A')}, Temp: {weather_info.get('temp', 'N/A')} C, Feels Like: {weather_info.get('feels_like', 'N/A')} C, Wind: {weather_info.get('wind_kph', 'N/A')} kph
**AVAILABLE WARDROBE ITEMS (MUST USE ONLY THESE):**
{wardrobe_list}

**TASK:**
1. Analyze weather and wardrobe.
2. Select a complete outfit using ONLY items listed. If the items are weather inappropriate OR incomplete, return the structure for a missing item suggestion instead of a full outfit.
3. Return strict JSON. DO NOT wrap JSON in markdown.

**Successful Outfit Output Format (JSON)**
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

**Missing Item Suggestion Output Format (JSON)**
If the wardrobe is inappropriate for the weather, use this:
{{
    "greeting": "Heads up! Your wardrobe is limited for this weather.",
    "missing_item_suggestion": {{
        "message": "The temperature is {weather_info.get('temp')} C with {weather_info.get('description')}, but your wardrobe does not have enough suitable layers.",
        "recommendation": "Add a weather-appropriate layer or staple item to your wardrobe."
    }},
    "why_it_works": "The AI prioritized comfort over style and recommended the missing item."
}}
"""

    try:
        response = client.models.generate_content(
            model=MODEL_NAME,
            contents=prompt,
            config={
                **GENERATION_CONFIG,
                "response_mime_type": "application/json",
                "safety_settings": SAFETY_SETTINGS,
            },
        )

        raw_text = _extract_text_response(response)
        if not raw_text:
            safety_feedback = getattr(response, "prompt_feedback", None) or "No JSON response was returned."
            raise GeminiServiceError(
                f"Sorry {user_name}, couldn't generate a recommendation. Reason: {safety_feedback}",
                502,
            )

        print(f"DEBUG: Raw response:\n{raw_text}")
        return json.loads(raw_text)

    except GeminiServiceError:
        raise
    except json.JSONDecodeError as json_e:
        print(f"JSON parsing failed: {json_e}")
        raise GeminiServiceError(
            f"Sorry {user_name}, AI output couldn't be parsed. Please try again.",
            502,
        ) from json_e
    except Exception as e:
        print(f"Error generating recommendation: {e}")
        raise GeminiServiceError(
            f"Sorry {user_name}, cannot generate recommendation right now. Try again later."
        ) from e
