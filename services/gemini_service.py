import os
import google.generativeai as genai
from dotenv import load_dotenv
import datetime
import base64
import io
import json
import wave
from PIL import Image
from collections import deque
import hashlib
import numpy as np

# Modern Google GenAI SDK for Gemini Voice (TTS) and advanced modalities
try:
    from google import genai as modern_genai
    from google.genai import types as genai_types
except ImportError:
    modern_genai = None
    genai_types = None

# --- Load Environment Variables ---
load_dotenv()
API_KEY = os.getenv('GEMINI_API_KEY')

modern_client = None
if not API_KEY:
    print("CRITICAL: GEMINI_API_KEY not found in .env file.")
    genai = None
else:
    try:
        genai.configure(api_key=API_KEY)
    except Exception as e:
        print(f"Error configuring legacy Gemini: {e}")
        genai = None

    if modern_genai:
        try:
            modern_client = modern_genai.Client(api_key=API_KEY)
            print("Modern google-genai client initialized successfully.")
        except Exception as e:
            print(f"Warning: Failed to initialize modern google-genai client: {e}")

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

MODEL_NAME = "gemini-3.1-flash-lite-preview"
TTS_MODEL_NAME = "gemini-3.8-flash-lite-tts"
CANDIDATE_TEXT_MODELS = ["gemini-3.1-flash-lite-preview", "gemini-3-flash-preview", "gemini-flash-latest"]
CANDIDATE_TTS_MODELS = [
    "gemini-3.8-flash-lite-tts",
    "gemini-3.8-flash-tts",
    "gemini-3.1-flash-tts-preview",
    "gemini-2.5-flash-preview-tts",
    "gemini-2.5-pro-preview-tts"
]

# In-memory TTS Cache to make repeated listen clicks instantaneous (0ms latency)
_TTS_CACHE = {}


# --- Wardrobe Context Formatter for Chatbot ---
def format_wardrobe_for_chat(wardrobe_items: list) -> str:
    """
    Builds a structured, human-readable wardrobe manifest to ground the AI stylist
    in the user's actual clothes, colors, fits, fabrics, and laundry status.
    """
    if not wardrobe_items:
        return "The user's wardrobe is currently empty. Politely advise them to upload items in the Wardrobe tab."

    available = []
    laundry = []

    for item in wardrobe_items:
        name = item.get('name', 'Unnamed item')
        category = item.get('category', 'General')
        subcat = item.get('subcategory', '')
        colors = item.get('colors', [])
        color_str = ", ".join(colors) if isinstance(colors, list) else str(colors)
        fit = item.get('fit', '')
        material = item.get('material', '')
        styles = item.get('styles', [])
        styles_str = ", ".join(styles) if isinstance(styles, list) else str(styles)
        seasons = item.get('seasons', [])
        seasons_str = ", ".join(seasons) if isinstance(seasons, list) else str(seasons)

        details = []
        if subcat: details.append(f"Type: {subcat}")
        if color_str: details.append(f"Color: {color_str}")
        if fit and fit != 'Unknown': details.append(f"Fit: {fit}")
        if material and material != 'Unknown': details.append(f"Material: {material}")
        if styles_str: details.append(f"Styles: {styles_str}")
        if seasons_str: details.append(f"Seasons: {seasons_str}")

        item_line = f"- [{category}] \"{name}\" ({'; '.join(details)})"
        if item.get('in_laundry', False):
            laundry.append(item_line)
        else:
            available.append(item_line)

    lines = [
        f"TOTAL WARDROBE PIECES: {len(wardrobe_items)} ({len(available)} ready to wear, {len(laundry)} in laundry)",
        "",
        "AVAILABLE CLOTHING ITEMS (Ready to wear):"
    ]
    if available:
        lines.extend(available)
    else:
        lines.append("- (No available items; all pieces currently in laundry)")

    if laundry:
        lines.append("")
        lines.append("ITEMS CURRENTLY IN LAUNDRY (Do NOT recommend wearing unless washed):")
        lines.extend(laundry)

    return "\n".join(lines)


def format_active_outfit_for_chat(active_outfit: dict) -> str:
    """
    Builds context of the outfit currently displayed or selected on screen.
    """
    if not active_outfit:
        return ""

    lines = ["CURRENTLY DISPLAYED OUTFIT ON SCREEN:"]
    greeting = active_outfit.get('greeting')
    if greeting:
        lines.append(f"Look Title/Context: {greeting}")

    details = active_outfit.get('outfit_details', [])
    if not details and isinstance(active_outfit.get('outfit'), list):
        details = active_outfit.get('outfit')

    if details:
        lines.append("Garments in this Outfit:")
        for itm in details:
            name = itm.get('name', 'Item')
            cat = itm.get('type') or itm.get('category', 'Piece')
            sub = itm.get('subcategory', '')
            col = itm.get('colors', [])
            col_str = f" ({', '.join(col) if isinstance(col, list) else col})" if col else ""
            lines.append(f"- [{cat}{f' · {sub}' if sub else ''}] \"{name}\"{col_str}")

    why = active_outfit.get('why_it_works')
    if why:
        lines.append(f"Stylist Rationale: {why}")
    weather_ctx = active_outfit.get('weather_insight')
    if weather_ctx:
        lines.append(f"Upcoming Weather Forecast Trajectory: {weather_ctx}")

    lines.append("(The user may ask questions about this specific look, such as shoe swaps, jacket pairings, or weather suitability. Answer with intimate knowledge of these exact pieces!)")
    return "\n".join(lines)


# --- Initialize Chat Session ---
def initialize_gemini_chat():
    """
    Fallback session object for backwards compatibility.
    """
    return {"chat": None, "history": deque(maxlen=20)}


# --- Chat with Wardrobe Context, Active Outfit, and Message History ---
def chat_with_gemini(user_prompt: str, history_messages: list = None, wardrobe_items: list = None, weather_info: dict = None, image_base64: str = None, active_outfit: dict = None) -> str:
    """
    Sends a message to Gemini grounded in the user's wardrobe manifest, active outfit on screen, and conversation history.
    """
    if not genai and not modern_client:
        return "Chat feature is offline. Please verify API configuration."

    try:
        wardrobe_manifest = format_wardrobe_for_chat(wardrobe_items or [])
        weather_desc = ""
        if weather_info:
            time_part = f"Local Time: {weather_info.get('local_time', '')}. " if weather_info.get('local_time') else ""
            traj_part = f" | Upcoming Trajectory: {weather_info.get('hourly_trajectory_summary', '')}" if weather_info.get('hourly_trajectory_summary') else ""
            weather_desc = f"{time_part}Current Weather: {weather_info.get('description', 'Clear')}, {weather_info.get('temp', '20')}°C (Feels like {weather_info.get('feels_like', '20')}°C){traj_part}."

        outfit_context = format_active_outfit_for_chat(active_outfit)

        system_instruction = (
            "You are 'OutfitAI', an elite personal fashion stylist and atmospheric wardrobe curator. "
            "Your tone is chic, confident, articulate, and direct. "
            "CRITICAL: Keep your responses concise and punchy (1 to 3 sentences maximum). Deliver your style verdict immediately without throat-clearing preamble. "
            "Reference the user's ACTUAL wardrobe items by exact name (e.g., 'your Lacoste Sage Green Knit Polo', 'your Asics GEL-Kayano 14 Silver Sneakers'). "
            "Never suggest laundry items. Ground your advice in the current time and upcoming temperature/weather changes.\n\n"
            f"--- USER'S WARDROBE MANIFEST ---\n{wardrobe_manifest}\n\n"
            f"--- ENVIRONMENT CONTEXT ---\n{weather_desc}"
        )

        if outfit_context:
            system_instruction += f"\n\n--- ACTIVE LOOKBOOK SELECTION ---\n{outfit_context}"

        # Build contents with conversation history
        contents = []
        contents.append(f"[SYSTEM INSTRUCTION & CONTEXT]\n{system_instruction}")

        if history_messages:
            # Include recent turns (up to 8 messages)
            recent_turns = history_messages[-8:]
            for msg in recent_turns:
                r = msg.get('role', 'user')
                prefix = "User" if r == 'user' else "OutfitAI Stylist"
                contents.append(f"{prefix}: {msg.get('text', '')}")

        # Current user turn
        current_user_parts = []
        if user_prompt:
            current_user_parts.append(f"User: {user_prompt}")

        if image_base64:
            try:
                raw_b64 = image_base64.split(",")[1] if "," in image_base64 else image_base64
                image_data = base64.b64decode(raw_b64)
                img = Image.open(io.BytesIO(image_data))
                current_user_parts.append(img)
            except Exception as img_e:
                print(f"Error decoding image in chat: {img_e}")

        # Try candidate models with graceful failover (fastest first)
        for model_cand in CANDIDATE_TEXT_MODELS:
            try:
                if modern_client:
                    text_parts = [c for c in contents if isinstance(c, str)]
                    if current_user_parts:
                        for p in current_user_parts:
                            if isinstance(p, str):
                                text_parts.append(p)
                    resp = modern_client.models.generate_content(
                        model=model_cand,
                        contents="\n\n".join(text_parts)
                    )
                    if resp and resp.text:
                        return resp.text.strip()
                elif genai:
                    m = genai.GenerativeModel(model_name=model_cand)
                    resp = m.generate_content(contents)
                    if resp.parts:
                        return resp.text.strip()
            except Exception as cand_err:
                print(f"Notice: Model {model_cand} encountered ({cand_err}). Falling over to next model...")
                continue

        return "I'm curating your wardrobe details. How can I assist you with your outfit today?"

    except Exception as e:
        print(f"Error during Gemini chat: {e}")
        return "I'm having a brief moment of fashion contemplation. Please ask again in a second!"


# Persistent Server-Side Voice Cache Directory
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TTS_CACHE_DIR = os.path.join(PROJECT_ROOT, "data", "tts_cache")
try:
    os.makedirs(TTS_CACHE_DIR, exist_ok=True)
except Exception:
    pass

def _get_disk_tts_cache(cache_key: str) -> dict | None:
    try:
        h = hashlib.sha256(cache_key.encode("utf-8")).hexdigest()
        cache_file = os.path.join(TTS_CACHE_DIR, f"{h}.json")
        if os.path.exists(cache_file):
            with open(cache_file, "r", encoding="utf-8") as f:
                return json.load(f)
    except Exception as e:
        print(f"Error reading TTS disk cache: {e}")
    return None

def _save_disk_tts_cache(cache_key: str, payload: dict):
    try:
        h = hashlib.sha256(cache_key.encode("utf-8")).hexdigest()
        cache_file = os.path.join(TTS_CACHE_DIR, f"{h}.json")
        with open(cache_file, "w", encoding="utf-8") as f:
            json.dump(payload, f)
    except Exception as e:
        print(f"Error writing TTS disk cache: {e}")

def condition_gemini_pcm(pcm_bytes: bytes, sample_rate: int = 24000) -> bytes:
    """
    Conditions raw Gemini PCM audio and eliminates end-of-speech harsh noise, pops, and static:
    1. Ensures 16-bit 2-byte alignment.
    2. Subtracts any DC bias/offset across the recording.
    3. Smooth 10ms linear fade-in to prevent initial speaker clicks.
    4. Smooth 80ms cosine fade-out at the end to guarantee the waveform gently reaches true zero.
    5. Appends 60ms of clean digital silence (zero samples) as a tail buffer so browser DAC / decoders close silently without trailing noise.
    """
    if not pcm_bytes:
        return b""
    if len(pcm_bytes) % 2 != 0:
        pcm_bytes = pcm_bytes[:-(len(pcm_bytes) % 2)]
    
    try:
        samples = np.frombuffer(pcm_bytes, dtype=np.int16).astype(np.float32)
        if len(samples) < 200:
            return pcm_bytes
        
        # 1. Remove DC bias
        dc_offset = np.mean(samples)
        samples = samples - dc_offset
        
        # 2. Fade in first 10ms (240 samples at 24kHz)
        fade_in_len = min(int(sample_rate * 0.01), len(samples) // 10)
        if fade_in_len > 0:
            fade_in = np.linspace(0.0, 1.0, fade_in_len)
            samples[:fade_in_len] *= fade_in
            
        # 3. Fade out last 80ms (1920 samples at 24kHz) to eliminate abrupt cutoff & pink noise burst
        fade_out_len = min(int(sample_rate * 0.08), len(samples) // 2)
        if fade_out_len > 0:
            fade_out = 0.5 * (1.0 + np.cos(np.linspace(0, np.pi, fade_out_len)))
            samples[-fade_out_len:] *= fade_out
            
        # 4. Clamp to 16-bit boundaries
        samples = np.clip(samples, -32768, 32767).astype(np.int16)
        
        # 5. Add 60ms of digital silence padding so browser DAC closes completely silent
        silence_padding = np.zeros(int(sample_rate * 0.06), dtype=np.int16)
        clean_samples = np.concatenate([samples, silence_padding])
        
        return clean_samples.tobytes()
    except Exception as e:
        print(f"PCM conditioning fallback: {e}")
        return pcm_bytes


# --- Text-to-Speech Generation using Gemini Voice ---
def generate_tts_audio(text_to_speak: str, voice_name: str = "Kore") -> dict:
    """
    Generates browser-playable WAV audio data from text using Gemini TTS models.
    Converts 24kHz 16-bit mono PCM into a standard WAV container with smooth fade-out.
    Features dual-tier memory & disk caching for fast loading.
    """
    import re
    raw_text = text_to_speak.strip()
    if not raw_text:
        return {"error": "No text provided for voice generation."}

    # Clean text to strip asterisks, markdown bullets, and links for clean speech
    clean_text = re.sub(r'[*_#`~]', '', raw_text)
    clean_text = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', clean_text)
    clean_text = re.sub(r'\s+', ' ', clean_text).strip()

    # Limit text length to optimize TTS latency (fast synthesis)
    if len(clean_text) > 350:
        clean_text = clean_text[:350] + "..."

    valid_voices = ["Kore", "Aoede", "Puck", "Charon", "Fenrir"]
    chosen_voice = voice_name if voice_name in valid_voices else "Kore"

    # 1. Check in-memory cache for instant replay (0ms latency)
    cache_key = f"{chosen_voice}:{clean_text}"
    if cache_key in _TTS_CACHE:
        return _TTS_CACHE[cache_key]

    # 2. Check persistent disk cache (1ms latency)
    disk_cached = _get_disk_tts_cache(cache_key)
    if disk_cached:
        _TTS_CACHE[cache_key] = disk_cached
        return disk_cached

    # 3. Call Gemini TTS with model cascade
    if modern_client and genai_types:
        for tts_model in CANDIDATE_TTS_MODELS:
            try:
                response = modern_client.models.generate_content(
                    model=tts_model,
                    contents=clean_text,
                    config=genai_types.GenerateContentConfig(
                        response_modalities=["AUDIO"],
                        speech_config=genai_types.SpeechConfig(
                            voice_config=genai_types.VoiceConfig(
                                prebuilt_voice_config=genai_types.PrebuiltVoiceConfig(voice_name=chosen_voice)
                            )
                        )
                    )
                )

                if response.candidates and response.candidates[0].content.parts:
                    part = response.candidates[0].content.parts[0]
                    if part.inline_data and part.inline_data.data:
                        raw_pcm_bytes = part.inline_data.data
                        # Clean and condition PCM: eliminate abrupt cuts, DC pops & trailing pink noise
                        clean_pcm_bytes = condition_gemini_pcm(raw_pcm_bytes, 24000)

                        # Pack into standard WAV container (24kHz, 16-bit, mono)
                        wav_io = io.BytesIO()
                        with wave.open(wav_io, "wb") as wf:
                            wf.setnchannels(1)
                            wf.setsampwidth(2)
                            wf.setframerate(24000)
                            wf.writeframes(clean_pcm_bytes)
                        wav_bytes = wav_io.getvalue()
                        wav_b64 = base64.b64encode(wav_bytes).decode("utf-8")

                        payload = {
                            "audio_base64": wav_b64,
                            "mime_type": "audio/wav",
                            "voice": chosen_voice
                        }

                        # Save to both in-memory cache and persistent disk cache
                        if len(_TTS_CACHE) > 200:
                            _TTS_CACHE.pop(next(iter(_TTS_CACHE)))
                        _TTS_CACHE[cache_key] = payload
                        _save_disk_tts_cache(cache_key, payload)
                        return payload

            except Exception as e:
                print(f"Gemini TTS error on model {tts_model}: {e}")
                continue

    return {"error": "Gemini Voice TTS service is temporarily unavailable."}



# --- Clothing Recognition & Classification Taxonomy ---
CLOTHING_TAXONOMY = {
    "Tops": ["T-Shirt", "Polo", "Shirt", "Blouse", "Tank Top", "Crop Top", "Hoodie", "Sweatshirt", "Sweater", "Cardigan", "Long Sleeve Top", "Jersey"],
    "Bottoms": ["Jeans", "Trousers", "Chinos", "Cargo Pants", "Sweatpants", "Shorts", "Skirt", "Leggings"],
    "Dresses": ["Mini Dress", "Midi Dress", "Maxi Dress", "Bodycon Dress", "Shirt Dress", "Casual Dress", "Formal Dress"],
    "Outerwear": ["Jacket", "Denim Jacket", "Bomber Jacket", "Leather Jacket", "Blazer", "Coat", "Trench Coat", "Puffer Jacket", "Windbreaker"],
    "Shoes": ["Sneakers", "Running Shoes", "Boots", "Chelsea Boots", "Loafers", "Formal Shoes", "Sandals", "Slides", "Heels", "Flats"],
    "Accessories": ["Cap", "Hat", "Beanie", "Bag", "Backpack", "Belt", "Watch", "Sunglasses", "Scarf", "Jewellery"],
    "Activewear": ["Sports Bra", "Gym Tops", "Gym Shorts", "Leggings", "Tracksuit", "Compression Wear", "Football Jersey"],
    "Formalwear": ["Suit", "Tuxedo", "Evening Gown", "Tailored Trousers", "Waistcoat"],
    "Swimwear": ["Swimsuit", "Swim Shorts", "Bikini", "Cover-up"]
}


def analyze_clothing_item(image_input):
    """
    Uses Gemini Multimodal Vision to recognize and classify a clothing item.
    Returns structured metadata:
    - name: Human-friendly name (e.g. 'Black Oversized Hoodie')
    - category & subcategory hierarchy
    - colors, pattern, material, fit, styles, seasons, formality, occasion
    - confidence score
    """
    if not genai:
        return _fallback_clothing_metadata("AI service offline. Please enter item details manually.")

    try:
        # Load image into PIL Image if needed
        if isinstance(image_input, str):
            img = Image.open(image_input).convert("RGB")
        elif isinstance(image_input, bytes):
            img = Image.open(io.BytesIO(image_input)).convert("RGB")
        elif hasattr(image_input, "read"):
            image_input.seek(0)
            img = Image.open(io.BytesIO(image_input.read())).convert("RGB")
        elif isinstance(image_input, Image.Image):
            img = image_input.convert("RGB")
        else:
            return _fallback_clothing_metadata("Unsupported image input format.")
    except Exception as img_err:
        print(f"Error opening image for Gemini analysis: {img_err}")
        return _fallback_clothing_metadata("Could not decode image file.")

    system_prompt = f"""
You are OutfitAI's master fashion curator and computer vision expert.
Analyze the clothing item in the provided image and extract its properties.

STRICT TAXONOMY:
Categories & Subcategories:
{json.dumps(CLOTHING_TAXONOMY, indent=2)}

NAMING RULES:
Generate a clean, HUMAN-FRIENDLY wardrobe name combining visual attributes:
[Color] + [Distinctive characteristic / fit] + [Garment type]
Examples:
- "Black Oversized Hoodie"
- "White Ribbed Tank Top"
- "Dark Blue Straight-Leg Jeans"
- "Beige Relaxed-Fit Chinos"
- "Black Leather Chelsea Boots"
- "Grey Oversized Crewneck"
- "Sage Green Knit Polo Shirt"
NEVER output generic names like "IMG_4928", "Garment", "Clothing", "Top", "Item".

ACCURACY RULES:
- If confidence is low between two subcategories, select the broader or most common accurate one.
- DO NOT hallucinate attributes that cannot reasonably be inferred from the image. Use "Unknown" if unclear.
- Format colors as clean capitalized strings (e.g. ["Black"], ["Navy", "White"]).
- Format pattern as one of: Solid, Striped, Checked, Plaid, Floral, Graphic, Camo, Polka Dot, Abstract, Textured, or Unknown.
- Format fit as: Slim, Regular, Relaxed, Oversized, Skinny, Straight, Wide-leg, Cropped, or Unknown.
- Format seasons as array from: ["Spring", "Summer", "Autumn", "Winter"].
- Format formality as: "Casual", "Smart Casual", "Business Casual", or "Formal".
- Return confidence as a float from 0.50 to 0.99 reflecting visual certainty.

OUTPUT SCHEMA (Must be pure valid JSON):
{{
  "name": "Human-friendly item name",
  "category": "One of primary categories",
  "subcategory": "One of subcategories for this category",
  "colors": ["Primary Color", "Secondary Color"],
  "pattern": "Solid / Striped / Graphic / etc.",
  "material": "Cotton / Denim / Leather / Knit / Polyester / etc.",
  "fit": "Regular / Oversized / Slim / etc.",
  "styles": ["Casual", "Streetwear", etc.],
  "seasons": ["Autumn", "Winter", etc.],
  "formality": "Casual / Smart Casual / etc.",
  "occasion": ["Everyday", "Casual Outing", etc.],
  "confidence": 0.95
}}
"""

    for m_name in CANDIDATE_TEXT_MODELS:
        try:
            if modern_client:
                img_byte_arr = io.BytesIO()
                img.save(img_byte_arr, format='JPEG')
                img_bytes = img_byte_arr.getvalue()
                part = genai_types.Part.from_bytes(data=img_bytes, mime_type="image/jpeg") if genai_types else img
                response = modern_client.models.generate_content(
                    model=m_name,
                    contents=[system_prompt, "Identify and classify this clothing item precisely.", part],
                    config=genai_types.GenerateContentConfig(
                        temperature=0.15,
                        response_mime_type="application/json"
                    ) if genai_types else None
                )
                if response and response.text:
                    parsed_data = _safe_parse_json(response.text.strip())
                    if parsed_data:
                        sanitized = _sanitize_clothing_data(parsed_data)
                        sanitized["ai_identified"] = True
                        return sanitized
            elif genai:
                model = genai.GenerativeModel(
                    model_name=m_name,
                    generation_config={"temperature": 0.15, "response_mime_type": "application/json"},
                    safety_settings=safety_settings
                )
                response = model.generate_content([system_prompt, "Identify and classify this clothing item precisely.", img])
                if response and response.parts:
                    parsed_data = _safe_parse_json(response.text.strip())
                    if parsed_data:
                        sanitized = _sanitize_clothing_data(parsed_data)
                        sanitized["ai_identified"] = True
                        return sanitized
        except Exception as e:
            print(f"Notice: Model {m_name} clothing analysis error ({e}). Trying next model...")
            continue

    return _fallback_clothing_metadata("AI recognition encountered an issue. You can enter details manually.")


def _safe_parse_json(text: str) -> dict:
    """Safely extracts and parses JSON even if wrapped in markdown code blocks or conversational text."""
    if not text:
        return None
    cleaned = text.strip()
    
    import re
    # 1. Check for ```json ... ``` or ``` ... ```
    code_block = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', cleaned)
    if code_block:
        candidate = code_block.group(1).strip()
        try:
            return json.loads(candidate)
        except Exception:
            pass

    # 2. Try direct JSON parse
    try:
        return json.loads(cleaned)
    except Exception:
        pass

    # 3. Regex search for outermost JSON object {...}
    match = re.search(r'(\{[\s\S]*\})', cleaned)
    if match:
        try:
            return json.loads(match.group(1))
        except Exception:
            pass

    print(f"Warning: Failed to parse JSON from text: {text[:200]}...")
    return None


def _sanitize_clothing_data(data: dict) -> dict:
    """Validates and applies defaults according to the clothing taxonomy."""
    category = data.get("category", "Tops")
    if category not in CLOTHING_TAXONOMY:
        # Map close matches
        cat_lower = str(category).lower()
        matched = False
        for valid_cat in CLOTHING_TAXONOMY:
            if valid_cat.lower() in cat_lower or cat_lower in valid_cat.lower():
                category = valid_cat
                matched = True
                break
        if not matched:
            category = "Tops"

    allowed_subs = CLOTHING_TAXONOMY.get(category, [])
    subcategory = data.get("subcategory", allowed_subs[0] if allowed_subs else "Item")
    if subcategory not in allowed_subs:
        # Check case-insensitive match
        sub_lower = str(subcategory).lower()
        matched_sub = False
        for s in allowed_subs:
            if s.lower() == sub_lower or s.lower() in sub_lower:
                subcategory = s
                matched_sub = True
                break
        if not matched_sub:
            subcategory = allowed_subs[0] if allowed_subs else category

    name = data.get("name")
    if not name or len(name.strip()) < 3 or name.lower() in ["garment", "clothing", "item", "top"]:
        name = f"{data.get('colors', ['Classic'])[0] if data.get('colors') else 'Classic'} {subcategory}"

    colors = data.get("colors", [])
    if isinstance(colors, str):
        colors = [colors]
    colors = [str(c).title() for c in colors if c]
    if not colors:
        colors = ["Multi-color"]

    styles = data.get("styles", ["Casual"])
    if isinstance(styles, str):
        styles = [styles]
    styles = [str(s).title() for s in styles if s]

    seasons = data.get("seasons", ["All Season"])
    if isinstance(seasons, str):
        seasons = [seasons]
    seasons = [str(s).title() for s in seasons if s]

    occasion = data.get("occasion", ["Everyday"])
    if isinstance(occasion, str):
        occasion = [occasion]
    occasion = [str(o).title() for o in occasion if o]

    try:
        conf = float(data.get("confidence", 0.90))
        if conf > 1.0: # e.g. 95 instead of 0.95
            conf = conf / 100.0
        conf = max(0.50, min(0.99, conf))
    except (ValueError, TypeError):
        conf = 0.88

    return {
        "name": str(name).strip(),
        "category": category,
        "subcategory": subcategory,
        "colors": colors,
        "pattern": str(data.get("pattern") or "Solid").capitalize(),
        "material": str(data.get("material") or "Unknown").capitalize(),
        "fit": str(data.get("fit") or "Regular").capitalize(),
        "styles": styles if styles else ["Casual"],
        "seasons": seasons if seasons else ["All Season"],
        "formality": str(data.get("formality") or "Casual").title(),
        "occasion": occasion if occasion else ["Everyday"],
        "confidence": round(conf, 2)
    }


def _fallback_clothing_metadata(message: str = None) -> dict:
    """Provides a safe default metadata structure when AI recognition cannot complete."""
    return {
        "name": "New Wardrobe Garment",
        "category": "Tops",
        "subcategory": "T-Shirt",
        "colors": ["Black"],
        "pattern": "Solid",
        "material": "Cotton",
        "fit": "Regular",
        "styles": ["Casual"],
        "seasons": ["All Season"],
        "formality": "Casual",
        "occasion": ["Everyday"],
        "confidence": 0.50,
        "ai_identified": False,
        "notice": message or "We couldn't confidently identify this item. You can enter the details manually."
    }
# --- Outfit Recommendation with Hourly Weather Trajectory ---
def get_outfit_recommendation(weather_info, all_wardrobe_items, user_name):
    if not genai and not modern_client:
        return {"error": "Recommendation engine offline. Check API key."}

    if not all_wardrobe_items:
        return {"error": f"Hi {user_name}! Your wardrobe is empty. Upload items first."}

    # Location-Aware Time & Date Context
    current_time_str = weather_info.get('local_time') or datetime.datetime.now().strftime('%I:%M %p')
    current_date_str = weather_info.get('local_date') or datetime.datetime.now().strftime('%A, %B %d')

    # Rich item details for intelligent outfit styling
    wardrobe_list_items = []
    for item in all_wardrobe_items:
        attrs = []
        if item.get('colors'):
            attrs.append(f"Colors: {', '.join(item['colors']) if isinstance(item['colors'], list) else item['colors']}")
        if item.get('material'):
            attrs.append(f"Material: {item['material']}")
        if item.get('fit'):
            attrs.append(f"Fit: {item['fit']}")
        if item.get('styles'):
            attrs.append(f"Styles: {', '.join(item['styles']) if isinstance(item['styles'], list) else item['styles']}")
        if item.get('seasons'):
            attrs.append(f"Seasons: {', '.join(item['seasons']) if isinstance(item['seasons'], list) else item['seasons']}")
        if item.get('formality'):
            attrs.append(f"Formality: {item['formality']}")
        attr_str = f" [{'; '.join(attrs)}]" if attrs else ""
        wardrobe_list_items.append(
            f"- \"{item.get('name', 'Unnamed')}\" (ID: {item.get('id', 'N/A')}, Category: {item.get('category', 'Other')}, Subcategory: {item.get('subcategory', 'N/A')}){attr_str}"
        )
    wardrobe_list = "\n".join(wardrobe_list_items)

    # --- Hourly Weather Trajectory Analysis (Next 3-6 Hours) ---
    hourly_data = weather_info.get('hourly_forecast', [])
    hourly_progression_lines = []
    upcoming_temps = []
    max_rain_chance = 0
    for h in hourly_data[:6]:
        t_c = h.get('temp_c')
        rain = h.get('chance_of_rain', 0)
        time_lbl = h.get('time', '')
        rel_lbl = h.get('rel_label', '')
        cond = h.get('condition', '')
        if t_c is not None:
            upcoming_temps.append(float(t_c))
            max_rain_chance = max(max_rain_chance, int(rain or 0))
            time_tag = f"{time_lbl} ({rel_lbl})" if rel_lbl else time_lbl
            cond_tag = f", {cond}" if cond else ""
            hourly_progression_lines.append(f"{time_tag}: {round(t_c)}°C{cond_tag} ({rain}% rain risk)")

    hourly_timeline_str = " -> ".join(hourly_progression_lines) if hourly_progression_lines else "Hourly timeline unavailable"

    current_temp = weather_info.get('temp', 20)
    current_desc = weather_info.get('description', 'Clear')
    feels_like = weather_info.get('feels_like', current_temp)

    if upcoming_temps:
        min_temp = min(upcoming_temps)
        max_temp = max(upcoming_temps)
        temp_delta = upcoming_temps[-1] - upcoming_temps[0]
        trend_desc = (
            f"Expected to cool down significantly by {abs(round(temp_delta))}°C over the next few hours."
            if temp_delta <= -2 else
            f"Expected to warm up by {round(temp_delta)}°C over the next few hours."
            if temp_delta >= 2 else
            "Steady temperatures expected throughout the upcoming hours."
        )
        weather_trajectory_summary = (
            f"Current Time: {current_time_str} | Current Weather: {current_temp}°C ({current_desc}), Feels like {feels_like}°C.\n"
            f"Next Few Hours Range: {round(min_temp)}°C to {round(max_temp)}°C. {trend_desc}\n"
            f"Rain Probability Peak: {max_rain_chance}%.\n"
            f"Detailed Timeline: {hourly_timeline_str}"
        )
    else:
        weather_trajectory_summary = f"Current Time: {current_time_str} | Current: {current_temp}°C ({current_desc}), Feels like {feels_like}°C."
        min_temp = current_temp
        max_temp = current_temp

    prompt = f"""
**ROLE:** You are "OutfitAI", a master sartorial stylist and atmospheric wardrobe curator.
**USER:** My name is {user_name}.
**CONTEXT:** Location: {weather_info.get('city', 'Mbombela, South Africa')}, Date: {current_date_str}, Time: {current_time_str}

**HOURLY WEATHER TRAJECTORY (CRITICAL: PREVENT OVERDRESSING & UNDERDRESSING):**
{weather_trajectory_summary}

**AVAILABLE WARDROBE ITEMS (MUST SELECT ONLY FROM THIS LIST):**
{wardrobe_list}

**CORE STYLING TASK & WEATHER ADAPTATION RULES:**
1. **PREVENT OVERDRESSING AND UNDERDRESSING ACROSS UPCOMING HOURS:**
   - Do NOT just look at current temperature. Anticipate the upcoming temperature trajectory over the next 4-6 hours!
   - **Temperature Drop**: If the temperature will drop into the afternoon/evening or wind picks up, prescribe smart layering (recommend a base Top PLUS a complementary Outerwear/Layer such as a jacket, cardigan, overshirt, or hoodie) so the user doesn't freeze later.
   - **Temperature Rise**: If the weather will warm up significantly, choose a breathable base layer so the user can comfortably shed their layer and avoid overheating.
   - **Rain Risk**: If rain chance is high (>30%), prioritize footwear and outer fabrics suited for wet weather (avoid delicate suede or open shoes).
2. **COHESION & SILHOUETTE:** Ensure top, bottom, shoes, and optional layer coordinate cleanly in palette, fit, and formality.
3. **STRICT JSON OUTPUT:** Return ONLY valid JSON. No markdown code wraps, no conversational preamble.

**--- Successful Outfit Output Format (JSON) ---**
{{
    "greeting": "Hello {user_name}! Here is your weather-adapted look...",
    "weather_insight": "Concise 1-sentence breakdown of upcoming hours weather trajectory and how this styling prevents over or underdressing.",
    "outfit": [
        {{"type": "Top", "name": "Exact Item Name", "id": "Exact Item ID"}},
        {{"type": "Bottom", "name": "Exact Item Name", "id": "Exact Item ID"}},
        {{"type": "Shoes", "name": "Exact Item Name", "id": "Exact Item ID"}},
        {{"type": "Outerwear", "name": "Exact Item Name", "id": "Exact Item ID"}} // Optional: Include Outerwear/Layer if temperature drop or rain calls for layering!
    ],
    "why_it_works": "Detailed explanation explaining why this pairing balances color, silhouette, current temperature, and specifically the next few hours weather changes.",
    "notes": "Styling guidance, such as how to wear the layer or carry accessories as conditions shift."
}}

**--- Missing Item Suggestion Output Format (JSON) ---**
If the available wardrobe pieces cannot assemble a complete weather-appropriate outfit (e.g. missing warm layers for severe drops, or no available bottoms):
{{
    "greeting": "Heads up {user_name}! Your wardrobe is missing key pieces for today's forecast. ⚠️",
    "weather_insight": "Temperature swings to {round(min_temp)}°C require specific garments.",
    "missing_item_suggestion": {{
        "message": "The weather forecast projects temperatures reaching {round(min_temp)}°C with {weather_info.get('description', 'changing weather')}, but you are missing an appropriate layer.",
        "recommendation": "Add a versatile layering piece (like a lightweight denim jacket, knit cardigan, or neutral trench) to your wardrobe."
    }},
    "why_it_works": "The stylist prioritized your real-world comfort and weather protection over incomplete pairings."
}}
"""

    for model_cand in CANDIDATE_TEXT_MODELS:
        try:
            if modern_client:
                resp = modern_client.models.generate_content(
                    model=model_cand,
                    contents=prompt
                )
                if resp and resp.text:
                    parsed = _safe_parse_json(resp.text.strip())
                    if parsed:
                        return parsed
            elif genai:
                m = genai.GenerativeModel(model_name=model_cand)
                resp = m.generate_content(
                    prompt,
                    generation_config={"temperature": 0.35, "response_mime_type": "application/json"}
                )
                if resp and resp.parts:
                    parsed = _safe_parse_json(resp.text.strip())
                    if parsed:
                        return parsed
        except Exception as cand_err:
            print(f"Notice: Model {model_cand} recommendation error ({cand_err}). Trying fallback...")
            continue

    return {"error": f"Sorry {user_name}, could not generate outfit recommendation at this moment. Please try again."}