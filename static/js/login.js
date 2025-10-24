// Initialize Firebase
const firebaseConfig = {
    apiKey: "AIzaSyDZZoBF1xSErZKeYT5KsY3XpDpKyQYORdg", // Replace with your actual key if different
    authDomain: "outfitai-a4f33.firebaseapp.com",
    projectId: "outfitai-a4f33",
    storageBucket: "outfitai-a4f33.appspot.com", // Corrected domain
    messagingSenderId: "909051410289",
    appId: "1:909051410289:web:9ad70a7986c8233ff268d0",
    measurementId: "G-CB918H4618"
};

// ------------------------------------------------------

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const googleProvider = new firebase.auth.GoogleAuthProvider();

// Get all DOM elements
const loginContainer = document.getElementById('login-container');
const registerContainer = document.getElementById('register-container');
const showRegisterLink = document.getElementById('show-register');
const showLoginLink = document.getElementById('show-login');

const loginEmail = document.getElementById('login-email');
const loginPass = document.getElementById('login-password');
const btnLogin = document.getElementById('btn-login');
const btnGoogleLogin = document.getElementById('btn-google-login');
const btnAppleLogin = document.getElementById('btn-apple-login'); // Get Apple button if needed

const regName = document.getElementById('reg-name');
const regEmail = document.getElementById('reg-email');
const regPass = document.getElementById('reg-password');
const btnRegister = document.getElementById('btn-register');

// FIX: Get separate error elements for login and register
const authErrorLogin = document.getElementById('auth-error-login');
const authErrorRegister = document.getElementById('auth-error-register');

// --- Form Toggling ---
showRegisterLink.addEventListener('click', () => {
    loginContainer.style.opacity = '0';
    loginContainer.style.transform = 'translateY(10px)';
    setTimeout(() => {
        loginContainer.style.display = 'none';
        registerContainer.style.display = 'block';
        registerContainer.style.opacity = '1';
        registerContainer.style.transform = 'translateY(0)';
        authErrorLogin.innerText = ''; // Clear login error
        authErrorRegister.innerText = ''; // Clear register error
    }, 300); // Match CSS transition duration
});

showLoginLink.addEventListener('click', () => {
    registerContainer.style.opacity = '0';
    registerContainer.style.transform = 'translateY(10px)';
     setTimeout(() => {
        registerContainer.style.display = 'none';
        loginContainer.style.display = 'block';
        loginContainer.style.opacity = '1';
        loginContainer.style.transform = 'translateY(0)';
        authErrorLogin.innerText = ''; // Clear login error
        authErrorRegister.innerText = ''; // Clear register error
    }, 300); // Match CSS transition duration
});

// --- Core Auth Function ---
// This function notifies our Flask backend that a user has logged in via Firebase Auth.
async function notifyBackend(user) {
    authErrorLogin.innerText = 'Verifying session...'; // Update login status
    authErrorRegister.innerText = ''; // Clear register status
    try {
        const idToken = await user.getIdToken();
        const response = await fetch('/api/auth/session_login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ idToken: idToken })
        });

        if (response.ok) {
            // Backend confirmed, redirect to the main app
            window.location.href = '/';
        } else {
            const errorData = await response.json();
            const errorMessage = `Server Error: ${errorData.error || response.statusText}`;
            console.error('Backend session login failed:', errorData);
            authErrorLogin.innerText = errorMessage; // Show error on login form
            // Log the user out of Firebase client-side if server fails
            auth.signOut();
        }
    } catch (error) {
        console.error('Error notifying backend:', error);
        authErrorLogin.innerText = `Error contacting server: ${error.message}`;
    }
}

// --- Event Listeners for Auth ---

// Email/Password Login
btnLogin.addEventListener('click', e => {
    e.preventDefault(); // Prevent potential form submission
    authErrorLogin.innerText = ''; // Clear old errors
    authErrorRegister.innerText = '';
    auth.signInWithEmailAndPassword(loginEmail.value, loginPass.value)
        .then(userCredential => notifyBackend(userCredential.user))
        .catch(error => {
            console.error("Login failed:", error);
            authErrorLogin.innerText = error.message;
         });
});

// Google Login
btnGoogleLogin.addEventListener('click', e => {
    e.preventDefault();
    authErrorLogin.innerText = '';
    authErrorRegister.innerText = '';
    auth.signInWithPopup(googleProvider)
        .then(userCredential => notifyBackend(userCredential.user))
        .catch(error => {
            console.error("Google login failed:", error);
             // Handle specific cancellation error gracefully
             if (error.code !== 'auth/popup-closed-by-user') {
                 authErrorLogin.innerText = error.message;
             }
        });
});

// Apple Login (Placeholder - Requires specific setup)
if (btnAppleLogin) {
    btnAppleLogin.addEventListener('click', e => {
        e.preventDefault();
        authErrorLogin.innerText = 'Apple Login is not yet implemented.';
        authErrorRegister.innerText = '';
        console.warn("Apple Login requires additional setup with Apple Developer account and Firebase configuration.");
        // Add Apple provider logic here when ready
        // const appleProvider = new firebase.auth.OAuthProvider('apple.com');
        // auth.signInWithPopup(appleProvider)...
    });
}


// Registration (Using Backend API)
btnRegister.addEventListener('click', e => {
    e.preventDefault(); // Prevent potential form submission
    authErrorLogin.innerText = '';
    authErrorRegister.innerText = ''; // Use register error field

    const email = regEmail.value;
    const password = regPass.value;
    const displayName = regName.value;

    // Basic client-side validation
    if (!email || !password || !displayName) {
        authErrorRegister.innerText = 'Please fill in all fields.';
        return;
    }
    if (password.length < 6) {
        authErrorRegister.innerText = 'Password must be at least 6 characters.';
        return;
    }

    authErrorRegister.innerText = 'Creating account...';

    // Call our own /api/register endpoint to handle user creation
    fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email: email,
            password: password,
            displayName: displayName
        })
    })
    .then(response => {
        console.log("Backend /api/register response status:", response.status); // DEBUG
        if (!response.ok) {
            // Try to parse error JSON from backend
            return response.json().then(errorData => {
                 console.error("Backend registration error:", errorData); // DEBUG
                // Use backend error message if available, otherwise generic
                throw new Error(errorData.error || `Registration failed with status: ${response.status}`);
            }).catch(parseError => {
                // If parsing fails (e.g., HTML error page returned)
                 console.error("Failed to parse backend error response:", parseError); // DEBUG
                throw new Error(`Registration failed. Server returned status: ${response.status}`);
            });
        }
        return response.json(); // If response is OK, parse success data
    })
    .then(data => {
        console.log("Backend /api/register success data:", data); // DEBUG
        if (data.uid) {
            // Backend Success! Now log the user in on the client side.
            authErrorRegister.innerText = 'Account created! Logging in...';
            // Sign in with the same credentials used for registration
            return auth.signInWithEmailAndPassword(email, password);
        } else {
            // Should be caught by !response.ok, but as a fallback
             throw new Error(data.error || 'Registration succeeded on backend, but no UID returned.');
        }
    })
    .then(userCredential => {
        // Client-side sign-in successful, now notify backend to create server session
        console.log("Client-side login after registration successful. Notifying backend..."); // DEBUG
        return notifyBackend(userCredential.user);
    })
    .catch(error => {
        console.error("Registration/Login process error:", error); // DEBUG
        authErrorRegister.innerText = error.message; // Display final error
    });
});