/** Firebase (modular SDK) initialisation for the admin dashboard. */
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut, sendPasswordResetEmail,
  setPersistence, browserLocalPersistence, browserSessionPersistence,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  getFirestore, collection, doc, getDoc, getDocs, addDoc, setDoc, updateDoc, deleteDoc,
  onSnapshot, serverTimestamp, writeBatch, getCountFromServer,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { FIREBASE_CONFIG, ADMIN_EMAILS } from '../../js/config.js';

export const app = initializeApp(FIREBASE_CONFIG);
export const auth = getAuth(app);
export const db = getFirestore(app);

export {
  onAuthStateChanged, signInWithEmailAndPassword, signOut, sendPasswordResetEmail,
  setPersistence, browserLocalPersistence, browserSessionPersistence,
  collection, doc, getDoc, getDocs, addDoc, setDoc, updateDoc, deleteDoc,
  onSnapshot, serverTimestamp, writeBatch, getCountFromServer,
};

export const isAdmin = (user) => Boolean(user?.email && ADMIN_EMAILS.includes(user.email.toLowerCase()));

/** Resolves with the signed-in admin, or null. Waits for Firebase to restore the session. */
export function currentAdmin() {
  return new Promise((resolve) => {
    const stop = onAuthStateChanged(auth, (user) => {
      stop();
      resolve(isAdmin(user) ? user : null);
    });
  });
}

/** Normalise Firestore Timestamp | ISO string | millis → Date (or null). */
export function toDate(value) {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate();
  if (value.seconds) return new Date(value.seconds * 1000);
  const d = new Date(typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value);
  return Number.isNaN(d.getTime()) ? null : d;
}
