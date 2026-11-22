/**
 * Image upload pipeline: resize + compress in the browser, then upload to
 * Cloudinary (unsigned preset) with progress reporting.
 */
import { CLOUDINARY } from '../../js/config.js';

const MAX_INPUT_BYTES = 25 * 1024 * 1024;

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/**
 * Downscale large photos and re-encode as WebP (falls back to JPEG/PNG).
 * Typical phone photos go from 3–6 MB to 200–400 KB.
 */
export async function compressImage(file, { maxWidth = 1600, quality = 0.85 } = {}) {
  if (!file.type.startsWith('image/')) throw new Error(`"${file.name}" is not an image.`);
  if (file.size > MAX_INPUT_BYTES) throw new Error(`"${file.name}" is larger than 25 MB.`);
  if (/svg|gif/.test(file.type)) return file; // keep vector / animation as-is

  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file; // unsupported format in this browser (e.g. HEIC) — let Cloudinary handle it
  }
  const scale = Math.min(1, maxWidth / bitmap.width);
  if (scale === 1 && file.size < 350 * 1024) { bitmap.close?.(); return file; }

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();

  let blob = await canvasToBlob(canvas, 'image/webp', quality);
  if (!blob || blob.type !== 'image/webp') {
    blob = await canvasToBlob(canvas, file.type === 'image/png' ? 'image/png' : 'image/jpeg', quality);
  }
  if (!blob || blob.size >= file.size) return file;
  const ext = blob.type.split('/')[1].replace('jpeg', 'jpg');
  return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.' + ext, { type: blob.type });
}

/** Upload to Cloudinary. Resolves with the secure URL. */
export function uploadImage(file, onProgress) {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append('file', file);
    form.append('upload_preset', CLOUDINARY.uploadPreset);
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${CLOUDINARY.cloudName}/image/upload`);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress?.(e.loaded / e.total); };
    xhr.onload = () => {
      let data = {};
      try { data = JSON.parse(xhr.responseText); } catch { /* ignore */ }
      if (xhr.status >= 200 && xhr.status < 300 && data.secure_url) resolve(data.secure_url);
      else reject(new Error(data.error?.message || `Upload failed (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error('Network error while uploading. Check your connection.'));
    xhr.send(form);
  });
}

export async function processAndUpload(file, opts, onProgress) {
  const optimised = await compressImage(file, opts);
  return uploadImage(optimised, onProgress);
}
