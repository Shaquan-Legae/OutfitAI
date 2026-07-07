import os
import json
import firebase_admin
from firebase_admin import credentials, auth, firestore, storage

# Local development
LOCAL_SERVICE_ACCOUNT = os.path.join(
    os.path.dirname(os.path.dirname(__file__)),
    "serviceAccountKey.json"
)

# Render Secret File
RENDER_SERVICE_ACCOUNT = "/etc/secrets/serviceAccountKey.json"

# Render Secret File takes priority
if os.path.exists(RENDER_SERVICE_ACCOUNT):
    cred = credentials.Certificate(RENDER_SERVICE_ACCOUNT)
    print("Using Render Secret File.")

# Local file
elif os.path.exists(LOCAL_SERVICE_ACCOUNT):
    cred = credentials.Certificate(LOCAL_SERVICE_ACCOUNT)
    print("Using local serviceAccountKey.json.")

# Environment variable (optional fallback)
elif os.environ.get("FIREBASE_SERVICE_ACCOUNT_JSON"):
    service_account_info = json.loads(os.environ["FIREBASE_SERVICE_ACCOUNT_JSON"])
    service_account_info["private_key"] = service_account_info["private_key"].replace("\\n", "\n")
    cred = credentials.Certificate(service_account_info)
    print("Using environment variable.")

else:
    raise FileNotFoundError(
        "No Firebase credentials found."
    )

if not firebase_admin._apps:
    firebase_admin.initialize_app(cred, {
        "storageBucket": "outfitai-a4f33.appspot.com"
    })

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
