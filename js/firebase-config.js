// Wait for Firebase SDK to load
window.addEventListener('DOMContentLoaded', (event) => {
    const firebaseConfig = {
        apiKey: "AIzaSyDcc4sirAvyZCalzGij9dxGWsF_bOGL35U",
        authDomain: "fmz-website-2e422.firebaseapp.com",
        projectId: "fmz-website-2e422",
        storageBucket: "fmz-website-2e422.firebasestorage.app",
        messagingSenderId: "421000159927",
        appId: "1:421000159927:web:d78627ebd65440994de332",
        measurementId: "G-24W32Z7JZE"
    };

    // Initialize Firebase immediately
    firebase.initializeApp(firebaseConfig);

    // Initialize Firestore
    const db = firebase.firestore();

    // Configure cache settings
    db.settings({
        cacheSizeBytes: firebase.firestore.CACHE_SIZE_UNLIMITED
    });

    // Enable offline persistence
    db.enablePersistence()
        .catch((err) => {
            if (err.code == 'failed-precondition') {
                console.log('Multiple tabs open, persistence can only be enabled in one tab at a time.');
            } else if (err.code == 'unimplemented') {
                console.log('The current browser does not support persistence.');
            }
        });
});
