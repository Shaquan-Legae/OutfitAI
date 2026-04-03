import os
import random
import sys
import numpy as np
from PIL import Image, ImageOps

# --- TensorFlow Imports ---
# TensorFlow wheels are currently published for Python 3.9-3.12.
PYTHON_VERSION = f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}"
TF_RUNTIME_SUPPORTED = (3, 9) <= sys.version_info[:2] < (3, 13)
TF_IMPORT_ERROR = None

if TF_RUNTIME_SUPPORTED:
    try:
        import tensorflow as tf
        # Import the built-in MobileNetV2 model and its helper functions
        from tensorflow.keras.applications import MobileNetV2
        from tensorflow.keras.applications.mobilenet_v2 import preprocess_input, decode_predictions
    except ImportError as exc:
        print("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!")
        print("WARNING: TensorFlow is not installed in the active interpreter.")
        print("Install it in a Python 3.9-3.12 environment with `pip install tensorflow-cpu`.")
        print("This can also happen if VS Code is using the wrong virtual environment.")
        print("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!")
        tf = None
        TF_IMPORT_ERROR = exc
else:
    print("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!")
    print(
        f"WARNING: TensorFlow classification is disabled on Python {PYTHON_VERSION}. "
        "TensorFlow currently supports Python 3.9-3.12."
    )
    print("Use Python 3.12 (recommended) or 3.11 for real image classification.")
    print("The app will continue with mock classification data.")
    print("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!")
    tf = None
    TF_IMPORT_ERROR = RuntimeError(
        f"TensorFlow is unsupported on Python {PYTHON_VERSION}. Use Python 3.9-3.12."
    )

# --- Global variables to hold the loaded model ---
model = None

# --- Mock Data (for color and style) ---
# We still mock these, as the model only predicts the item type.
MOCK_COLORS = ['Black', 'White', 'Blue', 'Red', 'Grey', 'Green', 'Beige']
MOCK_STYLES = ['Casual', 'Formal', 'Sporty', 'Smart-Casual']

# --- A list of common clothing items found in the ImageNet dataset ---
# This helps us filter out non-clothing predictions (like 'dog' or 'car')
IMAGENET_CLOTHING_LABELS = [
    'jean', 'maillot', 'miniskirt', 'cardigan', 'jersey', 'T-shirt', 'sweatshirt', 
    'suit', 'gown', 'jacket', 'sneaker', 'sandal', 'boot', 'loafer', 'clog', 
    'running_shoe', 'sarong', 'kimono', 'bikini', 'bathing_suit', 'vest', 
    'cowboy_boot', 'balance_beam', 'poncho', 'trench_coat', 'hoodie',
    'sweat_pants', 'running_shorts', 'pajama', 'blouse', 'denim', 'umbrella'
]

# --- Mock Categories (as a fallback ONLY if TF fails) ---
MOCK_CATEGORIES = ['T-Shirt', 'Long-Sleeve Shirt', 'Hoodie', 'Sweater', 'Jeans', 'Chinos', 'Shorts']


def load_classification_model():
    """
    Loads the built-in MobileNetV2 model into memory.
    """
    global model
    
    if model: # Already loaded
        return
        
    if not tf:
        print(f"TensorFlow not available. Cannot load model. {TF_IMPORT_ERROR}")
        return

    try:
        # Load MobileNetV2, pre-trained on ImageNet data
        # This will download the model weights (~14MB) the first time it's run
        model = MobileNetV2(weights='imagenet')
        print("TensorFlow MobileNetV2 model loaded successfully.")
    except Exception as e:
        print("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!")
        print(f"CRITICAL: Failed to load built-in TensorFlow model: {e}")
        print("The service will fall back to using MOCK DATA.")
        print("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!")
        model = None # Ensure model is None on failure

def classify_image(image_path):
    """
    Classifies a single image using the loaded MobileNetV2 model.
    """
    global model
    
    # 1. Load model if not already in memory
    if model is None:
        load_classification_model()

    # 2. Check if loading failed (fallback to mock)
    if model is None:
        print(f"Warning: Using mock classification for {image_path}")
        return {
            "tags": [
                random.choice(MOCK_CATEGORIES),
                random.choice(MOCK_COLORS),
                random.choice(MOCK_STYLES)
            ],
            "description": "Unclassified Item (TensorFlow unavailable)"
        }

    try:
        # 3. Load and Pre-process the Image
        img = Image.open(image_path).convert("RGB")
        # MobileNetV2 was trained on 224x224 images
        img_resized = ImageOps.fit(img, (224, 224), Image.Resampling.LANCZOS)
        img_array = np.asarray(img_resized)
        img_batch = np.expand_dims(img_array, axis=0)
        
        # Run MobileNetV2's specific preprocessing
        img_preprocessed = preprocess_input(img_batch.astype(np.float32))

        # 4. Make Prediction
        predictions = model.predict(img_preprocessed)
        
        # 5. Decode Prediction
        # This gives us the top 5 predictions from ImageNet
        decoded = decode_predictions(predictions, top=5)[0]
        
        # 6. Find the *best* clothing-related prediction
        main_category = "Clothing Item" # Default
        best_confidence = 0
        
        print(f"Top predictions for {os.path.basename(image_path)}:")
        for _, label, confidence in decoded:
            print(f"  - {label} (Conf: {confidence:.2f})")
            # Check if this label is in our list of clothing items
            for clothing_label in IMAGENET_CLOTHING_LABELS:
                if clothing_label in label.lower():
                    if confidence > best_confidence:
                        main_category = label.replace('_', ' ').title()
                        best_confidence = confidence
                        break # Found a match
        
        if best_confidence == 0:
            # If no clothing item was found, just use the top prediction
            main_category = decoded[0][1].replace('_', ' ').title()

        # --- Assemble Tags ---
        # We got the main category! Now mock the color and style for Gemini.
        mock_color = random.choice(MOCK_COLORS)
        mock_style = random.choice(MOCK_STYLES)
        
        tags = [main_category, mock_color, mock_style]
        description = f"A {mock_color.lower()} {main_category.lower()} ({mock_style.lower()})"
        
        print(f"Real-classified item as: {main_category} (Best Conf: {best_confidence:.2f})")
        
        return {
            "tags": tags,
            "description": description
        }

    except Exception as e:
        print(f"Error during real classification: {e}")
        # Fallback to mock data on prediction error
        return {
            "tags": [
                random.choice(MOCK_CATEGORIES),
                random.choice(MOCK_STYLES),
                random.choice(MOCK_COLORS)
            ],
            "description": "Error during classification"
        }

# --- Initial Load ---
# Attempt to load the model as soon as the app starts
load_classification_model()

