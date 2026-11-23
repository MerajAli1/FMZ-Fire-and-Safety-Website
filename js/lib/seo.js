/** Update title, description, canonical, social tags and structured data for pages rendered from the database. */
import { SITE_URL } from '../config.js';

function meta(attr, key, value) {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', value);
}

export const absoluteUrl = (path) => (/^https?:\/\//.test(path) ? path : `${SITE_URL}/${String(path || '').replace(/^\.?\//, '')}`);

export function setPageSeo({ title, description, path, image, type = 'website', noindex = false, jsonLd }) {
  if (title) {
    document.title = title;
    meta('property', 'og:title', title);
    meta('name', 'twitter:title', title);
  }
  if (description) {
    const d = description.length > 160 ? `${description.slice(0, 157).trimEnd()}…` : description;
    meta('name', 'description', d);
    meta('property', 'og:description', d);
    meta('name', 'twitter:description', d);
  }
  if (path) {
    const url = absoluteUrl(path);
    let link = document.head.querySelector('link[rel="canonical"]');
    if (!link) { link = document.createElement('link'); link.rel = 'canonical'; document.head.appendChild(link); }
    link.href = url;
    meta('property', 'og:url', url);
  }
  if (image) {
    meta('property', 'og:image', absoluteUrl(image));
    meta('name', 'twitter:image', absoluteUrl(image));
  }
  meta('property', 'og:type', type);
  if (noindex) meta('name', 'robots', 'noindex, follow');
  if (jsonLd) {
    let script = document.getElementById('page-ld');
    if (!script) {
      script = document.createElement('script');
      script.type = 'application/ld+json';
      script.id = 'page-ld';
      document.head.appendChild(script);
    }
    script.textContent = JSON.stringify(jsonLd).replace(/</g, '\\u003c');
  }
}
