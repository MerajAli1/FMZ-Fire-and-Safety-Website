/** Contact-form inbox: live list, status workflow, notes, reply shortcuts, CSV export. */
import {
  db, auth, collection, doc, updateDoc, onSnapshot, writeBatch, serverTimestamp, toDate,
} from './firebase.js';
import {
  esc, icon, $, $$, toast, openModal, confirmDialog, setBusy, friendlyError, debounce, formatDate, timeAgo, downloadCsv,
} from './ui.js';

export const STATUSES = {
  new: { label: 'New', cls: 'badge--new' },
  'in-progress': { label: 'In progress', cls: 'badge--progress' },
  resolved: { label: 'Resolved', cls: 'badge--resolved' },
};

/** Map legacy status values from the old dashboard. */
export function normStatus(s) {
  if (s === 'pending' || s === 'email_sent') return 'in-progress';
  if (s === 'completed') return 'resolved';
  return STATUSES[s] ? s : 'new';
}

export const inquiryDate = (it) => toDate(it.createdAt) || toDate(it.timestamp);

export function normaliseInquiries(snap) {
  return snap.docs
    .map((d) => { const data = d.data(); return { id: d.id, ...data, status: normStatus(data.status), date: inquiryDate(data) }; })
    .sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0));
}

const PAGE = 60;

export function renderInquiries(container) {
  const state = { items: [], status: 'all', search: '', selected: new Set(), limit: PAGE };

  container.innerHTML = `
    <div class="page-head">
      <div><h1>Inquiries</h1><p>Messages submitted through the website contact form. New messages appear here instantly.</p></div>
      <div class="page-head__actions"><button class="btn btn--secondary" data-export>${icon('download')} Export CSV</button></div>
    </div>
    <div class="toolbar">
      <div class="tabs" data-tabs>
        <button class="tab is-active" data-v="all">All <span class="count" data-c="all"></span></button>
        ${Object.entries(STATUSES).map(([k, s]) => `<button class="tab" data-v="${k}">${s.label} <span class="count" data-c="${k}"></span></button>`).join('')}
      </div>
      <span class="toolbar__grow"></span>
      <label class="search-input"><span class="sr-only">Search inquiries</span>${icon('search')}<input class="input" type="search" placeholder="Search name, email, subject…" data-search></label>
    </div>
    <div class="bulkbar" data-bulk hidden>
      <strong data-bulk-count></strong>
      <button class="btn btn--sm btn--secondary" data-bulk-status="in-progress">Mark in progress</button>
      <button class="btn btn--sm btn--secondary" data-bulk-status="resolved">${icon('check', 'icon--sm')} Mark resolved</button>
      <button class="btn btn--sm btn--danger" data-bulk-delete>${icon('trash', 'icon--sm')} Delete</button>
    </div>
    <div class="card"><div data-list><div class="loading-block"><div class="boot__spinner"></div></div></div></div>`;

  const listEl = $('[data-list]', container);

  function filtered() {
    const q = state.search.toLowerCase();
    return state.items.filter((it) => (state.status === 'all' || it.status === state.status)
      && (!q || [it.name, it.email, it.phone, it.subject, it.message].some((v) => String(v || '').toLowerCase().includes(q))));
  }

  function render() {
    $('[data-c="all"]', container).textContent = state.items.length;
    Object.keys(STATUSES).forEach((k) => { $(`[data-c="${k}"]`, container).textContent = state.items.filter((i) => i.status === k).length; });
    const list = filtered();
    if (!list.length) {
      listEl.innerHTML = `<div class="empty">${icon('inbox')}<h3>${state.items.length ? 'No inquiries match' : 'No inquiries yet'}</h3><p>${state.items.length ? 'Try another filter or search.' : 'Messages from the contact form will show up here.'}</p></div>`;
      renderBulk();
      return;
    }
    const shown = list.slice(0, state.limit);
    listEl.innerHTML = `
      <div class="table-wrap"><table class="table">
        <thead><tr>
          <th style="width:36px"><input type="checkbox" data-select-all aria-label="Select all"></th>
          <th>From</th><th class="hide-sm">Subject</th><th class="hide-sm hide-md">Phone</th><th>Received</th><th>Status</th>
        </tr></thead>
        <tbody>${shown.map((it) => `
          <tr data-id="${esc(it.id)}" class="${it.status === 'new' ? 'is-unread' : ''}">
            <td><input type="checkbox" data-select aria-label="Select" ${state.selected.has(it.id) ? 'checked' : ''}></td>
            <td><div class="cell-name">${it.status === 'new' ? '<span class="dot" title="New"></span>' : ''}<div><div>${esc(it.name || '—')}</div><div class="cell-muted">${esc(it.email || '')}</div></div></div></td>
            <td class="hide-sm"><div class="cell-truncate">${esc(it.subject || '(no subject)')}</div><div class="cell-muted cell-truncate">${esc(String(it.message || '').slice(0, 90))}</div></td>
            <td class="hide-sm hide-md cell-muted">${esc(it.phone || '—')}</td>
            <td class="cell-muted" title="${esc(formatDate(it.date))}">${esc(timeAgo(it.date))}</td>
            <td><span class="badge ${STATUSES[it.status].cls}">${STATUSES[it.status].label}</span></td>
          </tr>`).join('')}
        </tbody>
      </table></div>
      ${list.length > shown.length ? `<div style="padding:14px;text-align:center"><button class="btn btn--secondary" data-more>Show more (${list.length - shown.length} remaining)</button></div>` : ''}`;
    renderBulk();
  }

  function renderBulk() {
    state.selected = new Set([...state.selected].filter((id) => state.items.some((i) => i.id === id)));
    $('[data-bulk]', container).hidden = !state.selected.size;
    $('[data-bulk-count]', container).textContent = `${state.selected.size} selected`;
    const all = $('[data-select-all]', container);
    if (all) { const vis = filtered().slice(0, state.limit); all.checked = vis.length > 0 && vis.every((i) => state.selected.has(i.id)); }
  }

  const unsubscribe = onSnapshot(collection(db, 'contacts'), (snap) => {
    state.items = normaliseInquiries(snap);
    render();
    // Deep-link: #/inquiries/<id>
    const deep = location.hash.split('/')[2];
    if (deep && !container.dataset.opened) {
      container.dataset.opened = '1';
      const it = state.items.find((i) => i.id === deep);
      if (it) openDetail(it);
    }
  }, (err) => {
    listEl.innerHTML = `<div class="empty">${icon('alert')}<h3>Could not load inquiries</h3><p>${esc(friendlyError(err))}</p></div>`;
  });

  async function setStatus(ids, status) {
    try {
      const batch = writeBatch(db);
      ids.forEach((id) => batch.update(doc(db, 'contacts', id), { status, updatedAt: serverTimestamp(), updatedBy: auth.currentUser?.email || '' }));
      await batch.commit();
      return true;
    } catch (err) { toast(friendlyError(err), 'error'); return false; }
  }

  async function remove(ids) {
    const ok = await confirmDialog({
      title: ids.length > 1 ? `Delete ${ids.length} inquiries?` : 'Delete this inquiry?',
      text: 'The message will be permanently deleted. This cannot be undone.',
    });
    if (!ok) return false;
    try {
      const batch = writeBatch(db);
      ids.forEach((id) => batch.delete(doc(db, 'contacts', id)));
      await batch.commit();
      ids.forEach((id) => state.selected.delete(id));
      toast(ids.length > 1 ? `${ids.length} inquiries deleted` : 'Inquiry deleted');
      return true;
    } catch (err) { toast(friendlyError(err), 'error'); return false; }
  }

  function openDetail(it) {
    if (it.status === 'new') setStatus([it.id], 'in-progress');
    const phoneDigits = String(it.phone || '').replace(/\D/g, '').replace(/^0/, '92');
    const replySubject = encodeURIComponent(`Re: ${it.subject || 'Your inquiry'} — FMZ Fire & Safety`);
    const replyBody = encodeURIComponent(`Dear ${it.name || ''},\n\nThank you for contacting FMZ Fire & Safety Engineering.\n\n\n\n----- Original message -----\n${it.message || ''}`);
    const m = openModal({
      title: it.subject || 'Inquiry',
      size: 'lg',
      body: `
        <div class="contact-actions">
          ${it.email ? `<a class="btn" href="mailto:${esc(it.email)}?subject=${replySubject}&body=${replyBody}">${icon('reply')} Reply by email</a>` : ''}
          ${phoneDigits ? `<a class="btn btn--success" target="_blank" rel="noopener" href="https://wa.me/${esc(phoneDigits)}">${icon('whatsapp')} WhatsApp</a>
          <a class="btn btn--secondary" href="tel:${esc(it.phone)}">${icon('phone')} Call</a>` : ''}
          <button class="btn btn--secondary" data-copy>${icon('copy')} Copy email</button>
        </div>
        <dl class="detail-grid">
          <dt>Name</dt><dd>${esc(it.name || '—')}</dd>
          <dt>Email</dt><dd>${esc(it.email || '—')}</dd>
          <dt>Phone</dt><dd>${esc(it.phone || '—')}</dd>
          <dt>Received</dt><dd>${esc(formatDate(it.date))} (${esc(timeAgo(it.date))})</dd>
        </dl>
        <div class="label">Message</div>
        <div class="message-box">${esc(it.message || '')}</div>
        <div class="form-grid">
          <div class="field"><label for="inq-status">Status</label>
            <select class="select" id="inq-status">${Object.entries(STATUSES).map(([k, s]) => `<option value="${k}" ${k === (it.status === 'new' ? 'in-progress' : it.status) ? 'selected' : ''}>${s.label}</option>`).join('')}</select></div>
          <div class="field full"><label for="inq-notes">Internal notes <span class="cell-muted">(only visible to admins)</span></label>
            <textarea class="textarea" id="inq-notes" rows="3" placeholder="e.g. Sent quotation on 12 Mar, follow up next week">${esc(it.notes || '')}</textarea></div>
        </div>`,
      footer: `
        <button class="btn btn--secondary" style="color:#dc2626" data-del>${icon('trash')} Delete</button>
        <span class="spacer"></span>
        <button class="btn btn--secondary" data-close>Close</button>
        <button class="btn" data-save>${icon('check')} Save</button>`,
    });
    $('[data-copy]', m.el).addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(it.email || ''); toast('Email copied'); } catch { toast('Could not copy', 'error'); }
    });
    $('[data-del]', m.el).addEventListener('click', async () => { if (await remove([it.id])) m.close(); });
    $('[data-save]', m.el).addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      setBusy(btn, true);
      try {
        await updateDoc(doc(db, 'contacts', it.id), {
          status: $('#inq-status', m.el).value,
          notes: $('#inq-notes', m.el).value.trim(),
          updatedAt: serverTimestamp(),
          updatedBy: auth.currentUser?.email || '',
        });
        toast('Inquiry updated');
        m.close();
      } catch (err) { toast(friendlyError(err), 'error'); setBusy(btn, false); }
    });
  }

  /* Events */
  container.addEventListener('click', async (e) => {
    const t = e.target;
    if (t.closest('[data-more]')) { state.limit += PAGE; render(); return; }
    if (t.closest('[data-export]')) {
      const rows = [['Date', 'Name', 'Email', 'Phone', 'Subject', 'Message', 'Status', 'Notes']];
      filtered().forEach((i) => rows.push([formatDate(i.date), i.name, i.email, i.phone, i.subject, i.message, STATUSES[i.status].label, i.notes || '']));
      downloadCsv(`fmz-inquiries-${new Date().toISOString().slice(0, 10)}.csv`, rows);
      return;
    }
    const bulkStatus = t.closest('[data-bulk-status]');
    if (bulkStatus) {
      if (await setStatus([...state.selected], bulkStatus.dataset.bulkStatus)) { toast('Status updated'); state.selected.clear(); render(); }
      return;
    }
    if (t.closest('[data-bulk-delete]')) { await remove([...state.selected]); render(); return; }
    if (t.matches('[data-select-all]')) {
      filtered().slice(0, state.limit).forEach((i) => { if (t.checked) state.selected.add(i.id); else state.selected.delete(i.id); });
      render();
      return;
    }
    const row = t.closest('tr[data-id]');
    if (!row) return;
    if (t.matches('[data-select]')) {
      if (t.checked) state.selected.add(row.dataset.id); else state.selected.delete(row.dataset.id);
      renderBulk();
      return;
    }
    if (t.closest('td:first-child')) return;
    const it = state.items.find((i) => i.id === row.dataset.id);
    if (it) openDetail(it);
  });
  $('[data-tabs]', container).addEventListener('click', (e) => {
    const tab = e.target.closest('.tab');
    if (!tab) return;
    $$('.tab', e.currentTarget).forEach((x) => x.classList.toggle('is-active', x === tab));
    state.status = tab.dataset.v;
    state.limit = PAGE;
    render();
  });
  $('[data-search]', container).addEventListener('input', debounce((e) => { state.search = e.target.value.trim(); state.limit = PAGE; render(); }, 150));

  return () => unsubscribe();
}
