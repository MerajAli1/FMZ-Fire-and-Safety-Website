/** Content rules shared by several pages. */
import { publishedSorted } from './store.js';
import { BUILTIN_CLIENTS, DEFAULT_TRAININGS } from '../data/defaults.js';

/** Built-in clients are shown until the admin imports them into Firestore. */
export function mergeClients(firestoreClients, settings) {
  const fromDb = publishedSorted(firestoreClients || []);
  if (settings?.clientsSeeded) return fromDb;
  const names = new Set(fromDb.map((c) => String(c.name || '').trim().toLowerCase()));
  return [...BUILTIN_CLIENTS.filter((b) => !names.has(b.name.toLowerCase())), ...fromDb];
}

/** Published blog posts, newest first (by article date, then creation time). */
export function publishedPosts(posts) {
  const time = (p) => Date.parse(p.date || '') || p.createdAt || 0;
  return (posts || []).filter((p) => p.published !== false && p.title && p.slug).sort((a, b) => time(b) - time(a));
}

/** Firestore trainings replace the defaults as soon as any exist. */
export function resolveTrainings(firestoreTrainings) {
  const raw = firestoreTrainings || [];
  return raw.length ? publishedSorted(raw) : DEFAULT_TRAININGS;
}
