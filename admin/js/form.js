/** Schema-driven form builder used by the content manager. */
import { esc, icon, assetUrl, toast } from './ui.js';
import { processAndUpload } from './upload.js';
import { categoryLabel } from '../../js/lib/dom.js';

let uid = 0;

function fieldId(name) { uid += 1; return `f-${name}-${uid}`; }

function renderField(f, value) {
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
      return wrap(`<input class="input" id="${id}" name="${f.name}" value="${esc(v)}" list="${id}-list" autocomplete="off" placeholder="${esc(f.placeholder || 'Choose or type a category')}">
        <datalist id="${id}-list">${(f.suggestions || []).map((s) => `<option value="${esc(s)}">${esc(categoryLabel(s))}</option>`).join('')}</datalist>`);
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
            <button type="button" class="icon-btn icon-btn--danger image-preview__remove" data-remove-image aria-label="Remove image">${icon('trash')}</button>
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
    default:
      return wrap(`<input class="input" id="${id}" name="${f.name}" value="${esc(v)}" ${f.max ? `maxlength="${f.max}"` : ''} placeholder="${esc(f.placeholder || '')}">`);
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

  async function handle(file) {
    if (!file) return;
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
 * Returns { form, getValues, validate, isUploading, onUploadChange }.
 */
export function buildForm(fields, values = {}) {
  const form = document.createElement('form');
  form.className = 'form-grid';
  form.noValidate = true;
  form.innerHTML = fields.map((f) => renderField(f, values[f.name])).join('');
  const state = { uploading: 0, onChange: null };

  fields.filter((f) => f.type === 'image').forEach((f) => {
    setupImageField(form.querySelector(`[data-image-field="${f.name}"]`), f, state);
  });

  function getValues() {
    const out = {};
    fields.forEach((f) => {
      const el = form.elements[f.name];
      if (f.type === 'toggle') out[f.name] = el.checked;
      else if (f.type === 'icon') out[f.name] = form.querySelector(`input[name="${f.name}"]:checked`)?.value || f.default || '';
      else if (f.type === 'number') out[f.name] = el.value === '' ? null : Number(el.value);
      else if (f.type === 'list') out[f.name] = el.value.split('\n').map((s) => s.trim()).filter(Boolean);
      else if (f.type === 'category') out[f.name] = el.value.trim().toLowerCase().replace(/\s+/g, '-');
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
