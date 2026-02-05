// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyB6hG0VO4m8mH5zN4s5Esyw9g-SCiD0sW4",
    authDomain: "dannys-project-tracker.firebaseapp.com",
    projectId: "dannys-project-tracker",
    storageBucket: "dannys-project-tracker.firebasestorage.app",
    messagingSenderId: "495524959522",
    appId: "1:495524959522:web:3cdb8518f24a29624d017b"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize services
const auth = firebase.auth();
const db = firebase.firestore();

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
