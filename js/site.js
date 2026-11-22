/**
 * Shared behaviour for every public page: navigation, header state, scroll
 * reveals, counters, back-to-top, and site settings (contact details, social
 * links, announcement bar) managed from the admin dashboard.
 */
import { DEFAULT_SETTINGS } from './config.js';
import { useData } from './lib/store.js';
import { $, $$, safeUrl, prefersReducedMotion } from './lib/dom.js';

/* ---------- Navigation ---------- */
function initNav() {
  const nav = $('#site-nav');
  const toggle = $('.nav-toggle');
  const backdrop = $('.nav-backdrop');
  if (!nav || !toggle) return;

  const page = document.body.dataset.page;
  $$('.nav__link', nav).forEach((a) => {
    if (a.dataset.page === page) { a.classList.add('is-active'); a.setAttribute('aria-current', 'page'); }
  });

  const setOpen = (open) => {
    nav.classList.toggle('is-open', open);
    backdrop?.classList.toggle('is-open', open);
    document.body.classList.toggle('nav-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    if (open) $('.nav__link', nav)?.focus();
  };
  toggle.addEventListener('click', () => setOpen(!nav.classList.contains('is-open')));
  backdrop?.addEventListener('click', () => setOpen(false));
  $('.nav-close', nav)?.addEventListener('click', () => { setOpen(false); toggle.focus(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && nav.classList.contains('is-open')) { setOpen(false); toggle.focus(); } });
  window.matchMedia('(min-width: 1081px)').addEventListener('change', (e) => { if (e.matches) setOpen(false); });
}

/* ---------- Header shadow + back-to-top ---------- */
function initScroll() {
  const header = $('.header');
  const toTop = $('.to-top');
  let ticking = false;
  const update = () => {
    const y = window.scrollY;
    header?.classList.toggle('is-scrolled', y > 10);
    toTop?.classList.toggle('is-visible', y > 700);
    ticking = false;
  };
  window.addEventListener('scroll', () => {
    if (!ticking) { requestAnimationFrame(update); ticking = true; }
  }, { passive: true });
  toTop?.addEventListener('click', () => window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' }));
  update();
}

/* ---------- Reveal on scroll ---------- */
const revealObserver = 'IntersectionObserver' in window
  ? new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 })
  : null;

/** Observe `.reveal` elements inside root (call after injecting dynamic HTML). */
export function observeReveals(root = document) {
  $$('.reveal:not(.is-visible)', root).forEach((el) => {
    if (revealObserver) revealObserver.observe(el); else el.classList.add('is-visible');
  });
}

/* ---------- Animated counters ---------- */
const counterObserver = 'IntersectionObserver' in window
  ? new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      animateCount(entry.target);
      counterObserver.unobserve(entry.target);
    });
  }, { threshold: 0.4 })
  : null;

function animateCount(el) {
  const target = Number(el.dataset.count) || 0;
  const suffix = el.dataset.suffix || '';
  const fmt = (n) => `${Math.round(n).toLocaleString()}${suffix}`;
  if (prefersReducedMotion()) { el.textContent = fmt(target); return; }
  const start = performance.now();
  const dur = 1400;
  const step = (now) => {
    const p = Math.min(1, (now - start) / dur);
    el.textContent = fmt(target * (1 - Math.pow(1 - p, 3)));
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
  el.dataset.counted = '1';
}

function initCounters() {
  $$('[data-count]').forEach((el) => {
    if (counterObserver) counterObserver.observe(el); else animateCount(el);
  });
}

/* ---------- Site settings ---------- */
let currentSettings = { ...DEFAULT_SETTINGS };
export const getSettings = () => currentSettings;

const digits = (s) => String(s || '').replace(/\D/g, '');

/** Fields an admin may intentionally clear (hides the element) rather than fall back to the default. */
const CLEARABLE = new Set(['facebook', 'linkedin', 'instagram', 'youtube', 'announcement', 'announcementLink', 'mapEmbed', 'tagline']);

function applySettings(raw) {
  const s = { ...DEFAULT_SETTINGS };
  Object.entries(raw || {}).forEach(([k, v]) => {
    if (v === null || v === undefined) return;
    if (v === '' && !CLEARABLE.has(k)) return;
    s[k] = v;
  });
  currentSettings = s;

  $$('[data-setting]').forEach((el) => { const v = s[el.dataset.setting]; if (v) el.textContent = v; });
  $$('[data-href="tel"]').forEach((el) => { el.href = `tel:${String(s.phone).replace(/[^\d+]/g, '')}`; });
  $$('[data-href="mailto"]').forEach((el) => { el.href = `mailto:${s.email}`; });
  const wa = digits(s.whatsapp || s.phone);
  $$('[data-href="whatsapp"]').forEach((el) => {
    el.hidden = !wa;
    el.href = `https://wa.me/${wa}?text=${encodeURIComponent("Hello FMZ, I'd like to know more about your services.")}`;
  });
  $$('[data-social]').forEach((el) => {
    const url = safeUrl(s[el.dataset.social]);
    el.hidden = !url;
    if (url) el.href = url;
  });
  $$('[data-stat]').forEach((el) => {
    const n = Number(s[el.dataset.stat]);
    if (!Number.isFinite(n)) return;
    el.dataset.count = n;
    if (el.dataset.counted) el.textContent = `${n.toLocaleString()}${el.dataset.suffix || ''}`;
  });

  const bar = $('#announcement');
  if (bar) {
    const text = String(s.announcement || '').trim();
    bar.hidden = !text;
    if (text) {
      bar.textContent = text;
      const link = safeUrl(s.announcementLink);
      if (link) {
        const a = document.createElement('a');
        a.href = link;
        a.textContent = 'Learn more';
        bar.appendChild(a);
      }
    }
  }
  document.dispatchEvent(new CustomEvent('fmz:settings', { detail: s }));
}

/* ---------- Broken image fallback ---------- */
function initImageFallback() {
  document.addEventListener('error', (e) => {
    const img = e.target;
    if (!(img instanceof HTMLImageElement) || img.dataset.failed) return;
    img.dataset.failed = '1';
    img.removeAttribute('srcset');
    img.src = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 3"><rect width="4" height="3" fill="#eef2f7"/></svg>');
  }, true);
}

/* ---------- Boot ---------- */
initImageFallback();
initNav();
initScroll();
observeReveals();
initCounters();
$$('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });
useData({ settings: 'doc:settings/site' }, ({ settings }) => applySettings(settings));
