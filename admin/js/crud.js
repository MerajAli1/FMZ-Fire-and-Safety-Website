/**
 * Generic content manager: live list, search, filters, bulk actions,
 * add/edit forms and image uploads for any schema in schemas.js.
 */
import {
  db, auth, collection, doc, addDoc, updateDoc, onSnapshot, serverTimestamp, writeBatch, getDoc, toDate,
} from './firebase.js';
import {
  esc, icon, $, $$, assetUrl, toast, openModal, confirmDialog, setBusy, friendlyError, debounce, formatDate,
} from './ui.js';
import {
  buildForm, categoryControl, categoryOptions, bindCategoryControls, readCategory,
} from './form.js';
import { processAndUpload } from './upload.js';
import { SCHEMAS } from './schemas.js';
import { categoryLabel } from '../../js/lib/dom.js';
import { BUILTIN_CLIENTS, DEFAULT_TRAININGS } from '../../js/data/defaults.js';

const sortItems = (items) => [...items].sort((a, b) => {
  const oa = Number.isFinite(a.order) ? a.order : Infinity;
  const ob = Number.isFinite(b.order) ? b.order : Infinity;
  if (oa !== ob) return oa - ob;
  return (toDate(b.createdAt)?.getTime() || 0) - (toDate(a.createdAt)?.getTime() || 0);
});

const stamp = () => ({ updatedAt: serverTimestamp(), updatedBy: auth.currentUser?.email || '' });

export function renderCollection(container, key) {
  const schema = SCHEMAS[key];
  const state = { items: [], loaded: false, search: '', cat: 'all', status: 'all', selected: new Set(), settings: {} };
  const colRef = collection(db, schema.collection);

  container.innerHTML = `
    <div class="page-head">
      <div>
        <h1>${esc(schema.title)}</h1>
        <p>${esc(schema.description)}</p>
      </div>
      <div class="page-head__actions">
        <a class="btn btn--secondary" href="${schema.publicPage}" target="_blank" rel="noopener">${icon('external')} View on site</a>
        ${schema.bulkUpload ? `<button class="btn btn--secondary" data-action="bulk-upload">${icon('upload')} Upload photos</button>` : ''}
        <button class="btn" data-action="add">${icon('plus')} Add ${esc(schema.singular)}</button>
      </div>
    </div>
    <div data-notice></div>
    <div class="toolbar">
      <label class="search-input"><span class="sr-only">Search</span>${icon('search')}<input class="input" type="search" placeholder="Search ${esc(schema.title.toLowerCase())}…" data-search></label>
      ${schema.filterField ? `<select class="select" style="width:auto" data-cat aria-label="Filter by category"></select>
        <button class="btn btn--secondary" data-action="rename-category" hidden title="Rename this category, or merge it into another one">${icon('pencil', 'icon--sm')} Rename / merge</button>` : ''}
      <div class="tabs" role="tablist" data-status>
        <button class="tab is-active" data-v="all">All <span class="count" data-count="all"></span></button>
        <button class="tab" data-v="published">Visible <span class="count" data-count="published"></span></button>
        <button class="tab" data-v="hidden">Hidden <span class="count" data-count="hidden"></span></button>
      </div>
      <span class="toolbar__grow"></span>
      <label class="check" style="font-size:.85rem"><input type="checkbox" data-select-all> Select all</label>
    </div>
    <div class="bulkbar" data-bulk hidden>
      <strong data-bulk-count></strong>
      <button class="btn btn--sm btn--secondary" data-bulk-action="publish">${icon('eye', 'icon--sm')} Show</button>
      <button class="btn btn--sm btn--secondary" data-bulk-action="hide">${icon('eye-off', 'icon--sm')} Hide</button>
      <button class="btn btn--sm btn--danger" data-bulk-action="delete">${icon('trash', 'icon--sm')} Delete</button>
      <button class="btn btn--sm btn--ghost" style="color:#fff" data-bulk-action="clear">Clear</button>
    </div>
    <div data-list><div class="loading-block"><div class="boot__spinner"></div></div></div>`;

  const listEl = $('[data-list]', container);
  const catEl = $('[data-cat]', container);

  /* ---------- Rendering ---------- */
  function filtered() {
    const q = state.search.toLowerCase();
    return state.items.filter((it) => {
      if (state.status === 'published' && it.published === false) return false;
      if (state.status === 'hidden' && it.published !== false) return false;
      if (state.cat !== 'all' && (it[schema.filterField] || '') !== state.cat) return false;
      if (q && !schema.searchFields.some((f) => String(it[f] || '').toLowerCase().includes(q))) return false;
      return true;
    });
  }

  function mediaHtml(it) {
    if (schema.imageField) {
      const url = it[schema.imageField];
      return `<div class="item__media ${schema.layout === 'logo' ? 'item__media--contain' : ''}">
        ${url ? `<img src="${esc(assetUrl(url, 500))}" alt="" loading="lazy">` : icon('image')}`;
    }
    if (schema.layout === 'quote') {
      return `<div class="item__media" style="aspect-ratio:auto;min-height:120px;padding:16px 16px 8px;place-items:start;text-align:left;font-size:.86rem;color:var(--text)">
        <span>“${esc(String(it.quote || '').slice(0, 160))}${String(it.quote || '').length > 160 ? '…' : ''}”</span>`;
    }
    return `<div class="item__media" style="aspect-ratio:auto;height:110px;color:var(--brand)">${icon(schema.itemIcon(it), 'icon--lg')}`;
  }

  function itemHtml(it) {
    const hidden = it.published === false;
    const sub = schema.subtitle?.(it);
    const title = it[schema.titleField] || (schema.layout === 'gallery' ? 'Untitled photo' : '(untitled)');
    return `
      <article class="item ${hidden ? 'is-hidden' : ''} ${state.selected.has(it.id) ? 'is-selected' : ''}" data-id="${esc(it.id)}">
        ${mediaHtml(it)}
          <input type="checkbox" class="item__select" data-select aria-label="Select ${esc(title)}" ${state.selected.has(it.id) ? 'checked' : ''}>
          <div class="item__badges">
            ${hidden ? '<span class="badge badge--hidden">Hidden</span>' : ''}
            ${schema.featured && it.featured ? `<span class="badge badge--featured">${icon('star-fill', 'icon--sm')} Featured</span>` : ''}
          </div>
        </div>
        <div class="item__body">
          <p class="item__title" title="${esc(title)}">${esc(title)}</p>
          <p class="item__sub">${esc(schema.filterField && sub === it[schema.filterField] ? categoryLabel(sub) : sub || '')}${Number.isFinite(it.order) ? ` · #${it.order}` : ''}</p>
        </div>
        <div class="item__actions">
          <button class="icon-btn" data-action="edit" title="Edit" aria-label="Edit">${icon('pencil')}</button>
          <button class="icon-btn" data-action="toggle-visible" title="${hidden ? 'Show on website' : 'Hide from website'}" aria-label="${hidden ? 'Show' : 'Hide'}">${icon(hidden ? 'eye-off' : 'eye')}</button>
          ${schema.featured ? `<button class="icon-btn ${it.featured ? 'is-on' : ''}" data-action="toggle-featured" title="${it.featured ? 'Remove from homepage' : 'Feature on homepage'}" aria-label="Toggle featured">${icon('star')}</button>` : ''}
          <span class="spacer"></span>
          <button class="icon-btn icon-btn--danger" data-action="delete" title="Delete" aria-label="Delete">${icon('trash')}</button>
        </div>
      </article>`;
  }

  function render() {
    const list = filtered();
    const counts = {
      all: state.items.length,
      published: state.items.filter((i) => i.published !== false).length,
      hidden: state.items.filter((i) => i.published === false).length,
    };
    Object.entries(counts).forEach(([k, n]) => { $(`[data-count="${k}"]`, container).textContent = n; });

    if (catEl) {
      const cats = [...new Set(state.items.map((i) => i[schema.filterField]).filter(Boolean))]
        .sort((a, b) => categoryLabel(a).localeCompare(categoryLabel(b)));
      const current = state.cat;
      if (current !== 'all' && !cats.includes(current)) state.cat = 'all';
      catEl.innerHTML = `<option value="all">All categories</option>${cats.map((c) => `<option value="${esc(c)}" ${c === state.cat ? 'selected' : ''}>${esc(categoryLabel(c))} (${state.items.filter((i) => i[schema.filterField] === c).length})</option>`).join('')}`;
      $('[data-action="rename-category"]', container).hidden = state.cat === 'all';
    }

    if (!state.items.length) {
      listEl.innerHTML = `<div class="card empty">${icon(schema.navIcon)}<h3>No ${esc(schema.title.toLowerCase())} yet</h3><p>Click “Add ${esc(schema.singular)}” to create the first one.</p></div>`;
    } else if (!list.length) {
      listEl.innerHTML = `<div class="card empty">${icon('search')}<h3>Nothing matches your filters</h3></div>`;
    } else {
      listEl.innerHTML = `<div class="item-grid ${schema.layout === 'gallery' ? 'item-grid--gallery' : ''}">${list.map(itemHtml).join('')}</div>`;
    }
    renderBulk();
    renderNotice();
  }

  function renderBulk() {
    const ids = [...state.selected].filter((id) => state.items.some((i) => i.id === id));
    state.selected = new Set(ids);
    $('[data-bulk]', container).hidden = ids.length === 0;
    $('[data-bulk-count]', container).textContent = `${ids.length} selected`;
    const all = $('[data-select-all]', container);
    const visible = filtered();
    all.checked = visible.length > 0 && visible.every((i) => state.selected.has(i.id));
  }

  function renderNotice() {
    const box = $('[data-notice]', container);
    let html = '';
    if (key === 'clients' && !state.settings.clientsSeeded) {
      html = `The website also shows <strong>${BUILTIN_CLIENTS.length} built-in client logos</strong> (Indus Motor, Meezan Bank, Nestlé…). Import them to edit, hide or reorder them here.
        <button class="btn btn--sm" data-action="import-clients">${icon('download', 'icon--sm')} Import built-in clients</button>`;
    } else if (key === 'trainings' && state.loaded && !state.items.length) {
      html = `The Training page currently shows <strong>${DEFAULT_TRAININGS.length} default programs</strong>. Import them to start editing, or add your own (the defaults disappear once you add any).
        <button class="btn btn--sm" data-action="import-trainings">${icon('download', 'icon--sm')} Import default programs</button>`;
    } else if (key === 'slides' && state.loaded && !state.items.length) {
      html = 'The homepage is showing the 3 built-in hero slides. As soon as you add a slide here, your slides replace them.';
    }
    box.innerHTML = html ? `<div class="alert alert--info" style="align-items:center;flex-wrap:wrap">${icon('info')}<span style="flex:1;min-width:240px">${html}</span></div>` : '';
  }

  /* ---------- Data ---------- */
  const unsubscribe = onSnapshot(colRef, (snap) => {
    state.items = sortItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    state.loaded = true;
    render();
  }, (err) => {
    listEl.innerHTML = `<div class="card empty">${icon('alert')}<h3>Could not load ${esc(schema.title.toLowerCase())}</h3><p>${esc(friendlyError(err))}</p></div>`;
  });

  if (key === 'clients') {
    getDoc(doc(db, 'settings', 'site')).then((s) => { state.settings = s.data() || {}; render(); }).catch(() => {});
  }

  /* ---------- Categories ---------- */
  const catFields = schema.fields.filter((f) => f.type === 'category');
  const usedCategories = (name) => [...new Set(state.items.map((i) => i[name]).filter(Boolean))];

  function renameCategory() {
    const from = state.cat;
    const field = schema.filterField;
    const count = state.items.filter((i) => i[field] === from).length;
    const def = catFields.find((f) => f.name === field);
    const options = categoryOptions(def?.suggestions, usedCategories(field)).filter((c) => c !== from);
    const body = document.createElement('div');
    body.innerHTML = `
      <p>Move all <strong>${count}</strong> item${count === 1 ? '' : 's'} in <strong>${esc(categoryLabel(from))}</strong> to:</p>
      <div class="field">${categoryControl({ id: 'rename-cat', name: 'to', options })}</div>
      <p class="field__help" style="margin-top:12px">Choose an existing category to merge duplicates (e.g. “Personal Safety” into “Personal Protection”), or add a new name to rename it.</p>`;
    bindCategoryControls(body);
    const m = openModal({
      title: 'Rename or merge category',
      body,
      footer: `<button type="button" class="btn btn--secondary" data-close>Cancel</button>
               <button type="button" class="btn" data-ok>${icon('check')} Apply</button>`,
    });
    $('[data-ok]', m.el).addEventListener('click', async (e) => {
      const to = readCategory($('#rename-cat', body));
      if (!to) return toast('Please choose or enter a category', 'error');
      if (to === from) return m.close();
      const btn = e.currentTarget;
      setBusy(btn, true);
      try {
        const ids = state.items.filter((i) => i[field] === from).map((i) => i.id);
        for (let n = 0; n < ids.length; n += 400) {
          const batch = writeBatch(db);
          ids.slice(n, n + 400).forEach((id) => batch.update(doc(db, schema.collection, id), { [field]: to, ...stamp() }));
          await batch.commit();
        }
        state.cat = to;
        toast(`Moved ${ids.length} item${ids.length === 1 ? '' : 's'} to “${categoryLabel(to)}”`);
        m.close();
      } catch (err) {
        toast(friendlyError(err), 'error', 7000);
        setBusy(btn, false);
      }
    });
  }

  /* ---------- Actions ---------- */
  function openEditor(item = null) {
    const isNew = !item;
    const categories = Object.fromEntries(catFields.map((cf) => [cf.name, usedCategories(cf.name)]));
    const f = buildForm(schema.fields, item || {}, { categories });
    const m = openModal({
      title: isNew ? `Add ${schema.singular}` : `Edit ${schema.singular}`,
      size: 'lg',
      body: f.form,
      footer: `
        ${!isNew ? `<span class="cell-muted">Last updated ${esc(formatDate(toDate(item.updatedAt || item.createdAt)))}</span>` : ''}
        <span class="spacer"></span>
        <button type="button" class="btn btn--secondary" data-close>Cancel</button>
        <button type="button" class="btn" data-save>${icon('check')} ${isNew ? 'Save' : 'Save changes'}</button>`,
    });
    const saveBtn = $('[data-save]', m.el);
    f.onUploadChange(() => { saveBtn.disabled = f.isUploading(); m.lock(f.isUploading()); });
    f.form.addEventListener('submit', (e) => { e.preventDefault(); saveBtn.click(); });

    saveBtn.addEventListener('click', async () => {
      if (f.isUploading()) return toast('Please wait for the image upload to finish', 'info');
      if (!f.validate()) return;
      const values = f.getValues();
      setBusy(saveBtn, true);
      m.lock(true);
      try {
        if (isNew) await addDoc(colRef, { ...values, createdAt: serverTimestamp(), ...stamp() });
        else await updateDoc(doc(db, schema.collection, item.id), { ...values, ...stamp() });
        toast(isNew ? `${capital(schema.singular)} added` : 'Changes saved');
        m.lock(false);
        m.close();
      } catch (err) {
        toast(friendlyError(err), 'error', 7000);
        setBusy(saveBtn, false);
        m.lock(false);
      }
    });
  }

  async function update(id, data, msg) {
    try {
      await updateDoc(doc(db, schema.collection, id), { ...data, ...stamp() });
      if (msg) toast(msg);
    } catch (err) { toast(friendlyError(err), 'error'); }
  }

  async function remove(ids) {
    const n = ids.length;
    const ok = await confirmDialog({
      title: n > 1 ? `Delete ${n} ${schema.title.toLowerCase()}?` : `Delete this ${schema.singular}?`,
      text: 'This permanently removes it from the website and cannot be undone.',
    });
    if (!ok) return;
    try {
      for (let i = 0; i < ids.length; i += 400) {
        const batch = writeBatch(db);
        ids.slice(i, i + 400).forEach((id) => batch.delete(doc(db, schema.collection, id)));
        await batch.commit();
      }
      ids.forEach((id) => state.selected.delete(id));
      toast(n > 1 ? `${n} items deleted` : 'Deleted');
    } catch (err) { toast(friendlyError(err), 'error'); }
  }

  async function bulkSet(data, msg) {
    const ids = [...state.selected];
    try {
      const batch = writeBatch(db);
      ids.forEach((id) => batch.update(doc(db, schema.collection, id), { ...data, ...stamp() }));
      await batch.commit();
      toast(msg.replace('{n}', ids.length));
    } catch (err) { toast(friendlyError(err), 'error'); }
  }

  async function importClients(btn) {
    const existing = new Set(state.items.map((c) => String(c.name || '').trim().toLowerCase()));
    const toAdd = BUILTIN_CLIENTS.filter((c) => !existing.has(c.name.toLowerCase()));
    setBusy(btn, true, 'Importing…');
    try {
      const batch = writeBatch(db);
      toAdd.forEach(({ id, ...c }) => batch.set(doc(colRef), {
        ...c, featured: Boolean(c.featured), published: true, createdAt: serverTimestamp(), ...stamp(),
      }));
      batch.set(doc(db, 'settings', 'site'), { clientsSeeded: true, ...stamp() }, { merge: true });
      await batch.commit();
      state.settings.clientsSeeded = true;
      toast(`Imported ${toAdd.length} clients`);
      render();
    } catch (err) {
      toast(friendlyError(err), 'error', 7000);
      setBusy(btn, false);
    }
  }

  async function importTrainings(btn) {
    setBusy(btn, true, 'Importing…');
    try {
      const batch = writeBatch(db);
      DEFAULT_TRAININGS.forEach(({ id, ...t }) => batch.set(doc(colRef), { ...t, published: true, createdAt: serverTimestamp(), ...stamp() }));
      await batch.commit();
      toast(`Imported ${DEFAULT_TRAININGS.length} programs`);
    } catch (err) {
      toast(friendlyError(err), 'error', 7000);
      setBusy(btn, false);
    }
  }

  function openBulkUpload() {
    const catField = schema.fields.find((f) => f.name === 'category');
    const body = document.createElement('div');
    body.innerHTML = `
      <div class="form-grid" style="margin-bottom:14px">
        <div class="field"><label for="bu-cat">Album / category</label>
          ${categoryControl({ id: 'bu-cat', name: 'category', options: categoryOptions(catField?.suggestions, usedCategories('category')) })}</div>
        <div class="field"><label for="bu-cap">Caption (optional, applied to all)</label><input class="input" id="bu-cap" maxlength="160"></div>
      </div>
      <div class="dropzone">
        <input type="file" accept="image/*" multiple aria-label="Choose photos">
        <div class="dropzone__icon">${icon('upload')}</div>
        <div class="dropzone__text">Drop photos here or click to select several</div>
        <div class="dropzone__hint">Photos are resized and compressed automatically before upload.</div>
      </div>
      <div class="upload-list"></div>`;
    const m = openModal({
      title: 'Upload photos',
      size: 'lg',
      body,
      footer: '<button type="button" class="btn btn--secondary" data-close>Done</button>',
    });
    bindCategoryControls(body);
    const listBox = $('.upload-list', body);
    const drop = $('.dropzone', body);
    const input = $('input[type=file]', drop);
    let running = 0;

    async function run(files) {
      const images = Array.from(files).filter((f) => f.type.startsWith('image/'));
      if (!images.length) return;
      const category = readCategory($('#bu-cat', body));
      const caption = $('#bu-cap', body).value.trim();
      running += images.length;
      m.lock(true);
      for (const file of images) {
        const row = document.createElement('div');
        row.className = 'upload-row';
        const thumb = URL.createObjectURL(file);
        row.innerHTML = `<img src="${thumb}" alt=""><div><div class="upload-row__name">${esc(file.name)}</div><div class="progress"><div class="progress__bar"></div></div></div><span data-state class="cell-muted">Waiting…</span>`;
        listBox.prepend(row);
        const bar = $('.progress__bar', row);
        const st = $('[data-state]', row);
        try {
          st.textContent = 'Uploading…';
          const url = await processAndUpload(file, { maxWidth: 2000 }, (p) => { bar.style.width = `${p * 100}%`; });
          await addDoc(colRef, { imageUrl: url, caption, category, published: true, createdAt: serverTimestamp(), ...stamp() });
          bar.style.width = '100%';
          st.innerHTML = icon('check-circle');
        } catch (err) {
          st.innerHTML = `<span style="color:#dc2626">${esc(friendlyError(err))}</span>`;
        } finally {
          URL.revokeObjectURL(thumb);
          running -= 1;
          if (!running) { m.lock(false); toast('Upload complete'); }
        }
      }
    }
    input.addEventListener('change', () => { run(input.files); input.value = ''; });
    ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('is-over'); }));
    ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, () => drop.classList.remove('is-over')));
    drop.addEventListener('drop', (e) => { e.preventDefault(); run(e.dataTransfer.files); });
  }

  /* ---------- Events ---------- */
  const onClick = (e) => {
    const btn = e.target.closest('[data-action], [data-bulk-action], [data-select]');
    if (!btn || !container.contains(btn)) return;
    const card = btn.closest('[data-id]');
    const item = card && state.items.find((i) => i.id === card.dataset.id);

    if (btn.matches('[data-select]')) {
      if (btn.checked) state.selected.add(item.id); else state.selected.delete(item.id);
      card.classList.toggle('is-selected', btn.checked);
      renderBulk();
      return;
    }
    if (btn.dataset.bulkAction) {
      const action = btn.dataset.bulkAction;
      if (action === 'delete') remove([...state.selected]);
      else if (action === 'publish') bulkSet({ published: true }, '{n} items are now visible');
      else if (action === 'hide') bulkSet({ published: false }, '{n} items hidden');
      else { state.selected.clear(); render(); }
      return;
    }
    switch (btn.dataset.action) {
      case 'add': openEditor(); break;
      case 'bulk-upload': openBulkUpload(); break;
      case 'edit': openEditor(item); break;
      case 'toggle-visible': update(item.id, { published: item.published === false }, item.published === false ? 'Now visible on the website' : 'Hidden from the website'); break;
      case 'toggle-featured': update(item.id, { featured: !item.featured }, item.featured ? 'Removed from homepage' : 'Featured on homepage'); break;
      case 'delete': remove([item.id]); break;
      case 'import-clients': importClients(btn); break;
      case 'import-trainings': importTrainings(btn); break;
      case 'rename-category': renameCategory(); break;
      default: break;
    }
  };
  container.addEventListener('click', onClick);
  container.addEventListener('dblclick', (e) => {
    const card = e.target.closest('.item[data-id]');
    if (card && !e.target.closest('button, input')) openEditor(state.items.find((i) => i.id === card.dataset.id));
  });
  $('[data-search]', container).addEventListener('input', debounce((e) => { state.search = e.target.value.trim(); render(); }, 150));
  catEl?.addEventListener('change', () => { state.cat = catEl.value; render(); });
  $('[data-status]', container).addEventListener('click', (e) => {
    const tab = e.target.closest('.tab');
    if (!tab) return;
    $$('.tab', e.currentTarget).forEach((t) => t.classList.toggle('is-active', t === tab));
    state.status = tab.dataset.v;
    render();
  });
  $('[data-select-all]', container).addEventListener('change', (e) => {
    filtered().forEach((i) => { if (e.target.checked) state.selected.add(i.id); else state.selected.delete(i.id); });
    render();
  });

  return () => unsubscribe();
}

const capital = (s) => s.charAt(0).toUpperCase() + s.slice(1);
