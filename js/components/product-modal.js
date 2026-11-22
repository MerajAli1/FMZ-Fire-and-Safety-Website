/** Equipment detail dialog. */
import { esc, icon, imgUrl, categoryLabel } from '../lib/dom.js';
import { inquiryHref } from './cards.js';

let modal;
let lastFocus;

function ensure() {
  if (modal) return;
  modal = document.createElement('div');
  modal.className = 'modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'product-modal-title');
  document.body.appendChild(modal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal || e.target.closest('.modal__close')) closeProduct();
  });
}

function onKey(e) { if (e.key === 'Escape') closeProduct(); }

export function openProduct(item, whatsappNumber) {
  ensure();
  lastFocus = document.activeElement;
  const waText = encodeURIComponent(`Hello FMZ, I'd like a quote for: ${item.title}`);
  modal.innerHTML = `
    <div class="modal__panel">
      <button class="modal__close" type="button" aria-label="Close">${icon('x')}</button>
      <div class="modal__media"><img src="${esc(imgUrl(item.imageUrl, 1000))}" alt="${esc(item.title)}"></div>
      <div class="modal__body">
        ${item.category ? `<span class="eyebrow">${esc(categoryLabel(item.category))}</span>` : ''}
        <h2 id="product-modal-title" class="section-title" style="font-size:1.7rem">${esc(item.title)}</h2>
        <p>${esc(item.description)}</p>
        <div class="modal__actions">
          <a class="btn" href="${inquiryHref(`Equipment inquiry: ${item.title}`)}">Request a quote ${icon('arrow-right', 'icon--move')}</a>
          ${whatsappNumber ? `<a class="btn btn--whatsapp" target="_blank" rel="noopener" href="https://wa.me/${esc(whatsappNumber)}?text=${waText}">${icon('whatsapp')} WhatsApp</a>` : ''}
        </div>
      </div>
    </div>`;
  modal.classList.add('is-open');
  document.body.style.overflow = 'hidden';
  document.addEventListener('keydown', onKey);
  modal.querySelector('.modal__close').focus();
}

export function closeProduct() {
  if (!modal) return;
  modal.classList.remove('is-open');
  document.body.style.overflow = '';
  document.removeEventListener('keydown', onKey);
  lastFocus?.focus?.();
}
