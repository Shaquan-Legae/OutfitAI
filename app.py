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
app.secret_key = os.urandom(24)

# --- Folder Setup for Local Storage ---
BASE_STATIC_FOLDER = os.path.join(app.root_path, 'static')
UPLOAD_FOLDER = os.path.join(BASE_STATIC_FOLDER, 'uploads')
METADATA_FOLDER = os.path.join(BASE_STATIC_FOLDER, 'metadata')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(METADATA_FOLDER, exist_ok=True)

# Define the system instruction globally (used in api_chatbot prompt)
CHATBOT_SYSTEM_INSTRUCTION = (
    "You are a helpful, friendly, and expert clothing and style AI assistant named OutfitAI. "
    "Your primary function is to help the user with wardrobe questions and offer styling advice. "
    "Always use impeccable grammar, correct punctuation, and format your responses clearly using Markdown (like **bold** and lists) for readability."
)

# --- Global Chat Session ---
app_chat_session = gemini_service.initialize_gemini_chat()

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


def get_wardrobe_data():
    """Reads all wardrobe items from .json metadata files, including 'in_laundry' status."""
    items = []
    try:
        for metadata_filename in os.listdir(METADATA_FOLDER):
            if metadata_filename.endswith('.json'):
                try:
                    with open(os.path.join(METADATA_FOLDER, metadata_filename), 'r') as f:
                        data = json.load(f)
                        # Ensure filename exists before generating URL
                        if data.get("filename"):
                            image_url = url_for('static', filename=f'uploads/{data.get("filename")}', _external=False)
                        else:
                            image_url = None # Handle missing filename case

                        items.append({
                            # Use filename (without extension) as ID if 'id' is missing
                            "id": data.get("id", metadata_filename[:-5]),
                            "filename": data.get("filename"),
                            "name": data.get('name', 'Unnamed Item'),
                            "description": data.get('description', 'Unclassified Item'),
                            "category": data.get('category', 'Other'),
                            "uploaded_at": data.get("uploaded_at"),
                            "url": image_url,
                            "in_laundry": data.get("in_laundry", False)
                        })
                except json.JSONDecodeError:
                    print(f"Warning: Skipping corrupted metadata file: {metadata_filename}")
                except Exception as e:
                    print(f"Error processing metadata file {metadata_filename}: {e}")
        return items
    except Exception as e:
        print(f"Error reading metadata directory: {e}")
        return []


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


# --- API Endpoints ---

@app.route('/api/register', methods=['POST'])
def api_register():
    data = request.json
    try:
        user = firebase_service.create_user(
            data.get('email'),
            data.get('password'),
            data.get('displayName')
        )
        if user:
            return jsonify({'uid': user.uid, 'email': user.email}), 201
        else:
            # If service returns None without exception (e.g., email exists)
             return jsonify({'error': 'Could not create user. Email might already be in use or service unavailable.'}), 500
    except Exception as e:
        # Catch exceptions from the firebase service itself
        print(f"Error during Firebase user creation: {e}")
        error_message = str(e)
        # Provide more specific feedback if possible
        if "EMAIL_EXISTS" in error_message:
             return jsonify({'error': 'The email address is already in use by another account.'}), 400
        elif "WEAK_PASSWORD" in error_message:
             return jsonify({'error': 'Password should be at least 6 characters.'}), 400
        else:
            return jsonify({'error': f'Registration failed: {error_message}'}), 500


@app.route('/api/auth/session_login', methods=['POST'])
def session_login():
    data = request.json
    id_token = data.get('idToken')
    try:
        decoded_token = firebase_service.verify_id_token(id_token)
        if decoded_token:
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

@app.route('/api/wardrobe/upload', methods=['POST'])
def api_upload_wardrobe_item():
    """
    Handles uploading a new clothing item. Saves 'in_laundry' status.
    """
    if not session.get('user'): return jsonify({'error': 'Unauthorized'}), 401

    if 'file' not in request.files: return jsonify({'error': 'No file part in the request'}), 400

    item_name = request.form.get('item_name')
    item_category = request.form.get('item_category')
    in_laundry_status = request.form.get('in_laundry') == 'true'

    if not item_name or not item_category: return jsonify({'error': 'Missing item name or category'}), 400

    file = request.files['file']
    if file.filename == '' or not is_allowed_file(file.filename): return jsonify({'error': 'Invalid file or file type'}), 400

    filename = secure_filename(file.filename)
    unique_filename = f"{datetime.datetime.now().strftime('%Y%m%d%H%M%S%f')}-{filename}"
    filepath = os.path.join(UPLOAD_FOLDER, unique_filename)

    try:
        file.save(filepath)
        classification_data = tensorflow_service.classify_image(filepath) # Assuming this works

        metadata_filepath = get_metadata_path(unique_filename)

        metadata = {
            'id': unique_filename,
            'filename': unique_filename,
            'url': url_for('static', filename=f'uploads/{unique_filename}', _external=False),
            'name': item_name,
            'category': item_category,
            'tags': classification_data.get('tags', ['Untagged']),
            'description': classification_data.get('description', 'Unclassified Item'),
            'uploaded_at': datetime.datetime.now().isoformat(),
            'in_laundry': in_laundry_status
        }

        with open(metadata_filepath, 'w') as f:
            json.dump(metadata, f, indent=2)

        return jsonify(metadata), 201

    except Exception as e:
        print(f"Error during upload/classification: {e}")
        if os.path.exists(filepath):
            try: os.remove(filepath)
            except OSError: pass
        return jsonify({'error': f'An error occurred during upload: {e}'}), 500


@app.route('/api/wardrobe/toggle_status', methods=['POST'])
def api_toggle_item_status():
    """ Toggles the 'in_laundry' status of an item. """
    if not session.get('user'): return jsonify({'error': 'Unauthorized'}), 401

    data = request.json
    filename = secure_filename(data.get('filename', ''))
    new_status = data.get('in_laundry') # Expecting True or False boolean

    if not filename or new_status is None:
        return jsonify({'error': 'Missing filename or new status'}), 400

    metadata_filepath = get_metadata_path(filename)

    if not os.path.exists(metadata_filepath):
        return jsonify({'error': 'Item metadata not found'}), 404

    try:
        with open(metadata_filepath, 'r') as f:
            metadata = json.load(f)

        metadata['in_laundry'] = new_status

        with open(metadata_filepath, 'w') as f:
            json.dump(metadata, f, indent=2)

        return jsonify({'status': 'success', 'in_laundry': new_status}), 200

    except Exception as e:
        print(f"Error toggling status for {filename}: {e}")
        return jsonify({'error': 'Failed to update item status'}), 500


@app.route('/api/wardrobe', methods=['GET'])
def api_get_wardrobe_items():
    """ Returns all wardrobe items, including their 'in_laundry' status. """
    if not session.get('user'): return jsonify({'error': 'Unauthorized'}), 401

    items = get_wardrobe_data()
    items.sort(key=lambda x: x.get('uploaded_at', ''), reverse=True)
    return jsonify(items), 200


@app.route('/api/wardrobe/delete', methods=['POST'])
def api_delete_wardrobe_item():
    """ Deletes item image and metadata. """
    if not session.get('user'): return jsonify({'error': 'Unauthorized'}), 401

    data = request.json
    filename = secure_filename(data.get('filename', ''))

    if not filename: return jsonify({'error': 'No filename provided'}), 400

    try:
        image_filepath = os.path.join(UPLOAD_FOLDER, filename)
        metadata_filepath = get_metadata_path(filename) # Use helper

        deleted_image = False
        deleted_meta = False
        if os.path.exists(image_filepath):
            os.remove(image_filepath)
            deleted_image = True
        if os.path.exists(metadata_filepath):
            os.remove(metadata_filepath)
            deleted_meta = True

        if not deleted_image and not deleted_meta: return jsonify({'status': 'not_found', 'filename': filename}), 404

        return jsonify({'status': 'success', 'filename': filename}), 200
    except Exception as e:
        print(f"Error deleting item {filename}: {e}")
        return jsonify({'error': f'An error occurred during deletion: {e}'}), 500


# --- AI & Recommendation Endpoints ---

@app.route('/api/chatbot', methods=['POST'])
def api_chatbot():
    """ Handles chatbot messages. Filters unavailable items for context. """
    if not session.get('user'): return jsonify({'error': 'Unauthorized'}), 401

    data = request.json
    user_prompt = data.get('prompt', '')
    image_base64 = data.get('imageBase64')

    all_items = get_wardrobe_data()
    filtered_context = [{
        'name': item['name'],
        'category': item['category'],
        'description': item['description'],
        'available': not item.get('in_laundry', False)
    } for item in all_items]

    current_weather = data.get('currentWeather', {})

    context_string = f"\n\n--- Wardrobe Context ---\nItems (Availability Status Included): {json.dumps(filtered_context)}\n--- Weather Context ---\nCurrent Location/Weather: {json.dumps(current_weather)}\n\n"

    full_prompt = f"{CHATBOT_SYSTEM_INSTRUCTION}\n\n{context_string}\n\nUser Query: {user_prompt}"

    if not user_prompt and not image_base64: return jsonify({'error': 'No prompt or image provided'}), 400

    try:
        bot_response = gemini_service.chat_with_gemini(
            app_chat_session,
            full_prompt,
            image_base64=image_base64
        )
        return jsonify({'response': bot_response}), 200
    except gemini_service.GeminiServiceError as e:
        print(f"Chatbot service error: {e}")
        return jsonify({'error': str(e)}), e.status_code
    except Exception as e:
        print(f"Error calling gemini_service.chat_with_gemini: {e}")
        return jsonify({'error': 'AI service failed to respond.'}), 503 # Service Unavailable


@app.route('/api/chatbot/tts', methods=['POST'])
def api_chatbot_tts():
    """ Generates base64 encoded audio data from text using Gemini TTS. """
    if not session.get('user'): return jsonify({'error': 'Unauthorized'}), 401

    data = request.json
    text_to_speak = data.get('text')

    if not text_to_speak: return jsonify({'error': 'No text provided for TTS'}), 400

    try:
        audio_response = gemini_service.generate_tts_audio(text_to_speak)
        return jsonify(audio_response), 200
    except gemini_service.GeminiServiceError as e:
        print(f"TTS service error: {e}")
        return jsonify({'error': str(e)}), e.status_code
    except Exception as e:
        print(f"Error calling gemini_service.generate_tts_audio: {e}")
        return jsonify({'error': 'TTS service failed.'}), 503


@app.route('/api/recommendations', methods=['POST'])
def api_get_recommendation():
    """
    Generates outfit recommendation, excluding laundry items and using fallback URL.
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

    if not available_items:
        return jsonify({'error': f"Hi {user_name}! No items are currently available in your wardrobe (some may be in laundry). Please check your items."}), 200

    # 2. Call Gemini Service with ONLY the available items
    try:
        recommendation_data = gemini_service.get_outfit_recommendation(weather_info, available_items, user_name)
    except gemini_service.GeminiServiceError as e:
        print(f"Recommendation service error: {e}")
        return jsonify({'error': str(e)}), e.status_code
    except Exception as e:
        print(f"Error calling gemini_service.get_outfit_recommendation: {e}")
        return jsonify({'error': 'AI recommendation service failed.'}), 503

    if 'missing_item_suggestion' in recommendation_data:
        return jsonify(recommendation_data), 200
    if 'error' in recommendation_data:
        return jsonify(recommendation_data), 502

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
            # Ensure 'url' is present, default to placeholder if somehow missing
            item_to_add['url'] = full_item_details.get('url') or f"https://placehold.co/160x180/e9ecef/6c757d?text={item_to_add.get('name', 'Missing URL')}"
            hydrated_outfit.append(item_to_add)
        else:
            # FIX: Fallback logic now includes a placeholder URL
            print(f"Warning: AI suggested item '{item_key}' not found in wardrobe map.")
            hydrated_outfit.append({
                "id": item_from_ai.get('id', item_from_ai.get('name')),
                "name": item_from_ai.get('name', 'Unknown Item'),
                "category": item_from_ai.get('type', 'N/A'),
                "url": f"https://placehold.co/160x180/e9ecef/dc3545?text=Item+Not+Found" # Correct Placeholder
            })

    final_response = {
        "greeting": recommendation_data.get('greeting', "Here's your outfit:"),
        "why_it_works": recommendation_data.get('why_it_works', "No explanation provided."),
        "notes": recommendation_data.get('notes', ""),
        "outfit_details": hydrated_outfit
    }
    return jsonify(final_response), 200


# --- Main Execution ---
if __name__ == '__main__':
    try:
        app_chat_session = gemini_service.initialize_gemini_chat()
        print("Chat session initialized successfully.")
    except Exception as e:
        print(f"CRITICAL Error initializing chat session: {e}")
        app_chat_session = None

    port = int(os.environ.get("PORT", 10000))
    app.run(host="0.0.0.0", port=port)


