# /OutfitAI/services/firebase_service.py

import os
import json
import firebase_admin
from firebase_admin import credentials, auth, firestore, storage

# --- Initialization Block ---

# Absolute path to local serviceAccountKey.json
SERVICE_ACCOUNT_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'serviceAccountKey.json')

# Try to get Firebase key from environment (Render) first
firebase_key_env = os.environ.get("FIREBASE_KEY_JSON")

if firebase_key_env:
    # Use the JSON from environment variable
    try:
        service_account_info = json.loads(firebase_key_env)
        cred = credentials.Certificate(service_account_info)
        print("Firebase Admin SDK initialized using environment variable.")
    except json.JSONDecodeError:
        raise RuntimeError("FIREBASE_KEY_JSON is not valid JSON.")
elif os.path.exists(SERVICE_ACCOUNT_PATH):
    # Fallback to local JSON file
    cred = credentials.Certificate(SERVICE_ACCOUNT_PATH)
    print(f"Firebase Admin SDK initialized using local file at {SERVICE_ACCOUNT_PATH}.")
else:
    raise FileNotFoundError(
        f"serviceAccountKey.json not found at {SERVICE_ACCOUNT_PATH} and FIREBASE_KEY_JSON not set. "
        "Provide the file locally or set the environment variable in Render."
    )

# Initialize Firebase Admin SDK only once
if not firebase_admin._apps:
    firebase_admin.initialize_app(cred, {
        'storageBucket': 'outfitai-a4f33.appspot.com'
    })

# Firebase clients
db = firestore.client()
bucket = storage.bucket()

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