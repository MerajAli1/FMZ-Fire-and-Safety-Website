/** Accessible image lightbox with keyboard + swipe navigation. */
import { esc, icon, imgUrl } from '../lib/dom.js';

let root;
let items = [];
let index = 0;
let lastFocus = null;

function build() {
  root = document.createElement('div');
  root.className = 'lightbox';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-label', 'Image viewer');
  root.innerHTML = `
    <span class="lightbox__count" aria-live="polite"></span>
    <button class="lightbox__btn lightbox__close" type="button" aria-label="Close">${icon('x')}</button>
    <button class="lightbox__btn lightbox__prev" type="button" aria-label="Previous image">${icon('chevron-left')}</button>
    <figure class="lightbox__figure">
      <img class="lightbox__img" alt="">
      <figcaption class="lightbox__cap"></figcaption>
    </figure>
    <button class="lightbox__btn lightbox__next" type="button" aria-label="Next image">${icon('chevron-right')}</button>`;
  document.body.appendChild(root);

  root.querySelector('.lightbox__close').addEventListener('click', close);
  root.querySelector('.lightbox__prev').addEventListener('click', () => go(-1));
  root.querySelector('.lightbox__next').addEventListener('click', () => go(1));
  root.addEventListener('click', (e) => { if (e.target === root) close(); });

  let startX = null;
  root.addEventListener('touchstart', (e) => { startX = e.touches[0].clientX; }, { passive: true });
  root.addEventListener('touchend', (e) => {
    if (startX === null) return;
    const dx = e.changedTouches[0].clientX - startX;
    if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
    startX = null;
  });
}

function onKey(e) {
  if (e.key === 'Escape') close();
  else if (e.key === 'ArrowRight') go(1);
  else if (e.key === 'ArrowLeft') go(-1);
}

function render() {
  const item = items[index];
  const imgEl = root.querySelector('.lightbox__img');
  imgEl.src = imgUrl(item.imageUrl, 1600);
  imgEl.alt = item.caption || 'Gallery image';
  root.querySelector('.lightbox__cap').innerHTML = esc(item.caption || '');
  root.querySelector('.lightbox__count').textContent = `${index + 1} / ${items.length}`;
  const multi = items.length > 1;
  root.querySelector('.lightbox__prev').hidden = !multi;
  root.querySelector('.lightbox__next').hidden = !multi;
  // Preload neighbour
  if (multi) new Image().src = imgUrl(items[(index + 1) % items.length].imageUrl, 1600);
}

function go(step) {
  index = (index + step + items.length) % items.length;
  render();
}

export function openLightbox(list, start = 0) {
  if (!list.length) return;
  if (!root) build();
  items = list;
  index = start;
  lastFocus = document.activeElement;
  render();
  root.classList.add('is-open');
  document.body.style.overflow = 'hidden';
  document.addEventListener('keydown', onKey);
  root.querySelector('.lightbox__close').focus();
}

export function close() {
  root.classList.remove('is-open');
  document.body.style.overflow = '';
  document.removeEventListener('keydown', onKey);
  lastFocus?.focus?.();
}
