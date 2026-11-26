/**
 * Image editor shown before an upload: crop (free or fixed ratios), rotate,
 * straighten, flip, zoom, and brightness / contrast / saturation / warmth.
 *
 * Cropping uses Cropper.js, loaded from cdnjs only the first time the editor opens.
 * editImage(file, { aspect }) resolves with the edited File, the original File
 * ("Use original"), or null when the editor is cancelled.
 */
import { esc, icon, $, $$, openModal, toast } from './ui.js';

const CROPPER = {
  js: 'https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.6.2/cropper.min.js',
  jsSri: 'sha384-jrOgQzBlDeUNdmQn3rUt/PZD+pdcRBdWd/HWRqRo+n2OR2QtGyjSaJC0GiCeH+ir',
  css: 'https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.6.2/cropper.min.css',
  cssSri: 'sha384-6LFfkTKLRlzFtgx8xsWyBdKGpcMMQTkv+dB7rAbugeJAu1Ym2q1Aji1cjHBG12Xh',
};

const RATIOS = [
  ['free', 'Free'],
  ['original', 'Original'],
  ['16:9', '16:9'],
  ['4:3', '4:3'],
  ['1:1', 'Square'],
  ['3:4', '3:4'],
];

const ADJUSTMENTS = [
  { key: 'brightness', label: 'Brightness' },
  { key: 'contrast', label: 'Contrast' },
  { key: 'saturation', label: 'Saturation' },
  { key: 'warmth', label: 'Warmth' },
];

const MAX_OUTPUT = 4096;

let loading = null;
function loadCropper() {
  if (window.Cropper) return Promise.resolve();
  loading ||= new Promise((resolve, reject) => {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = CROPPER.css;
    css.integrity = CROPPER.cssSri;
    css.crossOrigin = 'anonymous';
    document.head.appendChild(css);
    const js = document.createElement('script');
    js.src = CROPPER.js;
    js.integrity = CROPPER.jsSri;
    js.crossOrigin = 'anonymous';
    js.onload = () => resolve();
    js.onerror = () => { loading = null; js.remove(); reject(new Error('Could not load the image editor. Check your internet connection.')); };
    document.head.appendChild(js);
  });
  return loading;
}

/** SVG and animated GIF files are uploaded as they are. */
export const isEditable = (file) => Boolean(file?.type?.startsWith('image/')) && !/svg|gif/.test(file.type);

/** Download an already-uploaded image so it can be edited again. */
export async function fileFromUrl(url, name = 'image') {
  const res = await fetch(url, { mode: 'cors' });
  if (!res.ok) throw new Error(`Could not open the image (${res.status}).`);
  const blob = await res.blob();
  // Some servers send images as application/octet-stream — fall back to the file extension.
  const fromExt = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', avif: 'image/avif', gif: 'image/gif', svg: 'image/svg+xml' }[
    (new URL(url, location.href).pathname.split('.').pop() || '').toLowerCase()];
  const type = blob.type.startsWith('image/') ? blob.type : fromExt;
  if (!type) throw new Error('That address is not an image.');
  const ext = type.split('/')[1].replace('jpeg', 'jpg').replace('svg+xml', 'svg');
  return new File([blob], `${name}.${ext}`, { type });
}

/* ---------- Colour adjustments ---------- */
const isNeutral = (a) => ADJUSTMENTS.every(({ key }) => !a[key]);

/** CSS/canvas filter string for the live preview and export (values are -100…100). */
function filterString(a) {
  const parts = [
    `brightness(${1 + a.brightness / 100})`,
    `contrast(${1 + a.contrast / 100})`,
    `saturate(${1 + a.saturation / 100})`,
  ];
  if (a.warmth > 0) parts.push(`sepia(${(a.warmth / 100) * 0.35})`);
  if (a.warmth < 0) parts.push(`hue-rotate(${a.warmth * 0.25}deg)`);
  return parts.join(' ');
}

/** Pixel-level fallback for browsers without canvas filters (older Safari). */
function applyPixels(ctx, w, h, a) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const b = 1 + a.brightness / 100;
  const c = 1 + a.contrast / 100;
  const s = 1 + a.saturation / 100;
  const warm = a.warmth / 100;
  for (let i = 0; i < d.length; i += 4) {
    let r = d[i] * b; let g = d[i + 1] * b; let bl = d[i + 2] * b;
    r = (r - 128) * c + 128; g = (g - 128) * c + 128; bl = (bl - 128) * c + 128;
    const grey = 0.2126 * r + 0.7152 * g + 0.0722 * bl;
    r = grey + (r - grey) * s; g = grey + (g - grey) * s; bl = grey + (bl - grey) * s;
    r += warm * 22; bl -= warm * 22;
    d[i] = r; d[i + 1] = g; d[i + 2] = bl; // Uint8ClampedArray clamps for us
  }
  ctx.putImageData(img, 0, 0);
}

const canvasToBlob = (canvas, type, q) => new Promise((resolve) => canvas.toBlob(resolve, type, q));

/* ---------- Editor ---------- */
export async function editImage(file, { aspect = 'free', title = 'Edit image' } = {}) {
  if (!isEditable(file)) return file;
  try {
    await loadCropper();
  } catch (err) {
    toast(`${err.message} The photo will be uploaded without editing.`, 'error', 6000);
    return file;
  }

  const srcUrl = URL.createObjectURL(file);
  const state = {
    ratio: RATIOS.some(([k]) => k === aspect) ? aspect : 'free',
    rotate: 0, // multiples of 90
    straighten: 0,
    flipX: 1,
    flipY: 1,
    adjust: Object.fromEntries(ADJUSTMENTS.map(({ key }) => [key, 0])),
  };

  return new Promise((resolve) => {
    let result = null;
    let cropper = null;

    const m = openModal({
      title,
      size: 'lg',
      body: `
        <div class="img-editor">
          <div class="img-editor__stage"><img src="${srcUrl}" alt="Image being edited" data-ed-img></div>
          <div class="img-editor__tabs tabs" role="tablist">
            <button type="button" class="tab is-active" data-ed-tab="crop">${icon('crop', 'icon--sm')} Crop &amp; rotate</button>
            <button type="button" class="tab" data-ed-tab="adjust">${icon('sliders', 'icon--sm')} Adjust</button>
          </div>
          <div class="img-editor__panel" data-ed-panel="crop">
            <div class="img-editor__group" role="group" aria-label="Crop shape">
              ${RATIOS.map(([k, l]) => `<button type="button" class="chip${k === state.ratio ? ' is-active' : ''}" data-ratio="${k}">${esc(l)}</button>`).join('')}
            </div>
            <div class="img-editor__group" role="group" aria-label="Rotate, flip and zoom">
              <button type="button" class="icon-btn" data-ed="rotate-left" title="Rotate left" aria-label="Rotate left">${icon('rotate-ccw')}</button>
              <button type="button" class="icon-btn" data-ed="rotate-right" title="Rotate right" aria-label="Rotate right">${icon('rotate-cw')}</button>
              <button type="button" class="icon-btn" data-ed="flip-x" title="Flip horizontally" aria-label="Flip horizontally">${icon('flip-h')}</button>
              <button type="button" class="icon-btn" data-ed="flip-y" title="Flip vertically" aria-label="Flip vertically">${icon('flip-v')}</button>
              <button type="button" class="icon-btn" data-ed="zoom-in" title="Zoom in" aria-label="Zoom in">${icon('zoom-in')}</button>
              <button type="button" class="icon-btn" data-ed="zoom-out" title="Zoom out" aria-label="Zoom out">${icon('zoom-out')}</button>
            </div>
            <label class="img-editor__slider">
              <span>Straighten</span>
              <input type="range" min="-45" max="45" step="0.5" value="0" data-straighten>
              <output data-straighten-out>0°</output>
            </label>
          </div>
          <div class="img-editor__panel" data-ed-panel="adjust" hidden>
            ${ADJUSTMENTS.map(({ key, label }) => `
              <label class="img-editor__slider">
                <span>${label}</span>
                <input type="range" min="-100" max="100" step="1" value="0" data-adjust="${key}">
                <output data-adjust-out="${key}">0</output>
              </label>`).join('')}
          </div>
          <p class="img-editor__hint">Drag the photo to move it, drag the corners to crop, scroll or pinch to zoom.</p>
        </div>`,
      footer: `
        <button type="button" class="btn btn--secondary" data-ed="reset">${icon('refresh')} Reset</button>
        <span class="spacer"></span>
        <button type="button" class="btn btn--secondary" data-ed="original" title="Upload the photo without these changes">Use original</button>
        <button type="button" class="btn" data-ed="apply">${icon('check')} Apply &amp; upload</button>`,
      onClose: () => {
        cropper?.destroy();
        URL.revokeObjectURL(srcUrl);
        resolve(result);
      },
    });

    const el = m.el;
    el.classList.add('modal--editor');
    const img = $('[data-ed-img]', el);
    const stage = $('.img-editor__stage', el);

    function ratioValue(key) {
      if (key === 'free') return NaN;
      if (key === 'original') {
        const d = cropper.getImageData();
        const quarter = Math.abs(state.rotate % 180) === 90;
        return quarter ? d.naturalHeight / d.naturalWidth : d.naturalWidth / d.naturalHeight;
      }
      const [w, h] = key.split(':').map(Number);
      return w / h;
    }

    /**
     * Shrink the crop box to the largest box of the chosen shape that fits inside the
     * (possibly rotated) photo, so the result never has blank corners.
     */
    function fitCrop(ratio) {
      const img = cropper.getImageData();
      const cv = cropper.getCanvasData();
      const theta = ((state.rotate + state.straighten) * Math.PI) / 180;
      const c = Math.abs(Math.cos(theta));
      const s = Math.abs(Math.sin(theta));
      const quarter = Math.abs(state.rotate % 180) === 90;
      const box = cropper.getCropBoxData();
      let r = ratio;
      if (!Number.isFinite(r) || r <= 0) r = box.width && box.height ? box.width / box.height : img.width / img.height;
      // Half-height b of a centred r:1 box inside a W×H rectangle rotated by theta
      const W = img.width; const H = img.height;
      const b = Math.min((W / 2) / (r * c + s), (H / 2) / (r * s + c));
      const a = r * b;
      const cx = cv.left + cv.width / 2;
      const cy = cv.top + cv.height / 2;
      cropper.setCropBoxData({ left: cx - a, top: cy - b, width: 2 * a, height: 2 * b });
      return quarter;
    }

    /** Scale and centre the rotated photo so all of it is visible in the editor. */
    function fitCanvas() {
      const cont = cropper.getContainerData();
      const cv = cropper.getCanvasData();
      const k = Math.min(cont.width / cv.width, cont.height / cv.height);
      const width = cv.width * k;
      const height = cv.height * k;
      // The photo can't shrink below the crop box, so shrink the box first (fitCrop re-sizes it after).
      const box = cropper.getCropBoxData();
      cropper.setCropBoxData({ left: box.left + box.width / 2 - 10, top: box.top + box.height / 2 - 10, width: 20, height: 20 });
      cropper.setCanvasData({ left: (cont.width - width) / 2, top: (cont.height - height) / 2, width, height });
    }

    function applyRotation({ turned = false } = {}) {
      const before = cropper.getCropBoxData();
      const keepRatio = before.width && before.height ? before.width / before.height : NaN;
      cropper.rotateTo(state.rotate + state.straighten);
      fitCanvas();
      const fixed = ratioValue(state.ratio);
      if (Number.isFinite(fixed)) {
        cropper.setAspectRatio(fixed);
        fitCrop(fixed);
      } else {
        // Free shape: after a 90° turn use the photo's new shape; while straightening keep the current box shape.
        const d = cropper.getImageData();
        const quarter = Math.abs(state.rotate % 180) === 90;
        fitCrop(turned ? (quarter ? d.height / d.width : d.width / d.height) : keepRatio);
      }
    }
    const applyFilter = () => stage.style.setProperty('--img-filter', isNeutral(state.adjust) ? 'none' : filterString(state.adjust));

    img.addEventListener('load', () => {
      cropper = new window.Cropper(img, {
        viewMode: 1,
        dragMode: 'move',
        autoCropArea: 1,
        background: true,
        responsive: true,
        restore: false,
        guides: true,
        toggleDragModeOnDblclick: false,
        ready() {
          cropper.setAspectRatio(ratioValue(state.ratio));
        },
      });
    }, { once: true });

    function setRatio(key) {
      state.ratio = key;
      $$('[data-ratio]', el).forEach((b) => b.classList.toggle('is-active', b.dataset.ratio === key));
      if (!cropper) return;
      cropper.setAspectRatio(ratioValue(key));
      if (state.rotate || state.straighten) applyRotation();
    }

    function reset() {
      state.rotate = 0; state.straighten = 0; state.flipX = 1; state.flipY = 1;
      ADJUSTMENTS.forEach(({ key }) => { state.adjust[key] = 0; });
      $$('[data-adjust]', el).forEach((r) => { r.value = 0; });
      $$('[data-adjust-out]', el).forEach((o) => { o.textContent = '0'; });
      $('[data-straighten]', el).value = 0;
      $('[data-straighten-out]', el).textContent = '0°';
      applyFilter();
      cropper?.reset();
      cropper?.setAspectRatio(ratioValue(state.ratio));
    }

    async function apply(btn) {
      if (!cropper) return;
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span> Preparing…';
      try {
        const keepAlpha = /png|webp/.test(file.type);
        const cropped = cropper.getCroppedCanvas({
          maxWidth: MAX_OUTPUT,
          maxHeight: MAX_OUTPUT,
          imageSmoothingEnabled: true,
          imageSmoothingQuality: 'high',
          ...(keepAlpha ? {} : { fillColor: '#fff' }),
        });
        let out = cropped;
        if (!isNeutral(state.adjust)) {
          out = document.createElement('canvas');
          out.width = cropped.width;
          out.height = cropped.height;
          const ctx = out.getContext('2d', { willReadFrequently: true });
          if (typeof ctx.filter === 'string') {
            ctx.filter = filterString(state.adjust);
            ctx.drawImage(cropped, 0, 0);
          } else {
            ctx.drawImage(cropped, 0, 0);
            applyPixels(ctx, out.width, out.height, state.adjust);
          }
        }
        const type = keepAlpha ? 'image/png' : 'image/jpeg';
        const blob = await canvasToBlob(out, type, 0.92);
        if (!blob) throw new Error('Could not save the edited image.');
        const name = file.name.replace(/\.[^.]+$/, '') + (type === 'image/png' ? '.png' : '.jpg');
        result = new File([blob], name, { type });
        m.close();
      } catch (err) {
        toast(err.message || 'Could not save the edited image.', 'error', 6000);
        btn.disabled = false;
        btn.innerHTML = `${icon('check')} Apply &amp; upload`;
      }
    }

    el.addEventListener('click', (e) => {
      const tab = e.target.closest('[data-ed-tab]');
      if (tab) {
        $$('[data-ed-tab]', el).forEach((t) => t.classList.toggle('is-active', t === tab));
        $$('[data-ed-panel]', el).forEach((p) => { p.hidden = p.dataset.edPanel !== tab.dataset.edTab; });
        return;
      }
      const ratio = e.target.closest('[data-ratio]');
      if (ratio) { setRatio(ratio.dataset.ratio); return; }
      const btn = e.target.closest('[data-ed]');
      if (!btn || !cropper && btn.dataset.ed !== 'original') return;
      switch (btn.dataset.ed) {
        case 'rotate-left': state.rotate -= 90; applyRotation({ turned: true }); break;
        case 'rotate-right': state.rotate += 90; applyRotation({ turned: true }); break;
        case 'flip-x': state.flipX *= -1; cropper.scaleX(state.flipX); break;
        case 'flip-y': state.flipY *= -1; cropper.scaleY(state.flipY); break;
        case 'zoom-in': cropper.zoom(0.1); break;
        case 'zoom-out': cropper.zoom(-0.1); break;
        case 'reset': reset(); break;
        case 'original': result = file; m.close(); break;
        case 'apply': apply(btn); break;
        default:
      }
    });

    $('[data-straighten]', el).addEventListener('input', (e) => {
      state.straighten = Number(e.target.value);
      $('[data-straighten-out]', el).textContent = `${state.straighten}°`;
      applyRotation();
    });
    $$('[data-adjust]', el).forEach((range) => {
      range.addEventListener('input', () => {
        state.adjust[range.dataset.adjust] = Number(range.value);
        $(`[data-adjust-out="${range.dataset.adjust}"]`, el).textContent = range.value;
        applyFilter();
      });
      // Double-click a slider to put it back to 0
      range.addEventListener('dblclick', () => { range.value = 0; range.dispatchEvent(new Event('input')); });
    });
  });
}
