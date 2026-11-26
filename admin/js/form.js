/** Schema-driven form builder used by the content manager. */
import { esc, icon, assetUrl, toast } from './ui.js';
import { processAndUpload } from './upload.js';
import { editImage, isEditable, fileFromUrl } from './image-editor.js';
import { categoryLabel, slugify } from '../../js/lib/dom.js';
import { renderMarkdown, markdownToText, readingMinutes } from '../../js/lib/markdown.js';
import { SITE_URL } from '../../js/config.js';

let uid = 0;

function fieldId(name) { uid += 1; return `f-${name}-${uid}`; }

/* ---------- Category picker: dropdown of existing categories + "add new" ---------- */
const NEW_CATEGORY = '__new__';

/** Merge predefined suggestions with categories already in use, de-duplicated and sorted by label. */
export function categoryOptions(suggestions = [], existing = [], current = '') {
  const all = [...suggestions, ...existing, current].map((c) => slugify(c)).filter(Boolean);
  return [...new Set(all)].sort((a, b) => categoryLabel(a).localeCompare(categoryLabel(b)));
}

export function categoryControl({ id, name, options, value = '' }) {
  const v = slugify(value);
  return `
    <select class="select" id="${id}" name="${name}" data-category>
      <option value="">Select a category…</option>
      ${options.map((c) => `<option value="${esc(c)}" ${c === v ? 'selected' : ''}>${esc(categoryLabel(c))}</option>`).join('')}
      <option value="${NEW_CATEGORY}">＋ Add new category…</option>
    </select>
    <input class="input" data-category-new maxlength="40" placeholder="New category name, e.g. Fire Alarms" hidden style="margin-top:8px" aria-label="New category name">
    <div class="field__help" data-category-hint hidden></div>`;
}

/** Wire up every category picker inside root. */
export function bindCategoryControls(root) {
  root.querySelectorAll('select[data-category]').forEach((select) => {
    const box = select.parentElement;
    const input = box.querySelector('[data-category-new]');
    const hint = box.querySelector('[data-category-hint]');
    select.addEventListener('change', () => {
      const isNew = select.value === NEW_CATEGORY;
      input.hidden = !isNew;
      hint.hidden = true;
      if (isNew) input.focus();
    });
    // If the "new" name matches an existing category, select that one instead of creating a duplicate.
    input.addEventListener('input', () => {
      const slug = slugify(input.value);
      const match = [...select.options].find((o) => o.value !== NEW_CATEGORY && o.value
        && (o.value === slug || o.textContent.trim().toLowerCase() === input.value.trim().toLowerCase()));
      hint.hidden = !match;
      if (match) hint.textContent = `“${match.textContent.trim()}” already exists — it will be used instead of creating a duplicate.`;
    });
  });
}

/** Read the chosen category slug from a picker's <select>. */
export function readCategory(select) {
  if (!select) return '';
  if (select.value !== NEW_CATEGORY) return select.value;
  return slugify(select.parentElement.querySelector('[data-category-new]').value);
}

function renderField(f, value, ctx = {}) {
  const id = fieldId(f.name);
  const req = f.required ? ' <span class="req">*</span>' : '';
  const help = f.help ? `<div class="field__help">${esc(f.help)}</div>` : '';
  const wrap = (inner, label = true) => `
    <div class="field ${f.full ? 'full' : ''}" data-field="${f.name}">
      ${label ? `<label for="${id}">${esc(f.label)}${req}</label>` : ''}
      ${inner}${help}<div class="field__error" hidden></div>
    </div>`;
  const v = value ?? f.default ?? '';

  switch (f.type) {
    case 'textarea':
      return wrap(`<textarea class="textarea" id="${id}" name="${f.name}" rows="${f.rows || 3}" ${f.max ? `maxlength="${f.max}"` : ''} placeholder="${esc(f.placeholder || '')}">${esc(v)}</textarea>`);
    case 'list':
      return wrap(`<textarea class="textarea" id="${id}" name="${f.name}" rows="${f.rows || 4}" placeholder="${esc(f.placeholder || '')}">${esc(Array.isArray(v) ? v.join('\n') : v)}</textarea>`);
    case 'number':
      return wrap(`<input class="input" type="number" id="${id}" name="${f.name}" value="${esc(v)}" step="1">`);
    case 'url':
      return wrap(`<input class="input" type="url" id="${id}" name="${f.name}" value="${esc(v)}" placeholder="https://">`);
    case 'category':
      return wrap(categoryControl({
        id, name: f.name, value: v,
        options: categoryOptions(f.suggestions, ctx.categories?.[f.name], v),
      }));
    case 'select':
      return wrap(`<select class="select" id="${id}" name="${f.name}">${f.options.map(([val, label]) => `<option value="${esc(val)}" ${String(v) === String(val) ? 'selected' : ''}>${esc(label)}</option>`).join('')}</select>`);
    case 'toggle': {
      const checked = value === undefined ? f.default === true : value !== false;
      return `<div class="field" data-field="${f.name}"><label class="switch"><input type="checkbox" name="${f.name}" ${checked ? 'checked' : ''}><span class="switch__track"></span>${esc(f.label)}</label>${help}</div>`;
    }
    case 'icon':
      return wrap(`<div class="icon-picker" role="radiogroup" aria-label="${esc(f.label)}">${f.options.map((name) => `
        <label title="${esc(name)}"><input type="radio" name="${f.name}" value="${name}" ${v === name ? 'checked' : ''}><span>${icon(name, 'icon--lg')}</span></label>`).join('')}</div>`, true);
    case 'image':
      return wrap(`
        <div class="image-field" data-image-field="${f.name}">
          <input type="hidden" name="${f.name}" value="${esc(v)}">
          <div class="image-preview" ${v ? '' : 'hidden'}>
            <img alt="Preview" src="${esc(assetUrl(v, 900))}">
            <div class="image-preview__actions">
              <button type="button" class="icon-btn" data-edit-image title="Crop, rotate or adjust" aria-label="Edit image">${icon('crop')}</button>
              <button type="button" class="icon-btn icon-btn--danger" data-remove-image title="Remove image" aria-label="Remove image">${icon('trash')}</button>
            </div>
          </div>
          <div class="dropzone" ${v ? 'hidden' : ''}>
            <input type="file" accept="image/*" aria-label="Choose image">
            <div class="dropzone__icon">${icon('upload')}</div>
            <div class="dropzone__text">Drop an image here or click to browse</div>
            <div class="dropzone__hint">${esc(f.hint || 'JPG, PNG or WebP. Large photos are resized automatically.')}</div>
          </div>
          <div class="progress" hidden><div class="progress__bar"></div></div>
          <div><button type="button" class="link-btn" data-url-toggle>…or paste an image URL</button></div>
          <input class="input" type="url" data-url-input placeholder="https://res.cloudinary.com/…" hidden>
        </div>`);
    case 'date': {
      const d = value || (f.default === 'today' ? new Date().toISOString().slice(0, 10) : '');
      return wrap(`<input class="input" type="date" id="${id}" name="${f.name}" value="${esc(d)}">`);
    }
    case 'slug':
      return wrap(`<div class="slug-field"><span class="slug-field__prefix">${esc(f.prefix || '')}</span>
        <input class="input" id="${id}" name="${f.name}" value="${esc(v)}" data-slug-from="${f.from || ''}" ${v ? '' : 'data-auto="1"'} maxlength="90" placeholder="auto-generated-from-title"></div>`);
    case 'markdown':
      return wrap(`
        <div class="md-editor" data-md>
          <div class="md-toolbar" role="toolbar" aria-label="Formatting">
            <button type="button" data-md-cmd="h2" title="Heading">H2</button>
            <button type="button" data-md-cmd="h3" title="Sub-heading">H3</button>
            <button type="button" data-md-cmd="bold" title="Bold"><strong>B</strong></button>
            <button type="button" data-md-cmd="italic" title="Italic"><em>I</em></button>
            <button type="button" data-md-cmd="link" title="Link">${icon('external', 'icon--sm')} Link</button>
            <button type="button" data-md-cmd="ul" title="Bullet list">• List</button>
            <button type="button" data-md-cmd="ol" title="Numbered list">1. List</button>
            <button type="button" data-md-cmd="quote" title="Quote">“ Quote</button>
            <label class="md-toolbar__upload" title="Upload an image into the article">${icon('image', 'icon--sm')} Image<input type="file" accept="image/*" data-md-image hidden></label>
            <span class="md-toolbar__spacer"></span>
            <button type="button" data-md-tab="write" class="is-active">Write</button>
            <button type="button" data-md-tab="preview">Preview</button>
          </div>
          <textarea class="textarea md-input" id="${id}" name="${f.name}" rows="${f.rows || 16}" placeholder="${esc(f.placeholder || '')}">${esc(v)}</textarea>
          <div class="md-preview prose" hidden></div>
          <div class="md-status"><span data-md-count></span><span data-md-upload></span></div>
        </div>`);
    case 'seopreview':
      return `<div class="field full" data-field="${f.name}"><div class="label">${esc(f.label)}</div>
        <div class="serp" data-serp><div class="serp__url"></div><div class="serp__title"></div><div class="serp__desc"></div></div>
        <div class="field__help">Roughly how this article can appear in Google search results.</div></div>`;
    default:
      return wrap(`<input class="input" id="${id}" name="${f.name}" value="${esc(v)}" ${f.max ? `maxlength="${f.max}"` : ''} placeholder="${esc(f.placeholder || '')}">${f.counter ? `<div class="field__help" data-counter="${f.counter}"></div>` : ''}`);
  }
}

/* ---------- Markdown editor ---------- */
function setupMarkdown(box, state) {
  const ta = box.querySelector('textarea');
  const preview = box.querySelector('.md-preview');
  const count = box.querySelector('[data-md-count]');
  const uploadNote = box.querySelector('[data-md-upload]');
  const updateCount = () => {
    const words = markdownToText(ta.value).split(' ').filter(Boolean).length;
    count.textContent = `${words} words · ${readingMinutes(ta.value)} min read${words && words < 300 ? ' · tip: 600+ words usually rank better' : ''}`;
  };
  const changed = () => ta.dispatchEvent(new Event('input', { bubbles: true }));
  const wrapSel = (before, after = before, placeholder = 'text') => {
    const { selectionStart: a, selectionEnd: b, value } = ta;
    const sel = value.slice(a, b) || placeholder;
    ta.setRangeText(before + sel + after, a, b, 'end');
    ta.focus();
    ta.selectionStart = a + before.length;
    ta.selectionEnd = a + before.length + sel.length;
  };
  const prefixLines = (prefix) => {
    const { selectionStart: a, selectionEnd: b, value } = ta;
    const start = value.lastIndexOf('\n', a - 1) + 1;
    const block = value.slice(start, b) || 'Text';
    const lines = block.split('\n').map((l, n) => (typeof prefix === 'function' ? prefix(n) : prefix) + l.replace(/^(#{1,4}\s|[-*]\s|\d+\.\s|>\s?)/, ''));
    ta.setRangeText(lines.join('\n'), start, b, 'end');
    ta.focus();
  };
  const insertBlock = (text) => {
    const { selectionStart: a, value } = ta;
    const pre = a > 0 && value[a - 1] !== '\n' ? '\n\n' : '';
    ta.setRangeText(`${pre}${text}\n`, a, ta.selectionEnd, 'end');
    ta.focus();
    changed();
  };

  box.addEventListener('click', (e) => {
    const cmd = e.target.closest('[data-md-cmd]')?.dataset.mdCmd;
    const tab = e.target.closest('[data-md-tab]')?.dataset.mdTab;
    if (cmd) {
      if (cmd === 'bold') wrapSel('**');
      else if (cmd === 'italic') wrapSel('*');
      else if (cmd === 'h2') prefixLines('## ');
      else if (cmd === 'h3') prefixLines('### ');
      else if (cmd === 'ul') prefixLines('- ');
      else if (cmd === 'ol') prefixLines((n) => `${n + 1}. `);
      else if (cmd === 'quote') prefixLines('> ');
      else if (cmd === 'link') {
        const href = prompt('Link address (e.g. https://… or contact.html):', 'https://');
        if (href) wrapSel('[', `](${href.trim()})`, 'link text');
      }
      changed();
    }
    if (tab) {
      box.querySelectorAll('[data-md-tab]').forEach((b) => b.classList.toggle('is-active', b.dataset.mdTab === tab));
      const showPreview = tab === 'preview';
      if (showPreview) {
        preview.innerHTML = renderMarkdown(ta.value) || '<p style="color:var(--muted)">Nothing to preview yet.</p>';
        preview.querySelectorAll('img').forEach((img) => {
          const src = img.getAttribute('src');
          if (!/^https?:/.test(src)) img.src = assetUrl(src);
        });
      }
      preview.hidden = !showPreview;
      ta.hidden = showPreview;
    }
  });

  box.querySelector('[data-md-image]').addEventListener('change', async (e) => {
    const picked = e.target.files[0];
    e.target.value = '';
    if (!picked) return;
    const file = isEditable(picked) ? await editImage(picked, { title: 'Edit article image' }) : picked;
    if (!file) return;
    const suggested = file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ');
    const alt = (prompt('Short description of the image (helps Google and visually impaired readers):', suggested) || '').replace(/[[\]]/g, '');
    state.uploading += 1;
    state.onChange?.();
    uploadNote.textContent = ' · Uploading image…';
    try {
      const url = await processAndUpload(file, { maxWidth: 1600 }, (p) => { uploadNote.textContent = ` · Uploading image… ${Math.round(p * 100)}%`; });
      insertBlock(`![${alt}](${url})`);
      uploadNote.textContent = ' · Image inserted';
    } catch (err) {
      toast(err.message, 'error', 6000);
      uploadNote.textContent = '';
    } finally {
      state.uploading -= 1;
      state.onChange?.();
    }
  });
  ta.addEventListener('input', updateCount);
  updateCount();
}

/* ---------- Slug, character counters, search preview ---------- */
function setupExtras(form) {
  form.querySelectorAll('[data-slug-from]').forEach((input) => {
    const source = form.elements[input.dataset.slugFrom];
    if (!source) return;
    source.addEventListener('input', () => { if (input.dataset.auto) input.value = slugify(source.value).slice(0, 80); });
    input.addEventListener('input', () => { delete input.dataset.auto; });
    input.addEventListener('blur', () => { input.value = slugify(input.value); });
  });
  form.querySelectorAll('[data-counter]').forEach((help) => {
    const input = help.parentElement.querySelector('input');
    const max = Number(help.dataset.counter);
    const update = () => {
      const n = input.value.trim().length;
      help.textContent = `${n} / ${max} characters${n > max ? ' — may be cut off in Google' : ''}`;
      help.style.color = n > max ? '#b45309' : '';
    };
    input.addEventListener('input', update);
    update();
  });
  const serp = form.querySelector('[data-serp]');
  if (serp) {
    const val = (name) => form.elements[name]?.value?.trim() || '';
    const update = () => {
      const title = val('metaTitle') || val('title') || 'Article title';
      const desc = val('metaDescription') || val('excerpt') || markdownToText(val('content')).slice(0, 160)
        || 'Add a short summary so people know what the article is about.';
      serp.querySelector('.serp__url').textContent = `${SITE_URL.replace('https://', '')} › article › ${slugify(val('slug') || val('title')) || '…'}`;
      serp.querySelector('.serp__title').textContent = `${title} | FMZ Fire & Safety`.slice(0, 70);
      serp.querySelector('.serp__desc').textContent = desc.length > 160 ? `${desc.slice(0, 157)}…` : desc;
    };
    form.addEventListener('input', update);
    update();
  }
}

function setupImageField(root, f, state) {
  const hidden = root.querySelector(`input[name="${f.name}"]`);
  const preview = root.querySelector('.image-preview');
  const previewImg = preview.querySelector('img');
  const drop = root.querySelector('.dropzone');
  const fileInput = drop.querySelector('input[type=file]');
  const progress = root.querySelector('.progress');
  const bar = progress.querySelector('.progress__bar');
  const urlInput = root.querySelector('[data-url-input]');

  const setValue = (url) => {
    hidden.value = url;
    previewImg.src = assetUrl(url, 900);
    preview.hidden = !url;
    drop.hidden = Boolean(url);
  };

  async function handle(picked, { existing = false } = {}) {
    if (!picked) return;
    // Let the admin crop / rotate / adjust before uploading
    const file = isEditable(picked) ? await editImage(picked, { aspect: f.aspect, title: `Edit ${f.label.toLowerCase()}` }) : picked;
    fileInput.value = '';
    if (!file || (existing && file === picked)) return; // cancelled, or "use original" on an uploaded image
    const localUrl = URL.createObjectURL(file);
    previewImg.src = localUrl;
    preview.hidden = false;
    drop.hidden = true;
    progress.hidden = false;
    bar.style.width = '4%';
    state.uploading += 1;
    state.onChange?.();
    try {
      const url = await processAndUpload(file, { maxWidth: f.maxWidth || 1600 }, (p) => { bar.style.width = `${Math.max(4, p * 100)}%`; });
      setValue(url);
      toast('Image uploaded');
    } catch (err) {
      toast(err.message, 'error', 6000);
      setValue(hidden.value);
    } finally {
      URL.revokeObjectURL(localUrl);
      progress.hidden = true;
      state.uploading -= 1;
      state.onChange?.();
    }
  }

  fileInput.addEventListener('change', () => handle(fileInput.files[0]));
  ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('is-over'); }));
  ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, () => drop.classList.remove('is-over')));
  drop.addEventListener('drop', (e) => { e.preventDefault(); handle(e.dataTransfer.files[0]); });
  root.querySelector('[data-edit-image]').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const current = hidden.value;
    if (!current) return;
    btn.disabled = true;
    try {
      const file = await fileFromUrl(assetUrl(current), f.name);
      if (!isEditable(file)) { toast('This image type (SVG/GIF) cannot be edited here.', 'info'); return; }
      await handle(file, { existing: true });
    } catch (err) {
      toast(`${err.message} Download the image and upload it again to edit it.`, 'error', 7000);
    } finally {
      btn.disabled = false;
    }
  });
  root.querySelector('[data-remove-image]').addEventListener('click', () => { setValue(''); fileInput.value = ''; });
  root.querySelector('[data-url-toggle]').addEventListener('click', () => { urlInput.hidden = !urlInput.hidden; if (!urlInput.hidden) urlInput.focus(); });
  urlInput.addEventListener('change', () => {
    const u = urlInput.value.trim();
    if (/^https:\/\//i.test(u)) setValue(u); else if (u) toast('Please paste a full https:// image URL', 'error');
  });
  // Paste an image from the clipboard
  root.closest('form').addEventListener('paste', (e) => {
    const file = Array.from(e.clipboardData?.files || []).find((x) => x.type.startsWith('image/'));
    if (file && !drop.hidden) { e.preventDefault(); handle(file); }
  });
}

/**
 * Build a form for `fields` filled with `values`.
 * `ctx.categories` maps a category field name to the categories already in use.
 * Returns { form, getValues, validate, isUploading, onUploadChange }.
 */
export function buildForm(fields, values = {}, ctx = {}) {
  const form = document.createElement('form');
  form.className = 'form-grid';
  form.noValidate = true;
  form.innerHTML = fields.map((f) => renderField(f, values[f.name], ctx)).join('');
  bindCategoryControls(form);
  const state = { uploading: 0, onChange: null };
  form.querySelectorAll('[data-md]').forEach((box) => setupMarkdown(box, state));
  setupExtras(form);

  fields.filter((f) => f.type === 'image').forEach((f) => {
    setupImageField(form.querySelector(`[data-image-field="${f.name}"]`), f, state);
  });

  function getValues() {
    const out = {};
    fields.forEach((f) => {
      const el = form.elements[f.name];
      if (f.type === 'seopreview') return;
      if (f.type === 'toggle') out[f.name] = el.checked;
      else if (f.type === 'slug') out[f.name] = slugify(el.value);
      else if (f.type === 'markdown') out[f.name] = el.value.replace(/\s+$/, '');
      else if (f.type === 'icon') out[f.name] = form.querySelector(`input[name="${f.name}"]:checked`)?.value || f.default || '';
      else if (f.type === 'number') out[f.name] = el.value === '' ? null : Number(el.value);
      else if (f.type === 'list') out[f.name] = el.value.split('\n').map((s) => s.trim()).filter(Boolean);
      else if (f.type === 'category') out[f.name] = readCategory(el);
      else if (f.type === 'select' && f.number) out[f.name] = Number(el.value);
      else out[f.name] = el.value.trim();
    });
    return out;
  }

  function validate() {
    const vals = getValues();
    let firstBad = null;
    fields.forEach((f) => {
      const box = form.querySelector(`[data-field="${f.name}"]`);
      const errEl = box?.querySelector('.field__error');
      let msg = '';
      const v = vals[f.name];
      if (f.required && (v === '' || v === null || (Array.isArray(v) && !v.length))) msg = f.type === 'image' ? 'Please upload an image.' : 'This field is required.';
      else if (f.type === 'url' && v && !/^https?:\/\//i.test(v)) msg = 'Please enter a full URL starting with https://';
      box?.classList.toggle('has-error', Boolean(msg));
      if (errEl) { errEl.hidden = !msg; errEl.textContent = msg; }
      if (msg && !firstBad) firstBad = box;
    });
    firstBad?.querySelector('input:not([type=hidden]), textarea, select')?.focus();
    return !firstBad;
  }

  return {
    form,
    getValues,
    validate,
    isUploading: () => state.uploading > 0,
    onUploadChange(fn) { state.onChange = fn; },
  };
}
