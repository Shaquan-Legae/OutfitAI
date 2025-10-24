OutfitAI – Functional Requirements Document
System Overview
OutfitAI is an intelligent web application designed to suggest clothing outfits for students based on real-time weather conditions and the contents of their wardrobe. 
The system leverages Google Gemini AI for outfit reasoning and Firebase for authentication, storage, and wardrobe management. 
It dynamically fetches weather data from WeatherAPI and generates personalized outfit recommendations that are both weather-appropriate and fashion-coordinated.

1. Functional Requirements of the AI Model
    1.1 AI Model Overview
        The OutfitAI system integrates Gemini (Google’s multimodal LLM) to analyze wardrobe metadata and environmental context to produce outfit suggestions. 
        It uses structured prompts that include clothing attributes, color tones, fabric warmth levels, and real-time weather conditions.

    1.2 Functional Requirements
        ID	Requirement Name	Description
        AI-FR1	Wardrobe Analysis	The model shall analyze wardrobe items stored in Firebase, recognizing color tones, fabrics, and clothing types.
        AI-FR2	Color Coordination	The model shall generate outfits with aesthetically balanced color combinations (e.g., complementary or analogous tones).
        AI-FR3	Weather Adaptation	The AI shall consider current temperature, humidity, and conditions (sunny, rainy, cloudy, cold) to recommend weather-appropriate clothing.
        AI-FR4	Thermal Suitability Filtering	The model shall exclude clothing items with a warmth level higher than 3 when the temperature exceeds 25°C, and prioritize warmer fabrics below 15°C.
        AI-FR5	Outfit Generation Logic	The AI shall suggest at least one complete outfit consisting of top, bottom, and footwear, optionally adding accessories.
        AI-FR6	Fashion Reasoning	The AI shall justify the reasoning behind each outfit, describing how colors and textures complement each other.
        AI-FR7	Learning from User Feedback	The system shall record user feedback (likes/dislikes) to refine future outfit suggestions and preferences.
        AI-FR8	Wardrobe Image Retrieval	The model shall return item identifiers corresponding to wardrobe images stored in Firebase.
        AI-FR9	Prompt Adaptation	The system shall dynamically adjust Gemini prompts according to input data (weather, user style preferences, wardrobe size).
        AI-FR10	Output Format	The AI shall output recommendations in JSON format containing item_id, name, and image_url for each recommended item.

    1.3 Input Data Structure
        The AI model receives data in structured JSON format:
        {
        "weather": {"condition": "sunny", "temperature": 28, "humidity": 30},
        "wardrobe_items": [{"item_id": "shirt001", "name": "White Cotton T-shirt", "color": "white", "tone": "neutral", "fabric": "cotton", "warmth_level": 1, "image_url": "https://..."}],
        "user_preferences": {"style": "casual", "gender": "unisex"}
        }

    1.4 AI Output Example
        {
        "outfit": [
            {"item_id": "shirt001", "name": "White Cotton T-shirt", "image_url": "https://..."},
            {"item_id": "shorts002", "name": "Beige Shorts", "image_url": "https://..."},
            {"item_id": "sneakers005", "name": "White Sneakers", "image_url": "https://..."}
        ],
        "reasoning": "This outfit suits a sunny 28°C day. The white and beige tones complement each other, and the cotton fabric ensures breathability."
        }

2. Functional Requirements of the Website
    2.1 Website Overview
        The OutfitAI website acts as the frontend interface for students to manage their wardrobe, check weather updates, and receive daily outfit recommendations. 
        The backend is built with Flask, connected to Firebase for storage and authentication, and uses REST APIs to communicate with the Gemini AI service.

    2.2 Functional Requirements
        ID	Requirement Name	Description
        WEB-FR1	User Authentication	The system shall use Firebase Authentication to allow users to register, sign in, and manage personal wardrobe data.
        WEB-FR2	Wardrobe Management Interface	The website shall allow users to upload clothing photos and specify tags such as type, color, fabric, and warmth level.
        WEB-FR3	Weather Data Fetching	The website shall automatically fetch the current weather conditions using WeatherAPI when the user visits the homepage.
        WEB-FR4	Outfit Recommendation Trigger	The user shall be able to click a 'Get Outfit' button that sends wardrobe and weather data to the Flask backend.
        WEB-FR5	AI Integration Endpoint	The backend shall send the compiled wardrobe and weather data to the Gemini API for analysis and outfit generation.
        WEB-FR6	Dynamic Outfit Display	The website shall display the suggested outfit, including the images of clothing items and brief reasoning provided by the AI.
        WEB-FR7	User Feedback Mechanism	Users shall be able to like or dislike an outfit suggestion, and the feedback shall be stored in Firebase.
        WEB-FR8	Responsive UI	The web interface shall adapt to different device screen sizes (mobile, tablet, desktop).
        WEB-FR9	Session Persistence	The user’s last outfit suggestion shall persist in their profile for reference even after logout.
        WEB-FR10	Data Privacy Compliance	The website shall not share or expose user data publicly; all wardrobe and weather data is user-specific and securely stored in Firebase.

3. Integration and Workflow
    3.1 Workflow
        a. User Login → via Firebase Authentication.
        b. Wardrobe Fetching → Retrieve wardrobe images and metadata from Firestore.
        c. Weather Fetching → Index.html fetches weather from WeatherAPI and sends it to Flask.
        d. AI Request → Flask compiles wardrobe + weather + preferences and sends them to Gemini.
        e. Gemini Response → AI returns selected items and reasoning.
        f. Frontend Display → Website displays outfit images and explanation.
        g. User Feedback → Feedback sent to Firebase to improve recommendations.

    3.2 APIs and Services
        Service	Purpose
        Firebase Authentication	User login & signup
        Firebase Firestore	Wardrobe metadata storage
        Firebase Storage	Clothing image storage
        WeatherAPI	Real-time weather data
        Gemini API	AI reasoning and outfit generation
        Flask REST API	Backend communication bridge

4. Non-Functional Requirements (Summary)
    ID	Requirement	Description
    NFR1	Scalability	System should support multiple concurrent users with minimal performance drop.
    NFR2	Reliability	Gemini API requests should have retry logic for failed requests.
    NFR3	Usability	The website must provide a clean and intuitive UI for students to easily manage their wardrobe.
    NFR4	Security	All API keys and Firebase credentials must be securely stored and not exposed to the client.
    NFR5	Performance	Outfit generation should complete within 5 seconds under normal network conditions.

5. Summary
    The OutfitAI system leverages Gemini AI’s multimodal understanding to provide intelligent outfit suggestions that are not only fashionably appealing but also practical for the weather. 
    With Firebase managing wardrobe data and user access, and Flask connecting the front-end with Gemini’s AI reasoning, the system ensures a smooth and personalized experience for every student user.

