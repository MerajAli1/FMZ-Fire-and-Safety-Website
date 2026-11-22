/**
 * Central configuration shared by the public site and the admin dashboard.
 * Firebase web config values are public identifiers (not secrets) — access is
 * enforced by Firestore security rules (see firestore.rules).
 */
export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyDcc4sirAvyZCalzGij9dxGWsF_bOGL35U',
  authDomain: 'fmz-website-2e422.firebaseapp.com',
  projectId: 'fmz-website-2e422',
  storageBucket: 'fmz-website-2e422.firebasestorage.app',
  messagingSenderId: '421000159927',
  appId: '1:421000159927:web:d78627ebd65440994de332',
  measurementId: 'G-24W32Z7JZE',
};

/** Images are hosted on Cloudinary via an unsigned upload preset. */
export const CLOUDINARY = {
  cloudName: 'dfyvwloys',
  uploadPreset: 'fmz_unsigned',
};

/** Accounts allowed into the admin dashboard. Must match isAdmin() in firestore.rules. */
export const ADMIN_EMAILS = ['admin123@gmail.com'];

/** Fallback site settings, used until the admin saves their own in Settings. */
export const DEFAULT_SETTINGS = {
  companyName: 'FMZ Fire & Safety Engineering',
  tagline: 'Fire protection, safety training & equipment',
  phone: '+92 345 2008861',
  whatsapp: '923452008861',
  email: 'info@fmz.com',
  address: 'Karachi, Pakistan',
  hours: 'Mon – Sat: 9:00 AM – 6:00 PM',
  facebook: 'https://www.facebook.com/p/FMZ-Fire-Safety-Engineering-100064305961947/',
  linkedin: '',
  instagram: '',
  youtube: '',
  mapEmbed: '',
  announcement: '',
  announcementLink: '',
  statYears: 10,
  statClients: 100,
  statTrained: 5000,
  statPrograms: 15,
  clientsSeeded: false,
};

/** Human labels for category slugs. Unknown slugs are title-cased automatically. */
export const CATEGORY_LABELS = {
  // equipment
  fire: 'Fire Safety',
  ppe: 'Personal Protection',
  'first-aid': 'First Aid',
  emergency: 'Emergency Equipment',
  detection: 'Detection & Alarm',
  // client industries
  automotive: 'Automotive',
  textile: 'Textile',
  education: 'Education',
  banking: 'Banking',
  pharma: 'Pharmaceutical',
  fmcg: 'FMCG',
  packaging: 'Packaging',
  // gallery
  training: 'Training',
  installation: 'Installation',
  events: 'Events',
  projects: 'Projects',
};

/** Training icon choices (ids in assets/icons.svg). */
export const ICON_CHOICES = [
  'fire-extinguisher', 'flame', 'first-aid', 'heart-pulse', 'hard-hat', 'ladder',
  'flask', 'alarm', 'shield', 'clipboard-check', 'wrench', 'users', 'award', 'graduation',
];
