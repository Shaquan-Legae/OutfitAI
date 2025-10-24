# /OutfitAI/services/firebase_service.py

import firebase_admin
from firebase_admin import credentials, auth, firestore, storage
import os

# --- Initialization Block ---
db = None
bucket = None

try:
    # Get the absolute path to the current directory (services/)
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    
    # Go up one level to the /OutfitAI directory to find the key
    SERVICE_ACCOUNT_PATH = os.path.join(os.path.dirname(BASE_DIR), 'serviceAccountKey.json')

    # Initialize Firebase Admin SDK
    cred = credentials.Certificate(SERVICE_ACCOUNT_PATH)
    
    firebase_admin.initialize_app(cred, {
        # Using the project ID you provided earlier
        'storageBucket': 'outfitai-a4f33.appspot.com' 
    })
    
    # Get client instances
    db = firestore.client()
    bucket = storage.bucket()
    
    print("Firebase Admin SDK initialized successfully from serviceAccountKey.json.")

except FileNotFoundError:
    print(f"Error: 'serviceAccountKey.json' not found at {SERVICE_ACCOUNT_PATH}")
    print("Please make sure the key file is in your main /OutfitAI directory.")
except ValueError as e:
    # This can happen if the app is already initialized (e.g., in a hot-reload scenario)
    if "The default Firebase app already exists" in str(e):
        print("Firebase app already initialized.")
        db = firestore.client()
        bucket = storage.bucket()
    else:
        print(f"Firebase initialization error: {e}")
except Exception as e:
    print(f"An unexpected error occurred during Firebase initialization: {e}")

# --- End Initialization Block ---


def create_user(email, password, display_name):
    """
    Creates a new user in Firebase Authentication and a profile in Firestore.
    """
    if not db:
        # This check is crucial. If db is None, initialization failed.
        print("Firestore client not initialized. Cannot create user profile.")
        return None
        
    try:
        user = auth.create_user(
            email=email,
            password=password,
            display_name=display_name
        )
        
        # Create a user profile document in Firestore
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
        # Use .set() to create or overwrite the document with the user's UID
        db.collection('users').document(user.uid).set(user_profile)
        
        print(f"Successfully created new user: {user.uid}")
        return user
    except auth.EmailAlreadyExistsError:
        print(f"Error: Email already exists: {email}")
        return None
    except Exception as e:
        print(f"Error creating user: {e}")
        return None

def get_user_by_email(email):
    """Retrieves user data by email."""
    try:
        user = auth.get_user_by_email(email)
        return user
    except auth.UserNotFoundError:
        return None
    except Exception as e:
        print(f"Error getting user by email: {e}")
        return None

def verify_id_token(id_token):
    """
    Verifies an ID Token sent from the client.
    Returns the decoded token if valid, otherwise None.
    """
    if not id_token:
        return None
    try:
        # This checks if the token is valid and not revoked
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