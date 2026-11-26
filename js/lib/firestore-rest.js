/**
 * Minimal Firestore REST client for the public site.
 * Avoids shipping the ~400 KB Firebase SDK to visitors: reads are plain fetch()
 * calls, governed by the same security rules as the SDK.
 */
import { FIREBASE_CONFIG } from '../config.js';

const BASE = `https://firestore.googleapis.com/v1/projects/${FIREBASE_CONFIG.projectId}/databases/(default)/documents`;
const KEY = `key=${FIREBASE_CONFIG.apiKey}`;

function decodeValue(v) {
  if (!v || typeof v !== 'object') return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return Number(v.doubleValue);
  if ('booleanValue' in v) return v.booleanValue;
  if ('timestampValue' in v) return Date.parse(v.timestampValue);
  if ('nullValue' in v) return null;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(decodeValue);
  if ('mapValue' in v) return decodeFields(v.mapValue.fields);
  if ('referenceValue' in v) return v.referenceValue;
  return null;
}

function decodeFields(fields = {}) {
  const out = {};
  for (const [k, v] of Object.entries(fields)) out[k] = decodeValue(v);
  return out;
}

function decodeDoc(doc) {
  return { id: doc.name.split('/').pop(), ...decodeFields(doc.fields) };
}

function encodeValue(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(encodeValue) } };
  switch (typeof v) {
    case 'string': return { stringValue: v };
    case 'boolean': return { booleanValue: v };
    case 'number': return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
    case 'object': return { mapValue: { fields: encodeFields(v) } };
    default: return { stringValue: String(v) };
  }
}

function encodeFields(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) out[k] = encodeValue(v);
  return out;
}

async function request(url, init) {
  const res = await fetch(url, init);
  if (res.status === 404) return null;
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try { msg = (await res.json()).error?.message || msg; } catch { /* ignore */ }
    const err = new Error(msg);
    err.status = res.status; // 403 = rejected by rules, 409 = document already exists
    throw err;
  }
  return res.json();
}

/** List every document in a collection (follows pagination). */
export async function listCollection(collection) {
  const docs = [];
  let pageToken = '';
  do {
    const url = `${BASE}/${collection}?pageSize=300&${KEY}${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`;
    const json = await request(url);
    if (!json) break;
    (json.documents || []).forEach((d) => docs.push(decodeDoc(d)));
    pageToken = json.nextPageToken || '';
  } while (pageToken);
  return docs;
}

/** Fetch one document; resolves to null when it does not exist. */
export async function getDocument(path) {
  const json = await request(`${BASE}/${path}?${KEY}`);
  return json ? decodeDoc(json) : null;
}

/** Create a document (auto-generated id unless `id` is given; fails with 409 if it exists). */
export async function createDocument(collection, data, id) {
  const docId = id ? `&documentId=${encodeURIComponent(id)}` : '';
  const json = await request(`${BASE}/${collection}?${KEY}${docId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: encodeFields(data) }),
  });
  return json ? decodeDoc(json) : null;
}
