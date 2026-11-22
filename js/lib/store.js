/**
 * Stale-while-revalidate data loader.
 * Renders instantly from localStorage on repeat visits, then refreshes from
 * Firestore in the background and re-renders only if the data changed.
 */
import { listCollection, getDocument } from './firestore-rest.js';

const CACHE_PREFIX = 'fmz:v2:';
const inflight = new Map();

function readCache(source) {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + source);
    return raw ? JSON.parse(raw).d : undefined;
  } catch {
    return undefined;
  }
}

function writeCache(source, data) {
  try {
    localStorage.setItem(CACHE_PREFIX + source, JSON.stringify({ t: Date.now(), d: data }));
  } catch { /* storage full or disabled — ignore */ }
}

/** source format: "col:<collection>" or "doc:<collection>/<id>" */
function fetchSource(source) {
  if (!inflight.has(source)) {
    const [kind, path] = [source.slice(0, 3), source.slice(4)];
    const promise = kind === 'col' ? listCollection(path) : getDocument(path).then((d) => d || {});
    inflight.set(source, promise);
  }
  return inflight.get(source);
}

/**
 * @param {Record<string,string>} sources e.g. { settings: 'doc:settings/site', items: 'col:equipments' }
 * @param {(data: Record<string, any>, meta: {cached: boolean, error?: boolean}) => void} render
 */
export async function useData(sources, render) {
  const entries = Object.entries(sources);
  const cached = {};
  let haveAll = true;
  for (const [key, src] of entries) {
    cached[key] = readCache(src);
    if (cached[key] === undefined) haveAll = false;
  }
  if (haveAll) safeRender(render, cached, { cached: true });

  const fresh = {};
  let error = false;
  await Promise.all(entries.map(async ([key, src]) => {
    try {
      fresh[key] = await fetchSource(src);
      writeCache(src, fresh[key]);
    } catch (err) {
      console.warn(`[fmz] failed to load ${src}:`, err.message);
      error = true;
      fresh[key] = cached[key] ?? null;
    }
  }));

  if (!haveAll || JSON.stringify(fresh) !== JSON.stringify(cached)) {
    safeRender(render, fresh, { cached: false, error });
  }
}

function safeRender(render, data, meta) {
  try {
    render(data, meta);
  } catch (err) {
    console.error('[fmz] render error', err);
  }
}

/** Common list helpers */
export const isPublished = (item) => item && item.published !== false;

export function sortItems(items) {
  return [...items].sort((a, b) => {
    const oa = Number.isFinite(a.order) ? a.order : Infinity;
    const ob = Number.isFinite(b.order) ? b.order : Infinity;
    if (oa !== ob) return oa - ob;
    return toMillis(b.createdAt) - toMillis(a.createdAt);
  });
}

export function toMillis(value) {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Date.parse(value) || 0;
  if (value.seconds) return value.seconds * 1000;
  return 0;
}

export function publishedSorted(items) {
  return sortItems((items || []).filter(isPublished));
}
