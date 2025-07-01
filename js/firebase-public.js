// Firebase App (compat) is required for Firestore access
// This script should be included after Firebase scripts in public pages
if (typeof firebase !== 'undefined' && firebase.apps && !firebase.apps.length) {
    firebase.initializeApp({
        apiKey: "AIzaSyDcc4sirAvyZCalzGij9dxGWsF_bOGL35U",
        authDomain: "fmz-website-2e422.firebaseapp.com",
        projectId: "fmz-website-2e422",
        storageBucket: "fmz-website-2e422.firebasestorage.app",
        messagingSenderId: "421000159927",
        appId: "1:421000159927:web:d78627ebd65440994de332"
    });
}
// This script is only for public pages (index, equipments)
if (typeof firebase !== 'undefined' && firebase.firestore) {
    // No-op: Firestore is available
}
