// Firebase Configuration - uses values from config.js
const firebaseConfig = {
    apiKey: CONFIG.FIREBASE_API_KEY,
    authDomain: CONFIG.FIREBASE_AUTH_DOMAIN,
    projectId: CONFIG.FIREBASE_PROJECT_ID,
    storageBucket: CONFIG.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: CONFIG.FIREBASE_MESSAGING_SENDER_ID,
    appId: CONFIG.FIREBASE_APP_ID
};

// Check if config is valid (not still placeholders)
if (firebaseConfig.apiKey.includes('PLACEHOLDER')) {
    console.error('Firebase config not set! Check environment variables in Netlify.');
    document.body.innerHTML = '<div style="padding: 40px; text-align: center;"><h2>Configuration Error</h2><p>Environment variables not set. Please check Netlify settings.</p></div>';
    throw new Error('Invalid Firebase configuration');
}

// Initialize Firebase
let auth, db;
try {
    firebase.initializeApp(firebaseConfig);
    auth = firebase.auth();
    db = firebase.firestore();
    console.log('Firebase initialized successfully');
} catch (error) {
    console.error('Firebase initialization error:', error);
    throw error;
}

// Auth state
let currentUser = null;

// Auth state listener
auth.onAuthStateChanged(async (user) => {
    currentUser = user;

    if (user) {
        console.log('User signed in:', user.displayName);
        await initializeUserData(user.uid);
        showApp();
        loadAllData();
    } else {
        console.log('User signed out');
        showLogin();
    }
});

// Sign in with Google
async function signInWithGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.addScope('https://www.googleapis.com/auth/calendar.readonly');

    try {
        const result = await auth.signInWithPopup(provider);
        // Store the Google access token for Calendar API
        if (result.credential) {
            const token = result.credential.accessToken;
            sessionStorage.setItem('googleAccessToken', token);
        }
        return result.user;
    } catch (error) {
        console.error('Sign in error:', error);
        showToast('Sign in failed. Please try again.');
        throw error;
    }
}

// Sign out
async function signOut() {
    try {
        await auth.signOut();
        sessionStorage.removeItem('googleAccessToken');
    } catch (error) {
        console.error('Sign out error:', error);
    }
}

// Initialize user data in Firestore (if new user)
async function initializeUserData(userId) {
    const userDoc = db.collection('users').doc(userId);
    const doc = await userDoc.get();

    if (!doc.exists) {
        // New user - create initial data structure
        await userDoc.set({
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            settings: {
                focusDuration: 20,
                greetingDismissedDate: null
            }
        });

        // Create default priorities
        await userDoc.collection('priorities').doc('work').set({
            items: []
        });
        await userDoc.collection('priorities').doc('personal').set({
            items: []
        });
    }
}

// Get user document reference
function getUserDoc() {
    if (!currentUser) throw new Error('No user signed in');
    return db.collection('users').doc(currentUser.uid);
}

// Show/hide UI based on auth state
function showLogin() {
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('app').classList.remove('active');
}

function showApp() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('app').classList.add('active');

    // Update user avatar
    if (currentUser && currentUser.photoURL) {
        const avatar = document.getElementById('userAvatar');
        if (avatar) {
            avatar.src = currentUser.photoURL;
            avatar.style.display = 'block';
        }
    }

    // Update mobile user info
    if (typeof updateMobileUserInfo === 'function') {
        updateMobileUserInfo(currentUser);
    }

    // Update greeting with user name
    const greetingEl = document.querySelector('.greeting h2');
    if (greetingEl && currentUser) {
        const hour = new Date().getHours();
        let greeting = 'Good morning';
        if (hour >= 12 && hour < 17) greeting = 'Good afternoon';
        else if (hour >= 17) greeting = 'Good evening';

        const firstName = currentUser.displayName ? currentUser.displayName.split(' ')[0] : 'there';
        greetingEl.textContent = `${greeting}, ${firstName}!`;
    }
}
