// --- Firebase Config & Initialization ---
const firebaseConfig = {
    apiKey: "AIzaSyDZZoBF1xSErZKeYT5KsY3XpDpKyQYORdg",
    authDomain: "outfitai-a4f33.firebaseapp.com",
    projectId: "outfitai-a4f33",
    storageBucket: "outfitai-a4f33.appspot.com",
    messagingSenderId: "909051410289",
    appId: "1:909051410289:web:9ad70a7986c8233ff268d0",
    measurementId: "G-CB918H4618"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const googleProvider = new firebase.auth.GoogleAuthProvider();

// --- DOM Elements ---
const loginContainer = document.getElementById('login-container');
const registerContainer = document.getElementById('register-container');
const showRegisterLink = document.getElementById('show-register');
const showLoginLink = document.getElementById('show-login');

const loginEmail = document.getElementById('login-email');
const loginPass = document.getElementById('login-password');
const btnLogin = document.getElementById('btn-login');
const btnGoogleLogin = document.getElementById('btn-google-login');
const btnAppleLogin = document.getElementById('btn-apple-login');

const regName = document.getElementById('reg-name');
const regEmail = document.getElementById('reg-email');
const regPass = document.getElementById('reg-password');
const btnRegister = document.getElementById('btn-register');

const authErrorLogin = document.getElementById('auth-error-login');
const authErrorRegister = document.getElementById('auth-error-register');

// --- Toggle Forms ---
function showRegisterForm() {
    loginContainer.style.opacity = '0';
    loginContainer.style.transform = 'translateY(10px)';
    setTimeout(() => {
        loginContainer.style.display = 'none';
        registerContainer.style.display = 'block';
        registerContainer.style.opacity = '1';
        registerContainer.style.transform = 'translateY(0)';
        authErrorLogin.innerText = '';
        authErrorRegister.innerText = '';
    }, 300);
}

function showLoginForm() {
    registerContainer.style.opacity = '0';
    registerContainer.style.transform = 'translateY(10px)';
    setTimeout(() => {
        registerContainer.style.display = 'none';
        loginContainer.style.display = 'block';
        loginContainer.style.opacity = '1';
        loginContainer.style.transform = 'translateY(0)';
        authErrorLogin.innerText = '';
        authErrorRegister.innerText = '';
    }, 300);
}

showRegisterLink.addEventListener('click', showRegisterForm);
showLoginLink.addEventListener('click', showLoginForm);

// --- Backend Session Notifier ---
async function notifyBackend(user) {
    authErrorLogin.innerText = 'Verifying session...';
    authErrorRegister.innerText = '';
    try {
        const idToken = await user.getIdToken();
        const response = await fetch('/api/auth/session_login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken })
        });

        if (response.ok) {
            window.location.href = '/';
        } else {
            const data = await response.json();
            const message = data.error || 'Server session verification failed.';
            authErrorLogin.innerText = message;
            await auth.signOut();
        }
    } catch (error) {
        console.error('Backend session login error:', error);
        authErrorLogin.innerText = `Error contacting server: ${error.message}`;
    }
}

// --- Login Event ---
btnLogin.addEventListener('click', async e => {
    e.preventDefault();
    authErrorLogin.innerText = '';
    authErrorRegister.innerText = '';

    const email = loginEmail.value.trim();
    const password = loginPass.value;

    if (!email || !password) {
        authErrorLogin.innerText = 'Please enter both email and password.';
        return;
    }

    try {
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        await notifyBackend(userCredential.user);
    } catch (error) {
        console.error("Login error:", error);
        switch (error.code) {
            case 'auth/user-not-found':
                authErrorLogin.innerText = 'No account found with this email.';
                break;
            case 'auth/wrong-password':
                authErrorLogin.innerText = 'Incorrect password.';
                break;
            case 'auth/invalid-email':
                authErrorLogin.innerText = 'Invalid email address.';
                break;
            default:
                authErrorLogin.innerText = error.message;
        }
    }
});

// --- Google Login ---
btnGoogleLogin.addEventListener('click', async e => {
    e.preventDefault();
    authErrorLogin.innerText = '';
    authErrorRegister.innerText = '';

    try {
        const result = await auth.signInWithPopup(googleProvider);
        await notifyBackend(result.user);
    } catch (error) {
        console.error("Google login error:", error);
        if (error.code !== 'auth/popup-closed-by-user') {
            authErrorLogin.innerText = error.message;
        }
    }
});

// --- Apple Login (Placeholder) ---
if (btnAppleLogin) {
    btnAppleLogin.addEventListener('click', e => {
        e.preventDefault();
        authErrorLogin.innerText = 'Apple Login not implemented yet.';
        console.warn("Apple login requires additional setup.");
    });
}

// --- Registration Event ---
btnRegister.addEventListener('click', async e => {
    e.preventDefault();
    authErrorLogin.innerText = '';
    authErrorRegister.innerText = '';

    const email = regEmail.value.trim();
    const password = regPass.value;
    const displayName = regName.value.trim();

    if (!email || !password || !displayName) {
        authErrorRegister.innerText = 'Please fill in all fields.';
        return;
    }

    if (password.length < 6) {
        authErrorRegister.innerText = 'Password must be at least 6 characters.';
        return;
    }

    authErrorRegister.innerText = 'Creating account...';

    try {
        // Call backend to create user in Firebase Admin
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, displayName })
        });

        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data.error || `Registration failed: ${response.statusText}`);
        }

        const data = await response.json();

        if (!data.uid) {
            throw new Error(data.error || 'Registration succeeded but no UID returned.');
        }

        authErrorRegister.innerText = 'Account created! Logging in...';
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        await notifyBackend(userCredential.user);

    } catch (error) {
        console.error("Registration error:", error);
        authErrorRegister.innerText = error.message;
    }
});
