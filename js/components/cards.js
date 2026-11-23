/** HTML templates for dynamic content. Every dynamic value is escaped. */
import { esc, icon, imgUrl, imgSrcset, safeUrl, categoryLabel, initials } from '../lib/dom.js';

const PLACEHOLDER = 'data:image/svg+xml,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 3"><rect width="4" height="3" fill="#eef2f7"/></svg>',
);

function img(url, alt, { w = 800, sizes = '(max-width: 640px) 100vw, 400px', lazy = true, cls = '' } = {}) {
  const src = imgUrl(url, w) || PLACEHOLDER;
  const srcset = imgSrcset(url);
  return `<img src="${esc(src)}"${srcset ? ` srcset="${esc(srcset)}" sizes="${sizes}"` : ''} alt="${esc(alt)}"${lazy ? ' loading="lazy" decoding="async"' : ''}${cls ? ` class="${cls}"` : ''}>`;
}

export const productHref = (item) => `product.html?id=${encodeURIComponent(item.id)}`;
export const postHref = (post) => `article.html?slug=${encodeURIComponent(post.slug || post.id)}`;

export function formatDate(value) {
  const d = new Date(typeof value === 'number' ? value : String(value || ''));
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function postCard(post, index = 0) {
  return `
  <article class="post-card reveal" data-delay="${index % 3}">
    <a class="post-card__media" href="${postHref(post)}" tabindex="-1" aria-hidden="true">
      ${post.coverImage ? img(post.coverImage, post.title, { w: 700 }) : `<span class="post-card__placeholder">${icon('flame', 'icon--lg')}</span>`}
    </a>
    <div class="post-card__body">
      <div class="post-card__meta">
        ${post.category ? `<span class="post-card__cat">${esc(categoryLabel(post.category))}</span>` : ''}
        <span>${esc(formatDate(post.date || post.createdAt))}</span>
      </div>
      <h3><a href="${postHref(post)}">${esc(post.title)}</a></h3>
      <p>${esc(post.excerpt)}</p>
      <a class="link-arrow" href="${postHref(post)}">Read article ${icon('arrow-right')}</a>
    </div>
  </article>`;
}

export function inquiryHref(subject) {
  return `contact.html?subject=${encodeURIComponent(subject)}`;
}

export function productCard(item, index) {
  return `
  <article class="product-card reveal" data-delay="${index % 3}">
    <div class="product-card__media">
      ${img(item.imageUrl, item.title, { w: 600 })}
      ${item.category ? `<span class="product-card__tag">${esc(categoryLabel(item.category))}</span>` : ''}
      <button class="product-card__zoom" type="button" data-product="${esc(item.id)}" aria-label="View details for ${esc(item.title)}">${icon('expand', 'icon--sm')}</button>
    </div>
    <div class="product-card__body">
      <h3><a href="${productHref(item)}">${esc(item.title)}</a></h3>
      <p>${esc(item.description)}</p>
      <div class="product-card__actions">
        <a class="link-arrow" href="${productHref(item)}">Details ${icon('arrow-right')}</a>
        <a class="btn btn--sm btn--outline" href="${inquiryHref(`Equipment inquiry: ${item.title}`)}">Get a quote</a>
      </div>
    </div>
  </article>`;
}

export function clientCard(item, { reveal = true } = {}) {
  return `
  <div class="client-card${reveal ? ' reveal' : ''}">
    <div class="client-card__logo">${img(item.imageUrl, `${item.name} logo`, { w: 360, sizes: '200px' })}</div>
    <h3>${esc(item.name)}</h3>
    ${item.location ? `<p>${icon('map-pin')}${esc(item.location)}</p>` : ''}
  </div>`;
}

export function programCard(item, index) {
  const features = Array.isArray(item.features)
    ? item.features
    : String(item.features || '').split('\n');
  const list = features.map((f) => f.trim()).filter(Boolean);
  return `
  <article class="feature-card reveal" data-delay="${index % 3}">
    <div class="feature-card__icon">${icon(item.icon || 'shield')}</div>
    <h3>${esc(item.title)}</h3>
    ${item.duration ? `<span class="feature-card__meta">${icon('clock')} ${esc(item.duration)}</span>` : ''}
    <p>${esc(item.description)}</p>
    ${list.length ? `<ul>${list.map((f) => `<li>${icon('check')} ${esc(f)}</li>`).join('')}</ul>` : ''}
    <a class="link-arrow" href="${inquiryHref(`Training inquiry: ${item.title}`)}">Enquire about this course ${icon('arrow-right')}</a>
  </article>`;
}

export function teamCard(item, index) {
  const linkedin = safeUrl(item.linkedin);
  return `
  <article class="team-card reveal" data-delay="${index % 3}">
    <div class="team-card__photo">${img(item.imageUrl, item.name, { w: 500 })}</div>
    <div class="team-card__body">
      <h3>${esc(item.name)}</h3>
      <p>${esc(item.role)}</p>
      ${linkedin ? `<div class="team-card__social social" style="margin-top:.8rem;justify-content:center"><a href="${esc(linkedin)}" target="_blank" rel="noopener" aria-label="${esc(item.name)} on LinkedIn" style="background:var(--bg-soft);color:var(--navy)">${icon('linkedin')}</a></div>` : ''}
    </div>
  </article>`;
}

export function testimonialCard(item, index) {
  const rating = Math.max(0, Math.min(5, Number(item.rating) || 5));
  return `
  <figure class="testimonial reveal" data-delay="${index % 3}">
    ${icon('quote', 'testimonial__quote')}
    <div class="testimonial__stars" aria-label="${rating} out of 5 stars">${icon('star-fill').repeat(rating)}</div>
    <blockquote>“${esc(item.quote)}”</blockquote>
    <figcaption class="testimonial__author">
      <span class="testimonial__avatar">${item.imageUrl ? img(item.imageUrl, item.name, { w: 120 }) : esc(initials(item.name))}</span>
      <span><strong>${esc(item.name)}</strong><span>${esc([item.role, item.company].filter(Boolean).join(', '))}</span></span>
    </figcaption>
  </figure>`;
}

export function galleryItem(item, index) {
  return `
  <button type="button" class="gallery-item" data-index="${index}" aria-label="Open image${item.caption ? `: ${esc(item.caption)}` : ''}">
    ${img(item.imageUrl, item.caption || 'FMZ gallery image', { w: 700, sizes: '(max-width: 640px) 100vw, 33vw' })}
    ${item.caption ? `<span class="gallery-item__cap">${esc(item.caption)}</span>` : ''}
  </button>`;
}

export function skeletons(count, cls = 'skeleton--card') {
  return Array.from({ length: count }, () => `<div class="skeleton ${cls}" aria-hidden="true"></div>`).join('');
}

export function emptyState(title, text, iconName = 'package') {
  return `<div class="empty-state">${icon(iconName)}<h3>${esc(title)}</h3><p>${esc(text)}</p></div>`;
}
