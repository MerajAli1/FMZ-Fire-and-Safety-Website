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

/** Firestore trainings replace the defaults as soon as any exist. */
export function resolveTrainings(firestoreTrainings) {
  const raw = firestoreTrainings || [];
  return raw.length ? publishedSorted(raw) : DEFAULT_TRAININGS;
}
