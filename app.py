# /OutfitAI/app.py

from flask import Flask, render_template, request, jsonify, redirect, url_for, session, flash
from services import firebase_service, weather_service, tensorflow_service, gemini_service
import os
import datetime
import mimetypes
import json
from werkzeug.utils import secure_filename
import base64 # Included for potential multimodal needs

app = Flask(__name__)
# Stable secret key for persistent session durability across server reloads
app.secret_key = os.getenv('SECRET_KEY', 'outfitai_secure_session_key_atelier_2026')
app.config['PERMANENT_SESSION_LIFETIME'] = datetime.timedelta(days=30)
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'

# --- Folder Setup for Local Storage ---
BASE_STATIC_FOLDER = os.path.join(app.root_path, 'static')
UPLOAD_FOLDER = os.path.join(BASE_STATIC_FOLDER, 'uploads')
METADATA_FOLDER = os.path.join(BASE_STATIC_FOLDER, 'metadata')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(METADATA_FOLDER, exist_ok=True)

# Define the system instruction globally
CHATBOT_SYSTEM_INSTRUCTION = (
    "You are a helpful, friendly, and expert clothing and style AI assistant named OutfitAI. "
    "Your primary function is to help the user with wardrobe questions and offer styling advice."
)

# --- Helper Functions ---

def get_time_based_greeting():
    """Generates a greeting based on the time of day."""
    hour = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=2))).hour
    if hour < 12:
        return "Good morning"
    elif hour < 18:
        return "Good afternoon"
    else:
        return "Good evening"


def is_allowed_file(filename):
    """Checks if the file's extension is an allowed image type"""
    mimetype, _ = mimetypes.guess_type(filename)
    return mimetype and mimetype.startswith('image/')

def get_metadata_path(filename):
    """Returns the full path to the metadata JSON file."""
    # Ensure filename doesn't already have .json if called directly
    if filename.endswith('.json'):
        base_filename = filename[:-5]
    else:
        base_filename = filename
    return os.path.join(METADATA_FOLDER, f"{base_filename}.json")


CATEGORY_MIGRATION_MAP = {
    'Pants': ('Bottoms', 'Trousers'),
    'Shorts & Skirts': ('Bottoms', 'Shorts'),
    'Jackets & Coats': ('Outerwear', 'Jacket'),
    'Sweaters & Hoodies': ('Tops', 'Hoodie'),
    'Dresses & Jumpsuits': ('Dresses', 'Casual Dress')
}


def normalize_wardrobe_item(data: dict, fallback_id: str = None) -> dict:
    """Ensures wardrobe items have a consistent, rich metadata schema."""
    item_id = data.get('id') or fallback_id or 'unnamed_item'
    filename = data.get('filename') or (fallback_id if fallback_id and not fallback_id.endswith('.json') else None)
    if not filename and item_id and ('.' in item_id):
        filename = item_id

    # Category normalization
    category = data.get('category', 'Tops')
    subcategory = data.get('subcategory')
    if category in CATEGORY_MIGRATION_MAP:
        new_cat, default_sub = CATEGORY_MIGRATION_MAP[category]
        category = new_cat
        if not subcategory:
            subcategory = default_sub

    if not subcategory:
        allowed_subs = gemini_service.CLOTHING_TAXONOMY.get(category, [])
        subcategory = allowed_subs[0] if allowed_subs else 'Item'

    # Colors
    colors = data.get('colors') or data.get('color') or []
    if isinstance(colors, str):
        colors = [c.strip().title() for c in colors.split(',') if c.strip()]
    elif isinstance(colors, list):
        colors = [str(c).strip().title() for c in colors if c]
    if not colors:
        # Check tags for legacy color hints
        for tag in data.get('tags', []):
            if str(tag).title() in ['Black', 'White', 'Blue', 'Navy', 'Red', 'Grey', 'Green', 'Beige', 'Brown', 'Yellow', 'Pink', 'Purple', 'Orange']:
                colors = [str(tag).title()]
                break
        if not colors:
            colors = ['Multi-color']

    # Styles
    styles = data.get('styles') or data.get('style') or []
    if isinstance(styles, str):
        styles = [s.strip().title() for s in styles.split(',') if s.strip()]
    elif isinstance(styles, list):
        styles = [str(s).strip().title() for s in styles if s]
    if not styles:
        styles = ['Casual']

    # Seasons
    seasons = data.get('seasons') or data.get('season') or []
    if isinstance(seasons, str):
        seasons = [s.strip().title() for s in seasons.split(',') if s.strip()]
    elif isinstance(seasons, list):
        seasons = [str(s).strip().title() for s in seasons if s]
    if not seasons:
        seasons = ['All Season']

    # Occasion
    occasion = data.get('occasion') or []
    if isinstance(occasion, str):
        occasion = [o.strip().title() for o in occasion.split(',') if o.strip()]
    elif isinstance(occasion, list):
        occasion = [str(o).strip().title() for o in occasion if o]
    if not occasion:
        occasion = ['Everyday']

    # Image URL
    local_url = url_for('static', filename=f'uploads/{filename}', _external=False) if filename else None
    image_url = data.get('imageUrl') or data.get('url') or local_url

    confidence = data.get('confidence', 0.90)
    try:
        confidence = float(confidence)
        if confidence > 1.0:
            confidence = confidence / 100.0
    except (ValueError, TypeError):
        confidence = 0.90

    return {
        "id": item_id,
        "filename": filename,
        "userId": data.get('userId'),
        "name": data.get('name') or 'Unnamed Item',
        "category": category,
        "subcategory": subcategory,
        "colors": colors,
        "pattern": str(data.get('pattern') or 'Solid').capitalize(),
        "material": str(data.get('material') or 'Unknown').capitalize(),
        "fit": str(data.get('fit') or 'Regular').capitalize(),
        "styles": styles,
        "seasons": seasons,
        "formality": str(data.get('formality') or 'Casual').title(),
        "occasion": occasion,
        "confidence": round(confidence, 2),
        "url": local_url or image_url,
        "imageUrl": image_url or local_url,
        "in_laundry": bool(data.get('in_laundry', False)),
        "uploaded_at": data.get('uploaded_at') or data.get('created_at') or datetime.datetime.now().isoformat(),
        "description": data.get('description', f"{', '.join(colors)} {subcategory} ({category})"),
        "tags": data.get('tags') or [category, subcategory] + colors + styles
    }


def get_wardrobe_data(user_id=None):
    """
    Reads wardrobe items by combining local metadata files and Firestore.
    Guarantees rich, standardized schema across all items.
    """
    items_by_id = {}

    # 1. Read local JSON files
    try:
        for metadata_filename in os.listdir(METADATA_FOLDER):
            if metadata_filename.endswith('.json') and not metadata_filename.startswith('._'):
                try:
                    filepath = os.path.join(METADATA_FOLDER, metadata_filename)
                    with open(filepath, 'r') as f:
                        data = json.load(f)
                        fallback_id = metadata_filename[:-5]
                        norm = normalize_wardrobe_item(data, fallback_id)
                        items_by_id[norm['id']] = norm
                except Exception as e:
                    print(f"Error reading local metadata file {metadata_filename}: {e}")
    except Exception as e:
        print(f"Error reading metadata directory: {e}")

    # 2. Read from Firestore if available
    try:
        firestore_items = firebase_service.get_wardrobe_items_from_firestore(user_id)
        for fs_item in firestore_items:
            norm = normalize_wardrobe_item(fs_item)
            # Merge with local if image URL is local
            if norm['id'] in items_by_id and not fs_item.get('imageUrl'):
                norm['url'] = items_by_id[norm['id']]['url']
                norm['imageUrl'] = items_by_id[norm['id']]['imageUrl']
            items_by_id[norm['id']] = norm
    except Exception as e:
        print(f"Notice: Firestore wardrobe read note: {e}")

    return list(items_by_id.values())


# --- Page Routes ---

@app.route('/')
def index():
    user_info = session.get('user')
    if user_info:
        greeting = get_time_based_greeting()
        return render_template('index.html', user=user_info, greeting=greeting)
    return redirect(url_for('login'))


@app.route('/login')
def login():
    if session.get('user'):
        return redirect(url_for('index'))
    return render_template('login.html')


@app.route('/wardrobe')
def wardrobe():
    user_info = session.get('user')
    if not user_info:
        flash("You must be logged in to view your wardrobe.", "error")
        return redirect(url_for('login'))
    return render_template('wardrobe.html', user=user_info)


@app.route('/recommendations')
def recommendations():
    user_info = session.get('user')
    if not user_info:
        flash("You must be logged in to get recommendations.", "error")
        return redirect(url_for('login'))
    return render_template('recommendations.html', user=user_info)


@app.route('/logout')
def logout():
    session.pop('user', None)
    flash("You have been logged out.", "success")
    return redirect(url_for('login'))


@app.route('/api/auth/guest_login', methods=['GET', 'POST'])
def guest_login():
    session.permanent = True
    session['user'] = {
        'uid': 'student_demo',
        'email': 'student@outfitai.com',
        'name': 'Student'
    }
    return redirect(url_for('wardrobe'))


# --- API Endpoints ---

@app.route('/api/register', methods=['POST'])
def api_register():
    data = request.json or {}
    try:
        user = firebase_service.create_user(
            data.get('email'),
            data.get('password'),
            data.get('displayName')
        )
        if user:
            return jsonify({'uid': user.uid, 'email': user.email}), 201
        else:
             return jsonify({'error': 'Could not create user. Email might already be in use or service unavailable.'}), 500
    except Exception as e:
        print(f"Error during Firebase user creation: {e}")
        error_message = str(e)
        if "EMAIL_EXISTS" in error_message:
             return jsonify({'error': 'The email address is already in use by another account.'}), 400
        elif "WEAK_PASSWORD" in error_message:
             return jsonify({'error': 'Password should be at least 6 characters.'}), 400
        else:
            return jsonify({'error': f'Registration failed: {error_message}'}), 500


@app.route('/api/auth/session_login', methods=['POST'])
def session_login():
    data = request.json or {}
    id_token = data.get('idToken')
    remember_me = data.get('rememberMe', True)
    try:
        decoded_token = firebase_service.verify_id_token(id_token)
        if decoded_token:
            if remember_me:
                session.permanent = True
            session['user'] = {
                'uid': decoded_token.get('uid'),
                'email': decoded_token.get('email'),
                'name': decoded_token.get('name', 'User')
            }
            return jsonify({'status': 'success', 'uid': decoded_token.get('uid')}), 200
        else:
            return jsonify({'error': 'Invalid token. Please log in again.'}), 401
    except Exception as e:
        print(f"Error verifying token: {e}")
        return jsonify({'error': f'Token verification failed: {str(e)}'}), 401


@app.route('/api/weather', methods=['POST'])
def api_get_weather():
    if not session.get('user'): return jsonify({'error': 'Unauthorized'}), 401
    data = request.json
    weather_data = weather_service.get_weather_by_coords(data.get('lat'), data.get('lon'))
    if weather_data: return jsonify(weather_data), 200
    return jsonify({'error': 'Could not retrieve weather data'}), 500


# --- Wardrobe Management ---

@app.route('/api/wardrobe/analyze', methods=['POST'])
def api_analyze_clothing_item():
    """
    Accepts an uploaded clothing image and performs Gemini multimodal
    fashion recognition, returning structured classification and naming.
    """
    if not session.get('user'):
        return jsonify({'error': 'Unauthorized'}), 401

    image_file = None
    file_obj = request.files.get('file') or request.files.get('image')
    if file_obj and file_obj.filename != '':
        if not is_allowed_file(file_obj.filename):
            return jsonify({'error': 'Unsupported file type. Please upload a JPG, PNG, or WebP image.'}), 400
        image_file = file_obj
    elif request.is_json and request.json.get('imageBase64'):
        image_file = request.json.get('imageBase64')
    else:
        return jsonify({'error': 'No image provided for analysis.'}), 400

    try:
        analysis_result = gemini_service.analyze_clothing_item(image_file)
        return jsonify(analysis_result), 200
    except Exception as e:
        print(f"Error during clothing analysis endpoint: {e}")
        return jsonify(gemini_service._fallback_clothing_metadata(f"Analysis error: {str(e)}")), 200


@app.route('/api/wardrobe/upload', methods=['POST'])
def api_upload_wardrobe_item():
    """
    Handles saving a clothing item to the wardrobe with rich AI-generated or user-edited metadata.
    Saves image locally and to Firebase Storage, and persists metadata to Firestore and local JSON.
    """
    if not session.get('user'):
        return jsonify({'error': 'Unauthorized'}), 401

    file = request.files.get('file') or request.files.get('image')
    if not file or file.filename == '' or not is_allowed_file(file.filename):
        return jsonify({'error': 'Invalid or missing image file'}), 400

    # Parse metadata from form fields
    item_name = request.form.get('item_name') or request.form.get('name')
    item_category = request.form.get('item_category') or request.form.get('category', 'Tops')
    item_subcategory = request.form.get('item_subcategory') or request.form.get('subcategory')
    in_laundry_status = request.form.get('in_laundry') in ['true', 'True', True, '1']

    if not item_name:
        item_name = f"My {item_subcategory or item_category}"

    # Parse JSON list fields or fallbacks
    def parse_list_field(field_name, default):
        val = request.form.get(field_name)
        if not val:
            return default
        try:
            parsed = json.loads(val)
            if isinstance(parsed, list):
                return parsed
        except Exception:
            pass
        return [s.strip().title() for s in val.split(',') if s.strip()]

    colors = parse_list_field('colors', ['Black'])
    styles = parse_list_field('styles', ['Casual'])
    seasons = parse_list_field('seasons', ['All Season'])
    occasion = parse_list_field('occasion', ['Everyday'])

    pattern = request.form.get('pattern', 'Solid')
    material = request.form.get('material', 'Unknown')
    fit = request.form.get('fit', 'Regular')
    formality = request.form.get('formality', 'Casual')

    try:
        confidence = float(request.form.get('confidence', 0.92))
        if confidence > 1.0:
            confidence = confidence / 100.0
    except (ValueError, TypeError):
        confidence = 0.92

    # Save image locally
    filename = secure_filename(file.filename)
    unique_filename = f"{datetime.datetime.now().strftime('%Y%m%d%H%M%S%f')}-{filename}"
    filepath = os.path.join(UPLOAD_FOLDER, unique_filename)

    try:
        file.save(filepath)

        # Upload to Firebase Storage if available
        storage_destination = f"wardrobe/{session['user'].get('uid', 'default')}/{unique_filename}"
        mime_type, _ = mimetypes.guess_type(filepath)
        firebase_storage_url = firebase_service.upload_image_to_storage(
            filepath, storage_destination, content_type=mime_type or 'image/jpeg'
        )

        local_url = url_for('static', filename=f'uploads/{unique_filename}', _external=False)
        effective_image_url = firebase_storage_url or local_url

        metadata = {
            'id': unique_filename,
            'filename': unique_filename,
            'userId': session['user'].get('uid'),
            'name': item_name,
            'category': item_category,
            'subcategory': item_subcategory or 'Item',
            'colors': colors,
            'pattern': pattern,
            'material': material,
            'fit': fit,
            'styles': styles,
            'seasons': seasons,
            'formality': formality,
            'occasion': occasion,
            'confidence': round(confidence, 2),
            'url': local_url,
            'imageUrl': effective_image_url,
            'in_laundry': in_laundry_status,
            'uploaded_at': datetime.datetime.now().isoformat(),
            'created_at': datetime.datetime.now().isoformat(),
            'tags': [item_category, item_subcategory or ''] + colors + styles,
            'description': f"{', '.join(colors)} {item_subcategory or item_category} ({item_category})"
        }

        # 1. Save to Firestore
        firebase_service.save_wardrobe_item_to_firestore(metadata, user_id=session['user'].get('uid'))

        # 2. Save to local metadata file
        metadata_filepath = get_metadata_path(unique_filename)
        with open(metadata_filepath, 'w') as f:
            json.dump(metadata, f, indent=2)

        return jsonify(metadata), 201

    except Exception as e:
        print(f"Error during upload & saving: {e}")
        if os.path.exists(filepath):
            try:
                os.remove(filepath)
            except OSError:
                pass
        return jsonify({'error': f'An error occurred during upload: {str(e)}'}), 500


@app.route('/api/wardrobe/update', methods=['POST'])
def api_update_wardrobe_item():
    """
    Updates editable fields for a wardrobe item in both Firestore and local JSON.
    """
    if not session.get('user'):
        return jsonify({'error': 'Unauthorized'}), 401

    data = request.json or {}
    item_id = data.get('id') or data.get('filename')
    if not item_id:
        return jsonify({'error': 'Missing item ID'}), 400

    filename = secure_filename(data.get('filename') or item_id)
    metadata_filepath = get_metadata_path(filename)

    existing = {}
    if os.path.exists(metadata_filepath):
        try:
            with open(metadata_filepath, 'r') as f:
                existing = json.load(f)
        except Exception:
            pass

    # Update allowed fields
    allowed_keys = ['name', 'category', 'subcategory', 'colors', 'pattern', 'material', 'fit', 'styles', 'seasons', 'formality', 'occasion', 'in_laundry']
    for k in allowed_keys:
        if k in data:
            existing[k] = data[k]

    existing['updated_at'] = datetime.datetime.now().isoformat()

    # Save to local
    try:
        with open(metadata_filepath, 'w') as f:
            json.dump(existing, f, indent=2)
    except Exception as e:
        print(f"Error writing local update for {filename}: {e}")

    # Save to Firestore
    try:
        firebase_service.update_wardrobe_item_in_firestore(existing.get('id', filename), existing)
    except Exception as e:
        print(f"Error updating Firestore for {filename}: {e}")

    return jsonify({'status': 'success', 'item': normalize_wardrobe_item(existing)}), 200


@app.route('/api/wardrobe/toggle_status', methods=['POST'])
def api_toggle_item_status():
    """ Toggles the 'in_laundry' status of an item in local metadata and Firestore. """
    if not session.get('user'):
        return jsonify({'error': 'Unauthorized'}), 401

    data = request.json or {}
    item_id = data.get('id') or data.get('filename', '')
    filename = secure_filename(data.get('filename') or item_id)
    new_status = data.get('in_laundry')

    if not filename or new_status is None:
        return jsonify({'error': 'Missing filename or new status'}), 400

    metadata_filepath = get_metadata_path(filename)
    metadata = {}

    if os.path.exists(metadata_filepath):
        try:
            with open(metadata_filepath, 'r') as f:
                metadata = json.load(f)
            metadata['in_laundry'] = bool(new_status)
            with open(metadata_filepath, 'w') as f:
                json.dump(metadata, f, indent=2)
        except Exception as e:
            print(f"Error updating local status: {e}")

    # Update in Firestore as well
    firebase_service.update_wardrobe_item_in_firestore(metadata.get('id', filename), {'in_laundry': bool(new_status)})

    return jsonify({'status': 'success', 'in_laundry': bool(new_status), 'filename': filename}), 200


@app.route('/api/wardrobe', methods=['GET'])
def api_get_wardrobe_items():
    """ Returns all wardrobe items with full structured attributes. """
    if not session.get('user'):
        return jsonify({'error': 'Unauthorized'}), 401

    user_id = session.get('user', {}).get('uid')
    items = get_wardrobe_data(user_id=user_id)
    items.sort(key=lambda x: x.get('uploaded_at', ''), reverse=True)
    return jsonify(items), 200


@app.route('/api/wardrobe/delete', methods=['POST'])
def api_delete_wardrobe_item():
    """ Deletes item image and metadata from local storage and Firestore. """
    if not session.get('user'):
        return jsonify({'error': 'Unauthorized'}), 401

    data = request.json or {}
    item_id = data.get('id') or data.get('filename', '')
    filename = secure_filename(data.get('filename') or item_id)

    if not filename:
        return jsonify({'error': 'No filename provided'}), 400

    try:
        image_filepath = os.path.join(UPLOAD_FOLDER, filename)
        metadata_filepath = get_metadata_path(filename)

        deleted_image = False
        deleted_meta = False
        if os.path.exists(image_filepath):
            os.remove(image_filepath)
            deleted_image = True
        if os.path.exists(metadata_filepath):
            os.remove(metadata_filepath)
            deleted_meta = True

        # Delete from Firestore
        firebase_service.delete_wardrobe_item_from_firestore(item_id)

        if not deleted_image and not deleted_meta:
            return jsonify({'status': 'not_found', 'filename': filename}), 404

        return jsonify({'status': 'success', 'filename': filename}), 200
    except Exception as e:
        print(f"Error deleting item {filename}: {e}")
        return jsonify({'error': f'An error occurred during deletion: {str(e)}'}), 500


# --- AI & Recommendation Endpoints ---

@app.route('/api/chat/history', methods=['GET'])
def api_get_chat_history():
    """ Returns persisted chat history for the authenticated user. """
    if not session.get('user'):
        return jsonify({'error': 'Unauthorized'}), 401

    user_id = session['user'].get('uid', 'guest')
    history = firebase_service.get_chat_history(user_id, limit_count=40)
    return jsonify({'messages': history}), 200


@app.route('/api/chat/clear', methods=['POST'])
def api_clear_chat_history():
    """ Clears persisted chat messages for the current user. """
    if not session.get('user'):
        return jsonify({'error': 'Unauthorized'}), 401

    user_id = session['user'].get('uid', 'guest')
    firebase_service.clear_chat_history(user_id)
    return jsonify({'status': 'success', 'message': 'Chat history cleared'}), 200


@app.route('/api/chatbot', methods=['POST'])
def api_chatbot():
    """
    Handles chatbot messages with persistent history, wardrobe context, and optional voice audio.
    """
    if not session.get('user'):
        return jsonify({'error': 'Unauthorized'}), 401

    user_info = session['user']
    user_id = user_info.get('uid', 'guest')

    data = request.json or {}
    user_prompt = data.get('prompt', '').strip()
    image_base64 = data.get('imageBase64')
    want_voice = data.get('voice', False)
    voice_name = data.get('voiceName') or 'Kore'
    current_weather = data.get('currentWeather', {})
    active_outfit = data.get('activeOutfit') or session.get('active_outfit')

    if not user_prompt and not image_base64:
        return jsonify({'error': 'Please provide a message or image'}), 400

    # 1. Save user's message to persistent history
    user_msg = firebase_service.save_chat_message(
        user_id=user_id,
        role='user',
        text=user_prompt or '[Uploaded an image]'
    )

    # 2. Retrieve recent persistent history for context
    history = firebase_service.get_chat_history(user_id, limit_count=10)

    # 3. Retrieve user's full wardrobe items with rich attributes
    all_wardrobe_items = get_wardrobe_data()

    # 4. Generate AI response grounded in wardrobe context, active outfit, and history
    try:
        bot_response = gemini_service.chat_with_gemini(
            user_prompt=user_prompt,
            history_messages=history,
            wardrobe_items=all_wardrobe_items,
            weather_info=current_weather,
            image_base64=image_base64,
            active_outfit=active_outfit
        )

        # 5. Save bot reply to persistent history
        bot_msg = firebase_service.save_chat_message(
            user_id=user_id,
            role='model',
            text=bot_response,
            has_audio=bool(want_voice)
        )

        # 6. Generate voice audio if requested
        audio_payload = None
        if want_voice:
            audio_payload = gemini_service.generate_tts_audio(bot_response, voice_name=voice_name)

        return jsonify({
            'response': bot_response,
            'user_message': user_msg,
            'bot_message': bot_msg,
            'audio': audio_payload
        }), 200

    except Exception as e:
        print(f"Error calling gemini_service.chat_with_gemini: {e}")
        return jsonify({'error': 'AI stylist service failed to respond. Please try again.'}), 503


@app.route('/api/chatbot/tts', methods=['POST'])
def api_chatbot_tts():
    """ Generates base64 encoded WAV audio data from text using Gemini Voice TTS. """
    if not session.get('user'):
        return jsonify({'error': 'Unauthorized'}), 401

    data = request.json or {}
    text_to_speak = data.get('text', '').strip()
    voice_name = data.get('voice', 'Kore')

    if not text_to_speak:
        return jsonify({'error': 'No text provided for TTS'}), 400

    try:
        audio_response = gemini_service.generate_tts_audio(text_to_speak, voice_name=voice_name)
        if 'error' in audio_response:
            return jsonify(audio_response), 500
        return jsonify(audio_response), 200
    except Exception as e:
        print(f"Error calling gemini_service.generate_tts_audio: {e}")
        return jsonify({'error': 'Gemini Voice TTS service failed.'}), 503


@app.route('/api/recommendations', methods=['POST'])
def api_get_recommendation():
    """
    Generates outfit recommendation, excluding laundry items and considering hourly weather trajectory.
    """
    if not session.get('user'): return jsonify({'error': 'Unauthorized'}), 401

    user_name = session['user'].get('name', 'Student')
    data = request.json
    lat = data.get('lat'); lon = data.get('lon'); exclude_item_ids = data.get('exclude_item_ids', [])

    if not lat or not lon: return jsonify({'error': 'Missing location data'}), 400

    weather_info = weather_service.get_weather_by_coords(lat, lon)
    if not weather_info: return jsonify({'error': 'Could not get weather data'}), 500

    # 1. Get ALL items and filter down to only AVAILABLE and non-excluded items
    all_wardrobe_items = get_wardrobe_data()
    available_items = [
        item for item in all_wardrobe_items
        if not item.get('in_laundry', False) and item.get('id') not in exclude_item_ids
    ]

    laundry_count = sum(1 for item in all_wardrobe_items if item.get('in_laundry', False))

    if not available_items:
        return jsonify({
            'error': f"Hi {user_name}! No items are currently available in your wardrobe.",
            'laundry_count': laundry_count,
            'total_items': len(all_wardrobe_items),
            'excluded_count': len(exclude_item_ids)
        }), 200

    # 2. Call Gemini Service with ONLY the available items
    try:
        recommendation_data = gemini_service.get_outfit_recommendation(weather_info, available_items, user_name)
    except Exception as e:
        print(f"Error calling gemini_service.get_outfit_recommendation: {e}")
        return jsonify({'error': 'AI recommendation service failed.'}), 503

    if 'error' in recommendation_data or 'missing_item_suggestion' in recommendation_data:
        recommendation_data['laundry_count'] = laundry_count
        recommendation_data['total_items'] = len(all_wardrobe_items)
        return jsonify(recommendation_data), 200

    # 3. Hydrate the successful outfit response
    wardrobe_map = {item['name']: item for item in all_wardrobe_items}
    wardrobe_map.update({item['id']: item for item in all_wardrobe_items})

    hydrated_outfit = []
    for item_from_ai in recommendation_data.get('outfit', []):
        item_key = item_from_ai.get('id') or item_from_ai.get('name')
        full_item_details = wardrobe_map.get(item_key)

        if full_item_details:
            item_to_add = full_item_details.copy()
            item_to_add['type'] = item_from_ai.get('type', 'Item')
            item_to_add['url'] = full_item_details.get('url') or f"https://placehold.co/160x180/e9ecef/6c757d?text={item_to_add.get('name', 'Missing URL')}"
            hydrated_outfit.append(item_to_add)
        else:
            print(f"Warning: AI suggested item '{item_key}' not found in wardrobe map.")
            hydrated_outfit.append({
                "id": item_from_ai.get('id', item_from_ai.get('name')),
                "name": item_from_ai.get('name', 'Unknown Item'),
                "category": item_from_ai.get('type', 'N/A'),
                "url": f"https://placehold.co/160x180/e9ecef/dc3545?text=Item+Not+Found"
            })

    final_response = {
        "greeting": recommendation_data.get('greeting', "Here's your weather-adapted look:"),
        "weather_insight": recommendation_data.get('weather_insight', ''),
        "why_it_works": recommendation_data.get('why_it_works', "No explanation provided."),
        "notes": recommendation_data.get('notes', ""),
        "outfit_details": hydrated_outfit,
        "weather_snapshot": {
            "city": weather_info.get('city'),
            "temp": weather_info.get('temp'),
            "description": weather_info.get('description'),
            "feels_like": weather_info.get('feels_like')
        }
    }

    # Store in session for chatbot context
    session['active_outfit'] = final_response

    return jsonify(final_response), 200


# --- Saved Outfits Endpoints ---

@app.route('/api/outfits/save', methods=['POST'])
def api_save_outfit():
    """ Saves a generated outfit to Firestore and local JSON. """
    if not session.get('user'):
        return jsonify({'error': 'Unauthorized'}), 401

    user_id = session['user'].get('uid', 'guest')
    data = request.json or {}
    if not data or not data.get('outfit_details'):
        return jsonify({'error': 'No outfit data provided to save.'}), 400

    saved = firebase_service.save_outfit(user_id, data)
    return jsonify({'status': 'success', 'saved_outfit': saved}), 200


@app.route('/api/outfits/saved', methods=['GET'])
def api_get_saved_outfits():
    """ Returns all saved outfits for the authenticated user. """
    if not session.get('user'):
        return jsonify({'error': 'Unauthorized'}), 401

    user_id = session['user'].get('uid', 'guest')
    saved_list = firebase_service.get_saved_outfits(user_id)
    return jsonify({'saved_outfits': saved_list}), 200


@app.route('/api/outfits/delete', methods=['POST'])
def api_delete_saved_outfit():
    """ Deletes a saved outfit by ID. """
    if not session.get('user'):
        return jsonify({'error': 'Unauthorized'}), 401

    user_id = session['user'].get('uid', 'guest')
    data = request.json or {}
    outfit_id = data.get('id')
    if not outfit_id:
        return jsonify({'error': 'Missing outfit id'}), 400

    firebase_service.delete_saved_outfit(user_id, outfit_id)
    return jsonify({'status': 'success', 'id': outfit_id}), 200



# --- Main Execution ---
if __name__ == '__main__':
    try:
        app_chat_session = gemini_service.initialize_gemini_chat()
        print("Chat session initialized successfully.")
    except Exception as e:
        print(f"CRITICAL Error initializing chat session: {e}")
        app_chat_session = None

    port = 5000
    try:
        import socket
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            if s.connect_ex(('127.0.0.1', 5000)) == 0:
                port = 5001
    except Exception:
        port = 5001

    port = int(os.environ.get('PORT', port))
    print(f"OutfitAI server starting on http://127.0.0.1:{port}")
    app.run(debug=True, port=port)


