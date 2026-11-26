/**
 * Client reviews: create secret, time-limited review links for clients, receive
 * their submissions, and choose which ones appear on the website as testimonials.
 *
 * reviewLinks/{token}        – public can read one link by its token (never list)
 * reviewSubmissions/{id}     – created by clients through review.html
 * testimonials/rev_<id>      – the published copy of a submission
 */
import {
  db, collection, doc, getDoc, setDoc, updateDoc, deleteDoc, onSnapshot, writeBatch, serverTimestamp, toDate,
} from './firebase.js';
import {
  esc, icon, $, $$, toast, openModal, confirmDialog, setBusy, friendlyError, formatDate, timeAgo, assetUrl,
} from './ui.js';
import { SITE_URL } from '../../js/config.js';

export const SUB_STATUSES = {
  new: { label: 'New', cls: 'badge--new' },
  published: { label: 'Shown on website', cls: 'badge--resolved' },
  hidden: { label: 'Hidden', cls: 'badge--hidden' },
};

const EXPIRY_PRESETS = [
  ['1d', '24 hours', 1], ['3d', '3 days', 3], ['7d', '7 days', 7], ['14d', '14 days', 14], ['30d', '30 days', 30],
];

/* ---------- Helpers ---------- */
function newToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export const reviewUrl = (token) => {
  // Local previews link to the local copy so the page can be tested before uploading.
  const base = /^(localhost|127\.0\.0\.1)$/.test(location.hostname)
    ? new URL('../', location.href).href.replace(/\/$/, '')
    : SITE_URL;
  return `${base}/review.html?t=${encodeURIComponent(token)}`;
};

const stars = (n) => `<span class="stars" aria-label="${n} out of 5 stars">${'★'.repeat(n)}<span>${'★'.repeat(5 - n)}</span></span>`;

function untilText(date) {
  if (!date) return '—';
  const diff = date.getTime() - Date.now();
  if (diff <= 0) return `Expired ${timeAgo(date)}`;
  const h = Math.round(diff / 3600000);
  if (h < 1) return `in ${Math.max(1, Math.round(diff / 60000))} min`;
  if (h < 48) return `in ${h} hr${h > 1 ? 's' : ''}`;
  return `in ${Math.round(h / 24)} days`;
}

function linkStatus(link, responses) {
  if (link.active === false) return { key: 'disabled', label: 'Disabled', cls: 'badge--hidden' };
  if (link.singleUse && responses > 0) return { key: 'used', label: 'Used', cls: 'badge--resolved' };
  if (!link.expires || link.expires.getTime() <= Date.now()) return { key: 'expired', label: 'Expired', cls: 'badge--progress' };
  return { key: 'active', label: 'Active', cls: 'badge--new' };
}

function shareText(link) {
  const hi = link.clientName ? `Dear ${link.clientName},` : 'Hello,';
  const until = link.expires ? ` The link is valid until ${formatDate(link.expires)}.` : '';
  return `${hi}\n\nThank you for choosing FMZ Fire & Safety Engineering. We would really appreciate a short review of your experience with us. It takes about a minute:\n${reviewUrl(link.id)}\n${until}\n\nThank you!\nFMZ Fire & Safety Engineering`;
}

async function copy(text, what = 'Link') {
  try { await navigator.clipboard.writeText(text); toast(`${what} copied`); } catch { toast('Could not copy — select and copy it manually', 'error'); }
}

/** Expiry picker (presets or a custom date & time). Returns { html, read(root) }. */
function expiryControl(id, current) {
  const pad = (n) => String(n).padStart(2, '0');
  const toLocal = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const fallback = current && current.getTime() > Date.now() ? current : new Date(Date.now() + 7 * 864e5);
  return {
    html: `
      <div class="field"><label for="${id}">Link expires after</label>
        <select class="select" id="${id}">
          ${EXPIRY_PRESETS.map(([v, l]) => `<option value="${v}" ${v === '7d' && !current ? 'selected' : ''}>${l}</option>`).join('')}
          <option value="custom" ${current ? 'selected' : ''}>Custom date &amp; time…</option>
        </select></div>
      <div class="field" data-custom-wrap ${current ? '' : 'hidden'}><label for="${id}-at">Expires on</label>
        <input class="input" type="datetime-local" id="${id}-at" value="${toLocal(fallback)}" min="${toLocal(new Date())}"></div>`,
    bind(root) {
      const sel = $(`#${id}`, root);
      sel.addEventListener('change', () => { $('[data-custom-wrap]', root).hidden = sel.value !== 'custom'; });
    },
    read(root) {
      const v = $(`#${id}`, root).value;
      if (v !== 'custom') return new Date(Date.now() + EXPIRY_PRESETS.find(([k]) => k === v)[2] * 864e5);
      const d = new Date($(`#${id}-at`, root).value);
      return Number.isNaN(d.getTime()) ? null : d;
    },
  };
}

/* ---------- View ---------- */
export function renderReviews(container) {
  const state = {
    tab: location.hash.includes('links') ? 'links' : 'submissions',
    filter: 'all',
    links: null,
    subs: null,
  };

  container.innerHTML = `
    <div class="page-head">
      <div><h1>Client reviews</h1><p>Send a client a private review link. Their review arrives here, and you decide whether it appears on the website.</p></div>
      <div class="page-head__actions">
        <a class="btn btn--secondary" href="#/testimonials">${icon('quote')} All testimonials</a>
        <button class="btn" data-create>${icon('plus')} Create review link</button>
      </div>
    </div>
    <div class="toolbar">
      <div class="tabs" data-tabs>
        <button class="tab" data-tab="submissions">${icon('inbox', 'icon--sm')} Submissions <span class="count" data-c="subs"></span></button>
        <button class="tab" data-tab="links">${icon('external', 'icon--sm')} Review links <span class="count" data-c="links"></span></button>
      </div>
      <span class="toolbar__grow"></span>
      <div class="tabs" data-filters></div>
    </div>
    <div class="card"><div data-list><div class="loading-block"><div class="boot__spinner"></div></div></div></div>`;

  const listEl = $('[data-list]', container);

  const responsesFor = (linkId) => (state.subs || []).filter((s) => s.linkId === linkId).length;

  function render() {
    $$('[data-tab]', container).forEach((b) => b.classList.toggle('is-active', b.dataset.tab === state.tab));
    if (state.subs) $('[data-c="subs"]', container).textContent = state.subs.length;
    if (state.links) $('[data-c="links"]', container).textContent = state.links.length;
    if (state.tab === 'submissions') renderSubs(); else renderLinks();
  }

  function renderFilters(options) {
    $('[data-filters]', container).innerHTML = options.map(([k, l, n]) => `<button class="tab ${state.filter === k ? 'is-active' : ''}" data-filter="${k}">${esc(l)} <span class="count">${n}</span></button>`).join('');
  }

  /* ----- Submissions ----- */
  function renderSubs() {
    if (!state.subs) return;
    const all = state.subs;
    renderFilters([['all', 'All', all.length], ...Object.entries(SUB_STATUSES).map(([k, s]) => [k, s.label, all.filter((x) => x.status === k).length])]);
    const list = all.filter((s) => state.filter === 'all' || s.status === state.filter);
    if (!list.length) {
      listEl.innerHTML = `<div class="empty">${icon('message')}<h3>${all.length ? 'Nothing here' : 'No reviews yet'}</h3><p>${all.length ? 'Try another filter.' : 'Create a review link and send it to a client. Their review will appear here.'}</p>
        ${all.length ? '' : `<button class="btn" data-create style="margin-top:14px">${icon('plus')} Create review link</button>`}</div>`;
      return;
    }
    listEl.innerHTML = `<div class="review-list">${list.map((s) => `
      <article class="review-item ${s.status === 'new' ? 'is-unread' : ''}" data-sub="${esc(s.id)}" tabindex="0">
        <span class="review-item__avatar">${s.imageUrl ? `<img src="${esc(assetUrl(s.imageUrl, 120))}" alt="">` : esc((s.name || '?').trim()[0]?.toUpperCase() || '?')}</span>
        <div class="review-item__body">
          <div class="review-item__head">
            <strong>${esc(s.name || '—')}</strong>
            <span class="cell-muted">${esc([s.role, s.company].filter(Boolean).join(', '))}</span>
          </div>
          ${stars(s.rating)}
          <p class="review-item__quote">“${esc(s.quote || '')}”</p>
          <div class="cell-muted review-item__meta">${esc(timeAgo(s.date))}${s.linkName ? ` · via link for ${esc(s.linkName)}` : ''}</div>
        </div>
        <div class="review-item__side">
          <span class="badge ${SUB_STATUSES[s.status].cls}">${SUB_STATUSES[s.status].label}</span>
          <label class="switch" title="Show on website"><input type="checkbox" data-show="${esc(s.id)}" ${s.status === 'published' ? 'checked' : ''}><span class="switch__track"></span><span class="hide-sm">On website</span></label>
        </div>
      </article>`).join('')}</div>`;
  }

  async function setShown(sub, show) {
    const tRef = doc(db, 'testimonials', `rev_${sub.id}`);
    const batch = writeBatch(db);
    if (show) {
      const existing = await getDoc(tRef);
      if (existing.exists()) batch.update(tRef, { published: true, updatedAt: serverTimestamp() });
      else {
        const t = {
          name: sub.name, rating: sub.rating, quote: sub.quote, published: true,
          source: 'client-link', submissionId: sub.id, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
        };
        ['company', 'role', 'imageUrl'].forEach((k) => { if (sub[k]) t[k] = sub[k]; });
        batch.set(tRef, t);
      }
    } else {
      const existing = await getDoc(tRef);
      if (existing.exists()) batch.update(tRef, { published: false, updatedAt: serverTimestamp() });
    }
    batch.update(doc(db, 'reviewSubmissions', sub.id), { status: show ? 'published' : 'hidden', updatedAt: serverTimestamp() });
    await batch.commit();
  }

  async function toggleShown(sub, show, input) {
    if (input) input.disabled = true;
    try {
      await setShown(sub, show);
      toast(show ? 'Review is now shown on the website' : 'Review hidden from the website');
      return true;
    } catch (err) {
      toast(friendlyError(err), 'error');
      if (input) input.checked = !show;
      return false;
    } finally { if (input) input.disabled = false; }
  }

  async function removeSub(sub) {
    const ok = await confirmDialog({
      title: 'Delete this review?',
      text: 'The review will be permanently deleted and removed from the website if it is shown there. This cannot be undone.',
    });
    if (!ok) return false;
    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, 'reviewSubmissions', sub.id));
      batch.delete(doc(db, 'testimonials', `rev_${sub.id}`));
      await batch.commit();
      toast('Review deleted');
      return true;
    } catch (err) { toast(friendlyError(err), 'error'); return false; }
  }

  function openSub(sub) {
    const m = openModal({
      title: `Review from ${sub.name || 'client'}`,
      size: 'lg',
      body: `
        <div class="review-detail">
          <span class="review-item__avatar review-item__avatar--lg">${sub.imageUrl ? `<img src="${esc(assetUrl(sub.imageUrl, 200))}" alt="">` : esc((sub.name || '?')[0].toUpperCase())}</span>
          <div>${stars(sub.rating)}<div class="message-box" style="margin-top:8px">${esc(sub.quote || '')}</div></div>
        </div>
        <dl class="detail-grid">
          <dt>Name</dt><dd>${esc(sub.name || '—')}</dd>
          <dt>Company</dt><dd>${esc(sub.company || '—')}</dd>
          <dt>Job title</dt><dd>${esc(sub.role || '—')}</dd>
          <dt>Email</dt><dd>${sub.email ? `<a href="mailto:${esc(sub.email)}">${esc(sub.email)}</a> <span class="cell-muted">(private)</span>` : '—'}</dd>
          <dt>Received</dt><dd>${esc(formatDate(sub.date))}</dd>
          <dt>Link</dt><dd>${esc(sub.linkName || 'Review link')}</dd>
          <dt>Consent</dt><dd>${sub.consent ? `${icon('check', 'icon--sm')} Agreed to be shown on the website` : '—'}</dd>
        </dl>
        <p class="cell-muted" style="margin:0">Need to fix a typo or shorten it? Show it first, then edit it under <a href="#/testimonials" data-close>Testimonials</a>.</p>`,
      footer: `
        <button class="btn btn--secondary" style="color:#dc2626" data-del>${icon('trash')} Delete</button>
        <span class="spacer"></span>
        ${sub.status === 'published'
          ? `<button class="btn btn--secondary" data-hide>${icon('eye-off')} Hide from website</button>`
          : `${sub.status === 'new' ? `<button class="btn btn--secondary" data-hide>${icon('eye-off')} Don't show</button>` : ''}
             <button class="btn btn--success" data-show-btn>${icon('eye')} Show on website</button>`}`,
    });
    $('[data-del]', m.el).addEventListener('click', async () => { if (await removeSub(sub)) m.close(); });
    $('[data-hide]', m.el)?.addEventListener('click', async (e) => {
      setBusy(e.currentTarget, true, 'Saving…');
      if (await toggleShown(sub, false)) m.close(); else setBusy(e.currentTarget, false);
    });
    $('[data-show-btn]', m.el)?.addEventListener('click', async (e) => {
      setBusy(e.currentTarget, true, 'Publishing…');
      if (await toggleShown(sub, true)) m.close(); else setBusy(e.currentTarget, false);
    });
  }

  /* ----- Links ----- */
  function renderLinks() {
    if (!state.links) return;
    const rows = state.links.map((l) => ({ ...l, responses: responsesFor(l.id) })).map((l) => ({ ...l, st: linkStatus(l, l.responses) }));
    const count = (k) => rows.filter((r) => r.st.key === k).length;
    renderFilters([['all', 'All', rows.length], ['active', 'Active', count('active')], ['used', 'Used', count('used')], ['expired', 'Expired', count('expired')], ['disabled', 'Disabled', count('disabled')]]);
    const list = rows.filter((r) => state.filter === 'all' || r.st.key === state.filter);
    if (!list.length) {
      listEl.innerHTML = `<div class="empty">${icon('external')}<h3>${rows.length ? 'No links match' : 'No review links yet'}</h3><p>${rows.length ? 'Try another filter.' : 'Create a link, send it to a client by WhatsApp or email, and their review will arrive in Submissions.'}</p>
        ${rows.length ? '' : `<button class="btn" data-create style="margin-top:14px">${icon('plus')} Create review link</button>`}</div>`;
      return;
    }
    listEl.innerHTML = `
      <div class="table-wrap"><table class="table">
        <thead><tr><th>For</th><th class="hide-sm">Created</th><th>Expires</th><th class="hide-sm">Responses</th><th>Status</th><th style="text-align:right">Actions</th></tr></thead>
        <tbody>${list.map((l) => `
          <tr data-link="${esc(l.id)}">
            <td><div>${esc(l.clientName || 'Any client')}</div><div class="cell-muted">${l.singleUse ? 'One response' : 'Multiple responses'}</div></td>
            <td class="hide-sm cell-muted">${esc(formatDate(l.created, false))}</td>
            <td><div title="${esc(formatDate(l.expires))}">${esc(formatDate(l.expires))}</div><div class="cell-muted">${esc(untilText(l.expires))}</div></td>
            <td class="hide-sm">${l.responses}</td>
            <td><span class="badge ${l.st.cls}">${l.st.label}</span></td>
            <td><div class="row-actions">
              <button class="icon-btn" data-act="copy" title="Copy link" aria-label="Copy link">${icon('copy')}</button>
              <a class="icon-btn" data-act="wa" title="Send on WhatsApp" aria-label="Send on WhatsApp" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(shareText(l))}">${icon('whatsapp')}</a>
              <button class="icon-btn" data-act="edit" title="Change expiry / settings" aria-label="Edit link">${icon('pencil')}</button>
              <button class="icon-btn icon-btn--danger" data-act="delete" title="Delete link" aria-label="Delete link">${icon('trash')}</button>
            </div></td>
          </tr>`).join('')}
        </tbody></table></div>`;
  }

  function shareModal(link) {
    const url = reviewUrl(link.id);
    const subject = encodeURIComponent('Could you share a quick review? — FMZ Fire & Safety');
    const m = openModal({
      title: 'Review link ready',
      body: `
        <p style="margin-top:0">Send this private link to ${link.clientName ? `<strong>${esc(link.clientName)}</strong>` : 'your client'}. It works until <strong>${esc(formatDate(link.expires))}</strong>${link.singleUse ? ' and accepts one review' : ''}.</p>
        <div class="share-link"><input class="input" readonly value="${esc(url)}" data-url aria-label="Review link"><button class="btn" data-copy-url>${icon('copy')} Copy</button></div>
        <div class="contact-actions" style="margin-top:14px">
          <a class="btn btn--success" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(shareText(link))}">${icon('whatsapp')} Send on WhatsApp</a>
          <a class="btn btn--secondary" href="mailto:?subject=${subject}&body=${encodeURIComponent(shareText(link))}">${icon('mail')} Send by email</a>
          <button class="btn btn--secondary" data-copy-msg>${icon('copy')} Copy message</button>
          <a class="btn btn--secondary" target="_blank" rel="noopener" href="${esc(url)}">${icon('external')} Open page</a>
        </div>`,
      footer: '<span class="spacer"></span><button class="btn" data-close>Done</button>',
    });
    $('[data-url]', m.el).addEventListener('focus', (e) => e.target.select());
    $('[data-copy-url]', m.el).addEventListener('click', () => copy(url));
    $('[data-copy-msg]', m.el).addEventListener('click', () => copy(shareText(link), 'Message'));
  }

  function linkForm(link) {
    const isNew = !link;
    const exp = expiryControl('rl-exp', isNew ? null : link.expires);
    const m = openModal({
      title: isNew ? 'Create review link' : 'Edit review link',
      body: `
        <div class="form-grid">
          <div class="field full"><label for="rl-name">Client or company name <span class="cell-muted">(optional)</span></label>
            <input class="input" id="rl-name" maxlength="100" value="${esc(link?.clientName || '')}" placeholder="e.g. Mr. Ahmed or Indus Motor Company">
            <div class="field__help">Shown as a greeting on the review page and pre-filled in the form.</div></div>
          <div class="field full"><label for="rl-msg">Personal message <span class="cell-muted">(optional)</span></label>
            <textarea class="textarea" id="rl-msg" rows="3" maxlength="400" placeholder="e.g. Thank you for attending our fire safety training on 20 November. We'd love to hear how it went.">${esc(link?.message || '')}</textarea></div>
          ${exp.html}
          <div class="field full"><label>Responses</label>
            <div class="choice-row">
              <label class="choice"><input type="radio" name="rl-use" value="single" ${link?.singleUse === false ? '' : 'checked'}><span><strong>One review</strong><small>Best for one person. The link closes after it is used.</small></span></label>
              <label class="choice"><input type="radio" name="rl-use" value="multi" ${link?.singleUse === false ? 'checked' : ''}><span><strong>Multiple reviews</strong><small>Share with a whole team or training batch until it expires.</small></span></label>
            </div></div>
          ${isNew ? '' : `<div class="field full"><label class="switch"><input type="checkbox" id="rl-active" ${link.active !== false ? 'checked' : ''}><span class="switch__track"></span>Link is active (turn off to close it now)</label></div>`}
        </div>`,
      footer: `<span class="spacer"></span><button class="btn btn--secondary" data-close>Cancel</button><button class="btn" data-save>${icon(isNew ? 'plus' : 'check')} ${isNew ? 'Create link' : 'Save'}</button>`,
    });
    exp.bind(m.el);
    $('[data-save]', m.el).addEventListener('click', async (e) => {
      const expiresAt = exp.read(m.el);
      if (!expiresAt || expiresAt.getTime() <= Date.now() + 60000) { toast('Please choose an expiry time in the future', 'error'); return; }
      const values = {
        clientName: $('#rl-name', m.el).value.trim(),
        message: $('#rl-msg', m.el).value.trim(),
        expiresAt,
        singleUse: $('input[name="rl-use"]:checked', m.el).value === 'single',
        active: isNew ? true : $('#rl-active', m.el).checked,
      };
      const btn = e.currentTarget;
      setBusy(btn, true);
      m.lock(true);
      try {
        if (isNew) {
          const id = newToken();
          await setDoc(doc(db, 'reviewLinks', id), { ...values, createdAt: serverTimestamp() });
          m.lock(false); m.close();
          shareModal({ id, ...values, expires: expiresAt });
        } else {
          await updateDoc(doc(db, 'reviewLinks', link.id), { ...values, updatedAt: serverTimestamp() });
          m.lock(false); m.close();
          toast('Link updated');
        }
      } catch (err) {
        m.lock(false);
        setBusy(btn, false);
        toast(friendlyError(err), 'error');
      }
    });
  }

  async function removeLink(link) {
    const ok = await confirmDialog({
      title: 'Delete this review link?',
      text: 'The link will stop working immediately. Reviews already received through it are kept.',
    });
    if (!ok) return;
    try { await deleteDoc(doc(db, 'reviewLinks', link.id)); toast('Link deleted'); } catch (err) { toast(friendlyError(err), 'error'); }
  }

  /* ----- Live data ----- */
  const linkName = (id) => state.links?.find((l) => l.id === id)?.clientName || '';
  const stopLinks = onSnapshot(collection(db, 'reviewLinks'), (snap) => {
    state.links = snap.docs.map((d) => {
      const data = d.data();
      return { id: d.id, ...data, expires: toDate(data.expiresAt), created: toDate(data.createdAt) };
    }).sort((a, b) => (b.created?.getTime() || Date.now()) - (a.created?.getTime() || Date.now()));
    state.subs?.forEach((s) => { s.linkName = linkName(s.linkId); });
    render();
  }, (err) => { listEl.innerHTML = `<div class="empty">${icon('alert')}<h3>Could not load review links</h3><p>${esc(friendlyError(err))}</p></div>`; });

  const stopSubs = onSnapshot(collection(db, 'reviewSubmissions'), (snap) => {
    state.subs = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id, ...data,
        status: SUB_STATUSES[data.status] ? data.status : 'new',
        rating: Math.max(1, Math.min(5, Number(data.rating) || 5)),
        date: toDate(data.createdAt),
        linkName: linkName(data.linkId),
      };
    }).sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0));
    render();
  }, (err) => { listEl.innerHTML = `<div class="empty">${icon('alert')}<h3>Could not load reviews</h3><p>${esc(friendlyError(err))}</p></div>`; });

  // Keep "in 3 hrs" / "Expired" labels fresh.
  const tick = setInterval(() => { if (state.tab === 'links') renderLinks(); }, 60000);

  /* ----- Events ----- */
  container.addEventListener('click', async (e) => {
    const t = e.target;
    if (t.closest('[data-create]')) { linkForm(null); return; }
    const tab = t.closest('[data-tab]');
    if (tab) { state.tab = tab.dataset.tab; state.filter = 'all'; render(); return; }
    const f = t.closest('[data-filter]');
    if (f) { state.filter = f.dataset.filter; render(); return; }

    const row = t.closest('[data-link]');
    if (row) {
      const link = state.links.find((l) => l.id === row.dataset.link);
      const act = t.closest('[data-act]')?.dataset.act;
      if (!link || !act) return;
      if (act === 'copy') copy(reviewUrl(link.id));
      if (act === 'edit') linkForm(link);
      if (act === 'delete') removeLink(link);
      return;
    }

    if (t.closest('.switch')) return; // handled by change listener
    const item = t.closest('[data-sub]');
    if (item) { const sub = state.subs.find((s) => s.id === item.dataset.sub); if (sub) openSub(sub); }
  });
  container.addEventListener('change', (e) => {
    const input = e.target.closest('[data-show]');
    if (!input) return;
    const sub = state.subs.find((s) => s.id === input.dataset.show);
    if (sub) toggleShown(sub, input.checked, input);
  });
  container.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || !e.target.matches('[data-sub]')) return;
    const sub = state.subs.find((s) => s.id === e.target.dataset.sub);
    if (sub) openSub(sub);
  });

  return () => { stopLinks(); stopSubs(); clearInterval(tick); };
}
