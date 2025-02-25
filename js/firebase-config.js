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

    // Initialize Firebase
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
    const db = firebase.firestore();

    // Enable persistance to handle offline scenarios
    db.enablePersistence()
        .catch((err) => {
            if (err.code == 'failed-precondition') {
                console.log('Persistence failed');
            } else if (err.code == 'unimplemented') {
                console.log('Persistence not available');
            }
        });
});
