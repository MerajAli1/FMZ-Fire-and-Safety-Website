import {
  auth, currentAdmin, isAdmin, signInWithEmailAndPassword, signOut, sendPasswordResetEmail,
  setPersistence, browserLocalPersistence, browserSessionPersistence,
} from './firebase.js';
import { $ } from './ui.js';

const form = $('#login-form');
const alertBox = $('#login-alert');
const btn = $('#login-btn');
const next = new URLSearchParams(location.search).get('next') || '';
const goToDashboard = () => location.replace(`index.html${next.startsWith('#/') ? next : ''}`);

const MESSAGES = {
  'auth/invalid-credential': 'Incorrect email or password.',
  'auth/wrong-password': 'Incorrect email or password.',
  'auth/user-not-found': 'Incorrect email or password.',
  'auth/invalid-email': 'Please enter a valid email address.',
  'auth/too-many-requests': 'Too many failed attempts. Please wait a few minutes or reset your password.',
  'auth/network-request-failed': 'Network error — check your internet connection.',
  'auth/user-disabled': 'This account has been disabled.',
};

function show(msg, type = 'error') {
  alertBox.className = `alert alert--${type}`;
  alertBox.textContent = msg;
  alertBox.hidden = false;
}

function busy(on) {
  btn.disabled = on;
  btn.innerHTML = on ? '<span class="spinner"></span> Signing in…' : 'Sign in';
}

currentAdmin().then((user) => { if (user) goToDashboard(); });

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  alertBox.hidden = true;
  const email = form.email.value.trim().toLowerCase();
  const password = form.password.value;
  if (!email || !password) return show('Please enter your email and password.');
  busy(true);
  try {
    await setPersistence(auth, form.remember.checked ? browserLocalPersistence : browserSessionPersistence);
    const { user } = await signInWithEmailAndPassword(auth, email, password);
    if (!isAdmin(user)) {
      await signOut(auth);
      busy(false);
      return show('This account does not have admin access.');
    }
    goToDashboard();
  } catch (err) {
    busy(false);
    show(MESSAGES[err.code] || 'Sign-in failed. Please try again.');
  }
});

$('#toggle-password').addEventListener('click', (e) => {
  const input = form.password;
  const showing = input.type === 'text';
  input.type = showing ? 'password' : 'text';
  e.currentTarget.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
  e.currentTarget.querySelector('use').setAttribute('href', `../assets/icons.svg#${showing ? 'eye' : 'eye-off'}`);
});

$('#forgot').addEventListener('click', async () => {
  const email = form.email.value.trim();
  if (!email) { form.email.focus(); return show('Enter your email above, then click “Forgot password?” again.', 'info'); }
  try {
    await sendPasswordResetEmail(auth, email);
  } catch { /* don't reveal whether the account exists */ }
  show(`If an account exists for ${email}, a password reset link has been sent.`, 'success');
});
