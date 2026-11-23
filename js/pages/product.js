import { observeReveals, getSettings } from '../site.js';
import { useData, publishedSorted } from '../lib/store.js';
import { $, esc, icon, imgUrl, categoryLabel } from '../lib/dom.js';
import { setPageSeo, absoluteUrl } from '../lib/seo.js';
import { productCard, productHref, inquiryHref } from '../components/cards.js';

const id = new URLSearchParams(location.search).get('id') || '';
let rendered = '';

function notFound() {
  setPageSeo({ title: 'Product not found | FMZ Fire & Safety Engineering', noindex: true });
  $('#product').innerHTML = `<div class="empty-state">${icon('package')}<h1 style="font-size:1.6rem">Product not found</h1>
    <p>This item may have been removed from our catalogue.</p><a class="btn" href="equipments.html">Browse all equipment</a></div>`;
}

function render(item, all) {
  const key = JSON.stringify(item);
  if (key === rendered) return;
  rendered = key;
  const category = categoryLabel(item.category);
  const path = productHref(item);
  setPageSeo({
    title: `${item.title}${category ? ` – ${category}` : ''} in Karachi | FMZ Fire & Safety`,
    description: item.description || `${item.title} supplied by FMZ Fire & Safety Engineering, Karachi.`,
    path,
    image: item.imageUrl,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: item.title,
      description: item.description,
      image: item.imageUrl ? [absoluteUrl(item.imageUrl)] : undefined,
      category,
      brand: { '@type': 'Organization', name: 'FMZ Fire & Safety Engineering' },
      url: absoluteUrl(path),
    },
  });

  $('#crumb-title').textContent = item.title;
  const wa = String(getSettings().whatsapp || '').replace(/\D/g, '');
  const waText = encodeURIComponent(`Hello FMZ, I'd like a quote for: ${item.title}`);
  $('#product').innerHTML = `
    <div class="product-detail">
      <div class="product-detail__media"><img src="${esc(imgUrl(item.imageUrl, 1200))}" alt="${esc(item.title)}" fetchpriority="high"></div>
      <div class="product-detail__body">
        ${category ? `<a class="eyebrow" href="equipments.html?category=${encodeURIComponent(item.category)}">${esc(category)}</a>` : ''}
        <h1 class="section-title">${esc(item.title)}</h1>
        <div class="prose"><p>${esc(item.description).replace(/\n/g, '<br>')}</p></div>
        <ul class="checklist" style="grid-template-columns:1fr">
          <li>${icon('check-circle')} Quality-assured, supplied by a Karachi safety specialist since 2014</li>
          <li>${icon('check-circle')} Expert advice on choosing the right equipment for your site</li>
          <li>${icon('check-circle')} Bulk and corporate orders welcome</li>
        </ul>
        <div class="hero__actions">
          <a class="btn btn--lg" href="${inquiryHref(`Equipment inquiry: ${item.title}`)}">Request a quote ${icon('arrow-right', 'icon--move')}</a>
          ${wa ? `<a class="btn btn--lg btn--whatsapp" target="_blank" rel="noopener" href="https://wa.me/${wa}?text=${waText}">${icon('whatsapp')} WhatsApp</a>` : ''}
        </div>
      </div>
    </div>`;

  const related = all.filter((x) => x.id !== item.id && x.category === item.category).slice(0, 3);
  const more = related.length ? related : all.filter((x) => x.id !== item.id).slice(0, 3);
  $('#related-section').hidden = more.length === 0;
  $('#related-grid').innerHTML = more.map(productCard).join('');
  observeReveals($('#related-grid'));
}

useData({ items: 'col:equipments' }, ({ items }, meta) => {
  if (!items && meta.error) { notFound(); return; }
  const all = publishedSorted(items || []);
  const item = all.find((x) => x.id === id);
  if (item) render(item, all); else notFound();
});
