/** Admin UI kit: escaping, icons, toasts, dialogs, formatting. */

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ESC[c]);
export const icon = (name, cls = '') => `<svg class="icon ${cls}" aria-hidden="true"><use href="../assets/icons.svg#${name}"></use></svg>`;
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export function debounce(fn, ms = 200) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

/** Site-relative asset paths (e.g. built-in client logos) need ../ inside /admin. */
export function assetUrl(url, width) {
  const u = String(url || '').trim();
  if (!u) return '';
  if (/^https?:\/\//i.test(u)) {
    if (width && u.includes('res.cloudinary.com') && u.includes('/upload/') && !/\/upload\/[^/]*w_\d+/.test(u)) {
      return u.replace('/upload/', `/upload/f_auto,q_auto,c_limit,w_${width}/`);
    }
    return u;
  }
  if (/^[a-z]+:/i.test(u)) return '';
  return `../${u.replace(/^\.?\//, '')}`;
}

/* ---------- Formatting ---------- */
export function formatDate(date, withTime = true) {
  if (!date) return '—';
  return date.toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  });
}

export function timeAgo(date) {
  if (!date) return '—';
  const s = Math.round((Date.now() - date.getTime()) / 1000);
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hr${h > 1 ? 's' : ''} ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d} day${d > 1 ? 's' : ''} ago`;
  return formatDate(date, false);
}

export const initials = (s) => String(s || '?').split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('');

/* ---------- Toasts ---------- */
let toastRoot;
export function toast(message, type = 'success', ms = 3500) {
  if (!toastRoot) {
    toastRoot = document.createElement('div');
    toastRoot.className = 'toasts';
    toastRoot.setAttribute('role', 'status');
    toastRoot.setAttribute('aria-live', 'polite');
    document.body.appendChild(toastRoot);
  }
  const el = document.createElement('div');
  el.className = `toast toast--${type}`;
  const ic = { success: 'check-circle', error: 'alert', info: 'info' }[type] || 'info';
  el.innerHTML = `${icon(ic)}<span>${esc(message)}</span>`;
  toastRoot.appendChild(el);
  setTimeout(() => { el.classList.add('is-leaving'); setTimeout(() => el.remove(), 260); }, ms);
}

/* ---------- Dialogs ---------- */
/**
 * Open a modal dialog. Returns { el, body, close }.
 * `onClose` runs whenever the dialog closes (button, Esc, backdrop).
 */
export function openModal({ title, body = '', footer = '', size = '', onClose, dismissable = true }) {
  const dlg = document.createElement('dialog');
  dlg.className = `modal ${size ? `modal--${size}` : ''}`;
  dlg.innerHTML = `
    <div class="modal__head"><h2>${esc(title)}</h2><button type="button" class="icon-btn" data-close aria-label="Close">${icon('x')}</button></div>
    <div class="modal__body"></div>
    ${footer ? `<div class="modal__foot">${footer}</div>` : ''}`;
  const bodyEl = dlg.querySelector('.modal__body');
  if (typeof body === 'string') bodyEl.innerHTML = body; else bodyEl.appendChild(body);
  document.body.appendChild(dlg);

  let locked = false;
  const close = () => { if (dlg.open) dlg.close(); };
  dlg.addEventListener('close', () => { onClose?.(); dlg.remove(); });
  dlg.addEventListener('cancel', (e) => { if (locked || !dismissable) e.preventDefault(); });
  dlg.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]') && !locked) close();
    else if (e.target === dlg && dismissable && !locked) close();
  });
  dlg.showModal();
  return {
    el: dlg,
    body: bodyEl,
    close,
    lock(state) { locked = state; },
  };
}

export function confirmDialog({ title = 'Are you sure?', text = '', confirmText = 'Delete', danger = true } = {}) {
  return new Promise((resolve) => {
    let result = false;
    const m = openModal({
      title,
      size: 'sm',
      body: `${danger ? `<div class="confirm__icon">${icon('trash', 'icon--lg')}</div>` : ''}<p style="margin:0">${esc(text)}</p>`,
      footer: `<button class="btn btn--secondary" data-close type="button">Cancel</button>
               <button class="btn ${danger ? 'btn--danger' : ''}" data-ok type="button">${esc(confirmText)}</button>`,
      onClose: () => resolve(result),
    });
    m.el.querySelector('[data-ok]').addEventListener('click', () => { result = true; m.close(); });
    m.el.querySelector('[data-ok]').focus();
  });
}

export function setBusy(btn, busy, label) {
  if (!btn) return;
  if (busy) {
    btn.dataset.label = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner"></span> ${esc(label || 'Saving…')}`;
  } else {
    btn.disabled = false;
    if (btn.dataset.label) btn.innerHTML = btn.dataset.label;
  }
}

export function friendlyError(err) {
  const code = err?.code || '';
  if (code.includes('permission-denied')) return 'Permission denied. Make sure the latest Firestore rules are published and you are signed in as the admin.';
  if (code.includes('unavailable')) return 'You appear to be offline. Please check your connection.';
  return err?.message || 'Something went wrong. Please try again.';
}

/** Download rows as a CSV file. */
export function downloadCsv(filename, rows) {
  const csv = rows.map((r) => r.map((v) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(',')).join('\n');
  const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
