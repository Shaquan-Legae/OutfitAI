# OutfitAI 👕🤖

OutfitAI is an AI-powered web application that helps students decide what to wear based on the current weather and the clothes already in their wardrobe.

The application combines **Google Gemini AI**, **WeatherAPI**, **Firebase**, and a **Flask backend** to generate personalized outfit recommendations that are weather-appropriate, visually coordinated, and tailored to the user's wardrobe.

---

## Features

- 🔐 Secure user authentication with Firebase Authentication
- 👕 Digital wardrobe management
- 📷 Upload clothing images with metadata
- 🌤️ Real-time weather integration using WeatherAPI
- 🤖 AI-powered outfit recommendations using Google Gemini
- 🎨 Color-coordinated outfit suggestions
- 🌡️ Weather-aware clothing selection
- 💬 AI reasoning explaining each recommendation
- 👍 Like/Dislike feedback system
- 📱 Responsive design for desktop, tablet, and mobile
- 💾 Persistent outfit history

---

## Tech Stack

### Frontend
- HTML
- CSS
- JavaScript

### Backend
- Flask (Python)
- REST API

### AI
- Google Gemini API

### Database & Storage
- Firebase Authentication
- Cloud Firestore
- Firebase Storage

### External APIs
- WeatherAPI

---

## System Architecture

```
User
   │
   ▼
Frontend (HTML, CSS, JavaScript)
   │
   ├── Firebase Authentication
   ├── Firestore
   ├── Firebase Storage
   │
   ▼
Flask Backend
   │
   ├── WeatherAPI
   └── Google Gemini API
          │
          ▼
Outfit Recommendation
          │
          ▼
Frontend Display
```

---

## How It Works

1. User signs in using Firebase Authentication.
2. The application retrieves the user's wardrobe from Firestore.
3. Current weather is fetched from WeatherAPI.
4. Wardrobe data, weather, and user preferences are sent to the Flask backend.
5. Flask sends the compiled information to Google Gemini.
6. Gemini generates a complete outfit recommendation.
7. The frontend displays:
   - Outfit images
   - Clothing items
   - AI reasoning
8. User feedback is stored in Firebase for future recommendations.

---

## AI Features

The AI model is capable of:

- Analyzing wardrobe items
- Matching complementary colors
- Considering weather conditions
- Filtering clothing by warmth level
- Building complete outfits
- Explaining outfit choices
- Learning from user feedback
- Returning wardrobe image references
- Dynamically adapting prompts
- Producing structured JSON responses

---

## Project Structure

```
OutfitAI/
│
├── frontend/
│   ├── index.html
│   ├── css/
│   ├── js/
│   └── assets/
│
├── backend/
│   ├── app.py
│   ├── routes/
│   ├── services/
│   ├── prompts/
│   └── requirements.txt
│
├── firebase/
│
├── README.md
└── .env
```

---

## Example AI Input

```json
{
  "weather": {
    "condition": "Sunny",
    "temperature": 28,
    "humidity": 30
  },
  "wardrobe_items": [
    {
      "item_id": "shirt001",
      "name": "White Cotton T-shirt",
      "color": "White",
      "fabric": "Cotton",
      "warmth_level": 1
    }
  ],
  "user_preferences": {
    "style": "Casual"
  }
}
```

---

## Example AI Output

```json
{
  "outfit": [
    {
      "item_id": "shirt001",
      "name": "White Cotton T-shirt"
    },
    {
      "item_id": "shorts002",
      "name": "Beige Shorts"
    },
    {
      "item_id": "shoe005",
      "name": "White Sneakers"
    }
  ],
  "reasoning": "This outfit is ideal for a warm sunny day. The cotton fabric provides breathability, while the white and beige combination creates a clean, balanced look."
}
```

---

## Functional Highlights

### Authentication
- User registration
- Login
- Secure sessions

### Wardrobe Management
- Upload clothing images
- Store clothing metadata
- Edit and delete wardrobe items

### Weather Integration
- Live weather retrieval
- Temperature-aware recommendations

### AI Recommendation Engine
- Outfit generation
- Fashion reasoning
- Color coordination
- Weather adaptation

### Feedback System
- Like outfits
- Dislike outfits
- Store preferences

---

## Non-Functional Requirements

- Scalable architecture
- Secure Firebase integration
- Responsive user interface
- API key protection
- Outfit generation within approximately 5 seconds
- Reliable API communication

---

## Future Improvements

- Multiple outfit suggestions
- Seasonal wardrobe analysis
- Calendar outfit planning
- Occasion-based recommendations
- Clothing usage tracking
- Smart shopping suggestions
- AI-generated style insights

## License

This project is intended for educational purposes.
