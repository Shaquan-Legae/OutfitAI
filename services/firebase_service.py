# /OutfitAI/services/firebase_service.py

import os
import datetime
import json
import firebase_admin
from firebase_admin import credentials, auth, firestore, storage

# --- Initialization Block ---

# Absolute path to /OutfitAI/serviceAccountKey.json
SERVICE_ACCOUNT_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'serviceAccountKey.json')

if not os.path.exists(SERVICE_ACCOUNT_PATH):
    raise FileNotFoundError(f"serviceAccountKey.json not found at {SERVICE_ACCOUNT_PATH}. "
                            "Download it from Firebase Console -> Project Settings -> Service accounts.")

# Initialize Firebase Admin SDK only once
STORAGE_BUCKET_NAME = os.getenv('FIREBASE_STORAGE_BUCKET', 'outfitai-a4f33.firebasestorage.app')

if not firebase_admin._apps:
    cred = credentials.Certificate(SERVICE_ACCOUNT_PATH)
    firebase_admin.initialize_app(cred, {
        'storageBucket': STORAGE_BUCKET_NAME
    })

# Firebase clients
db = firestore.client()
try:
    bucket = storage.bucket(STORAGE_BUCKET_NAME)
except Exception as bucket_err:
    print(f"Warning: Could not connect to storage bucket {STORAGE_BUCKET_NAME}: {bucket_err}")
    bucket = None

print("Firebase Admin SDK initialized successfully.")

# --- User Management Functions ---

def create_user(email: str, password: str, display_name: str):
    """
    Creates a new user in Firebase Authentication and a profile in Firestore.
    """
    try:
        user = auth.create_user(
            email=email,
            password=password,
            display_name=display_name
        )

        # Firestore profile
        user_profile = {
            'uid': user.uid,
            'email': user.email,
            'display_name': display_name,
            'created_at': firestore.SERVER_TIMESTAMP,
            'preferences': {
                'style': 'casual',
                'preferred_colors': []
            }
        }

        db.collection('users').document(user.uid).set(user_profile)
        print(f"Successfully created user: {user.uid}")
        return user

    except auth.EmailAlreadyExistsError:
        print(f"Error: Email already exists: {email}")
        return None
    except Exception as e:
        print(f"Error creating user: {e}")
        return None


def get_user_by_email(email: str):
    """
    Retrieves a user by email from Firebase Authentication.
    """
    try:
        user = auth.get_user_by_email(email)
        return user
    except auth.UserNotFoundError:
        return None
    except Exception as e:
        print(f"Error getting user by email: {e}")
        return None


def verify_id_token(id_token: str):
    """
    Verifies an ID Token sent from the client.
    Returns the decoded token if valid, otherwise None.
    """
    if not id_token:
        return None
    try:
        decoded_token = auth.verify_id_token(id_token)
        return decoded_token
    except auth.InvalidIdTokenError:
        print("Error: Invalid ID token.")
        return None
    except auth.ExpiredIdTokenError:
        print("Error: Expired ID token.")
        return None
    except Exception as e:
        print(f"Error verifying token: {e}")
        return None


# --- Wardrobe Firestore & Storage Management ---

def save_wardrobe_item_to_firestore(item_data: dict, user_id: str = None) -> bool:
    """
    Persists a wardrobe item document to Firestore.
    Uses 'wardrobe' collection with item_id as document ID.
    """
    item_id = item_data.get('id')
    if not item_id:
        return False
    try:
        doc_data = item_data.copy()
        if user_id:
            doc_data['userId'] = user_id
        if 'created_at' not in doc_data or not doc_data['created_at']:
            doc_data['created_at'] = firestore.SERVER_TIMESTAMP
        doc_data['updated_at'] = firestore.SERVER_TIMESTAMP

        db.collection('wardrobe').document(item_id).set(doc_data, merge=True)
        print(f"Saved wardrobe item {item_id} to Firestore.")
        return True
    except Exception as e:
        print(f"Warning: Failed to save wardrobe item {item_id} to Firestore: {e}")
        return False


def get_wardrobe_items_from_firestore(user_id: str = None) -> list:
    """
    Fetches wardrobe items from Firestore, optionally filtered by user_id.
    """
    try:
        col = db.collection('wardrobe')
        if user_id:
            query = col.where('userId', '==', user_id)
        else:
            query = col
        docs = query.stream()
        items = []
        for doc in docs:
            d = doc.to_dict()
            d['id'] = doc.id
            items.append(d)
        return items
    except Exception as e:
        print(f"Warning: Failed to read wardrobe items from Firestore: {e}")
        return []


def update_wardrobe_item_in_firestore(item_id: str, updates: dict) -> bool:
    """
    Updates specific fields for an item in Firestore.
    """
    if not item_id:
        return False
    try:
        data_to_update = updates.copy()
        data_to_update['updated_at'] = firestore.SERVER_TIMESTAMP
        db.collection('wardrobe').document(item_id).update(data_to_update)
        print(f"Updated wardrobe item {item_id} in Firestore.")
        return True
    except Exception as e:
        print(f"Warning: Failed to update wardrobe item {item_id} in Firestore: {e}")
        return False


def delete_wardrobe_item_from_firestore(item_id: str) -> bool:
    """
    Deletes an item document from Firestore.
    """
    if not item_id:
        return False
    try:
        db.collection('wardrobe').document(item_id).delete()
        print(f"Deleted wardrobe item {item_id} from Firestore.")
        return True
    except Exception as e:
        print(f"Warning: Failed to delete wardrobe item {item_id} from Firestore: {e}")
        return False


def upload_image_to_storage(file_path: str, destination_blob_name: str, content_type: str = None) -> str:
    """
    Uploads an image file to Firebase Storage if available.
    Returns the public or signed URL if successful, or None if Storage upload fails.
    """
    if not bucket:
        return None
    try:
        blob = bucket.blob(destination_blob_name)
        blob.upload_from_filename(file_path, content_type=content_type)
        try:
            blob.make_public()
            return blob.public_url
        except Exception:
            # If make_public is forbidden by bucket IAM, generate a long-lived signed URL or storage path
            return blob.generate_signed_url(expiration=3600 * 24 * 7) # 7 days
    except Exception as e:
        print(f"Notice: Firebase Storage upload for {destination_blob_name} skipped ({e}). Using local static storage.")
        return None


# --- Chat History Persistence ---

CHAT_HISTORY_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'static', 'chat_history')
os.makedirs(CHAT_HISTORY_DIR, exist_ok=True)


def _get_local_chat_file(user_id: str) -> str:
    safe_uid = "".join(c for c in (user_id or "guest") if c.isalnum() or c in ('_', '-'))
    return os.path.join(CHAT_HISTORY_DIR, f"{safe_uid}.json")


def save_chat_message(user_id: str, role: str, text: str, has_audio: bool = False) -> dict:
    """
    Persists a chat message to Firestore and local fallback file.
    role: 'user' | 'model'
    """
    from datetime import datetime, timezone
    now_iso = datetime.now(timezone.utc).isoformat()
    msg_id = f"{int(datetime.now().timestamp() * 1000)}"
    
    msg_data = {
        'id': msg_id,
        'userId': user_id or 'guest',
        'role': role,
        'text': text,
        'has_audio': has_audio,
        'created_at': now_iso
    }

    # 1. Firestore persistence
    if db:
        try:
            db.collection('chat_history').document(f"{user_id}_{msg_id}").set({
                **msg_data,
                'firestore_timestamp': firestore.SERVER_TIMESTAMP
            })
        except Exception as e:
            print(f"Notice: Firestore chat save error: {e}")

    # 2. Local JSON persistence (mirror for durability)
    try:
        local_file = _get_local_chat_file(user_id)
        existing = []
        if os.path.exists(local_file) and os.path.getsize(local_file) > 0:
            try:
                with open(local_file, 'r', encoding='utf-8') as f:
                    existing = json.load(f)
            except Exception:
                existing = []
        existing.append(msg_data)
        # Keep last 100 messages locally
        if len(existing) > 100:
            existing = existing[-100:]
        with open(local_file, 'w', encoding='utf-8') as f:
            json.dump(existing, f, indent=2)
    except Exception as e:
        print(f"Notice: Local chat history file write error: {e}")

    return msg_data


def get_chat_history(user_id: str, limit_count: int = 50) -> list:
    """
    Loads persisted chat messages for the specified user from Firestore or local fallback.
    """
    # 1. Try Firestore first (without requiring composite index)
    if db:
        try:
            query = db.collection('chat_history').where('userId', '==', user_id or 'guest')
            docs = query.stream()
            messages = [d.to_dict() for d in docs]
            if messages:
                messages.sort(key=lambda m: m.get('created_at', ''))
                return messages[-limit_count:]
        except Exception as e:
            print(f"Notice: Firestore get_chat_history error ({e}), falling back to local file.")

    # 2. Local fallback
    local_file = _get_local_chat_file(user_id)
    if os.path.exists(local_file) and os.path.getsize(local_file) > 0:
        try:
            with open(local_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
                return data[-limit_count:]
        except Exception as e:
            print(f"Error reading local chat history: {e}")

    return []


def clear_chat_history(user_id: str) -> bool:
    """
    Clears all chat history for the user from Firestore and local file.
    """
    # 1. Clear Firestore
    if db:
        try:
            query = db.collection('chat_history').where('userId', '==', user_id or 'guest')
            docs = query.stream()
            for doc in docs:
                doc.reference.delete()
        except Exception as e:
            print(f"Notice: Firestore clear_chat_history error: {e}")

    # 2. Clear local file
    local_file = _get_local_chat_file(user_id)
    if os.path.exists(local_file):
        try:
            os.remove(local_file)
        except Exception as e:
            print(f"Notice: Local chat file remove error: {e}")

    return True


# --- Saved Outfits Persistence ---

def _get_local_saved_outfits_file(user_id: str) -> str:
    """Returns local storage path for user saved looks."""
    safe_uid = "".join([c for c in (user_id or 'guest') if c.isalnum() or c in ('-', '_')])
    data_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data')
    os.makedirs(data_dir, exist_ok=True)
    return os.path.join(data_dir, f"saved_outfits_{safe_uid}.json")


def save_outfit(user_id: str, outfit_data: dict) -> dict:
    """
    Saves an outfit recommendation to Firestore and local JSON.
    """
    import uuid
    outfit_id = outfit_data.get('id') or f"outfit_{uuid.uuid4().hex[:10]}"
    now_iso = datetime.datetime.now().isoformat()

    record = {
        'id': outfit_id,
        'userId': user_id or 'guest',
        'greeting': outfit_data.get('greeting', 'Curated Look'),
        'why_it_works': outfit_data.get('why_it_works', ''),
        'notes': outfit_data.get('notes', ''),
        'outfit_details': outfit_data.get('outfit_details', []),
        'weather_snapshot': outfit_data.get('weather_snapshot', {}),
        'saved_at': now_iso
    }

    # 1. Firestore persistence
    if db:
        try:
            db.collection('saved_outfits').document(f"{user_id}_{outfit_id}").set({
                **record,
                'firestore_timestamp': firestore.SERVER_TIMESTAMP
            })
        except Exception as e:
            print(f"Notice: Firestore save_outfit error: {e}")

    # 2. Local JSON mirror
    try:
        local_file = _get_local_saved_outfits_file(user_id)
        existing = []
        if os.path.exists(local_file) and os.path.getsize(local_file) > 0:
            try:
                with open(local_file, 'r', encoding='utf-8') as f:
                    existing = json.load(f)
            except Exception:
                existing = []
        # Filter out duplicates if re-saving
        existing = [o for o in existing if o.get('id') != outfit_id]
        existing.insert(0, record)
        with open(local_file, 'w', encoding='utf-8') as f:
            json.dump(existing, f, indent=2)
    except Exception as e:
        print(f"Notice: Local saved outfits write error: {e}")

    return record


def get_saved_outfits(user_id: str) -> list:
    """
    Retrieves all saved looks for a user from Firestore or local fallback.
    """
    # 1. Try Firestore
    if db:
        try:
            query = db.collection('saved_outfits').where('userId', '==', user_id or 'guest')
            docs = query.stream()
            results = [d.to_dict() for d in docs]
            if results:
                results.sort(key=lambda x: x.get('saved_at', ''), reverse=True)
                return results
        except Exception as e:
            print(f"Notice: Firestore get_saved_outfits error ({e}), falling back to local file.")

    # 2. Local fallback
    local_file = _get_local_saved_outfits_file(user_id)
    if os.path.exists(local_file) and os.path.getsize(local_file) > 0:
        try:
            with open(local_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
                return data
        except Exception as e:
            print(f"Error reading local saved outfits: {e}")

    return []


def delete_saved_outfit(user_id: str, outfit_id: str) -> bool:
    """
    Deletes a saved outfit from Firestore and local storage.
    """
    if not outfit_id:
        return False

    # 1. Delete from Firestore
    if db:
        try:
            doc_ref = db.collection('saved_outfits').document(f"{user_id}_{outfit_id}")
            doc_ref.delete()
        except Exception as e:
            print(f"Notice: Firestore delete_saved_outfit error: {e}")

    # 2. Delete from local JSON
    try:
        local_file = _get_local_saved_outfits_file(user_id)
        if os.path.exists(local_file) and os.path.getsize(local_file) > 0:
            with open(local_file, 'r', encoding='utf-8') as f:
                existing = json.load(f)
            updated = [o for o in existing if o.get('id') != outfit_id]
            with open(local_file, 'w', encoding='utf-8') as f:
                json.dump(updated, f, indent=2)
    except Exception as e:
        print(f"Notice: Local saved outfits delete error: {e}")

    return True


