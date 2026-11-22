/** Small DOM + formatting helpers shared by public page scripts. */
import { CATEGORY_LABELS } from '../config.js';

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
/** Escape untrusted text before inserting into HTML. */
export const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ESCAPES[c]);

/** Inline SVG icon from the shared sprite. */
export const icon = (name, cls = '') =>
  `<svg class="icon ${cls}" aria-hidden="true"><use href="assets/icons.svg#${name}"></use></svg>`;

/** Only allow http(s) and site-relative URLs into src/href attributes. */
export function safeUrl(url) {
  const u = String(url || '').trim();
  if (!u) return '';
  if (/^https?:\/\//i.test(u)) return u;
  if (/^[a-z][a-z0-9+.-]*:/i.test(u)) return ''; // javascript:, data:, etc.
  return u;
}

/**
 * Optimised image URL. Cloudinary URLs get automatic format/quality and a width cap,
 * which typically cuts image weight by 60–80%.
 */
export function imgUrl(url, width = 800) {
  const u = safeUrl(url);
  if (!u.includes('res.cloudinary.com') || !u.includes('/upload/')) return u;
  if (/\/upload\/[^/]*(f_auto|q_auto|w_\d+)/.test(u)) return u;
  return u.replace('/upload/', `/upload/f_auto,q_auto,c_limit,w_${width}/`);
}

export function imgSrcset(url, widths = [400, 800, 1200]) {
  const u = safeUrl(url);
  if (!u.includes('res.cloudinary.com')) return '';
  return widths.map((w) => `${imgUrl(u, w)} ${w}w`).join(', ');
}

export function categoryLabel(slug) {
  if (!slug) return '';
  const key = String(slug).toLowerCase();
  return CATEGORY_LABELS[key] || key.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export const slugify = (s) => String(s || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function initials(name) {
  return String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('');
}

export function debounce(fn, ms = 200) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

export const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
