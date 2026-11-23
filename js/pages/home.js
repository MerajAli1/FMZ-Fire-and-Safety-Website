import { observeReveals, getSettings } from '../site.js';
import { useData, publishedSorted } from '../lib/store.js';
import { $ } from '../lib/dom.js';
import { mergeClients, resolveTrainings, publishedPosts } from '../lib/content.js';
import { HeroSlider } from '../components/hero-slider.js';
import {
  productCard, clientCard, programCard, galleryItem, testimonialCard, postCard, emptyState,
} from '../components/cards.js';
import { openProduct } from '../components/product-modal.js';
import { openLightbox } from '../components/lightbox.js';

const show = (el, visible) => { if (el) el.hidden = !visible; };

/* Hero */
const heroEl = $('.hero');
const hero = heroEl ? new HeroSlider(heroEl) : null;
useData({ slides: 'col:slides' }, ({ slides }) => {
  const list = publishedSorted(slides).filter((s) => s.imageUrl);
  if (list.length) hero?.setSlides(list);
});

/* Featured equipment */
let equipment = [];
const equipGrid = $('#home-equipment');
useData({ items: 'col:equipments' }, ({ items }, meta) => {
  if (!items && meta.error) return; // keep skeletons replaced below
  const all = publishedSorted(items || []);
  const featured = all.filter((e) => e.featured);
  equipment = (featured.length >= 3 ? featured : all).slice(0, 6);
  equipGrid.innerHTML = equipment.length
    ? equipment.map(productCard).join('')
    : emptyState('Product catalogue coming soon', 'Contact us for a full list of the safety equipment we supply.');
  observeReveals(equipGrid);
});
equipGrid?.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-product]');
  if (!btn) return;
  const item = equipment.find((x) => x.id === btn.dataset.product);
  if (item) openProduct(item, String(getSettings().whatsapp || '').replace(/\D/g, ''));
});

/* Clients marquee */
const track = $('#home-clients');
useData({ settings: 'doc:settings/site', clients: 'col:clients' }, ({ settings, clients }) => {
  const list = mergeClients(clients, settings);
  const featured = list.filter((c) => c.featured);
  const shown = (featured.length >= 6 ? featured : list).slice(0, 16);
  if (!shown.length) return;
  const cards = shown.map((c) => clientCard(c, { reveal: false })).join('');
  track.innerHTML = cards + cards.replace(/<div class="client-card/g, '<div aria-hidden="true" class="client-card');
  track.style.setProperty('--marquee-duration', `${Math.max(25, shown.length * 4)}s`);
});

/* Training programmes */
const programGrid = $('#home-training');
useData({ trainings: 'col:trainings' }, ({ trainings }) => {
  const list = resolveTrainings(trainings).slice(0, 3);
  programGrid.innerHTML = list.map(programCard).join('');
  observeReveals(programGrid);
});

/* Gallery preview */
const gallerySection = $('#home-gallery-section');
const galleryGrid = $('#home-gallery');
let galleryItems = [];
useData({ gallery: 'col:gallery' }, ({ gallery }) => {
  galleryItems = publishedSorted(gallery || []).filter((g) => g.imageUrl).slice(0, 8);
  show(gallerySection, galleryItems.length >= 4);
  galleryGrid.innerHTML = galleryItems.map(galleryItem).join('');
});
galleryGrid?.addEventListener('click', (e) => {
  const btn = e.target.closest('.gallery-item');
  if (btn) openLightbox(galleryItems, Number(btn.dataset.index));
});

/* Testimonials */
const testimonialSection = $('#home-testimonials-section');
const testimonialGrid = $('#home-testimonials');
useData({ testimonials: 'col:testimonials' }, ({ testimonials }) => {
  const list = publishedSorted(testimonials || []).slice(0, 6);
  show(testimonialSection, list.length > 0);
  testimonialGrid.innerHTML = list.map(testimonialCard).join('');
  observeReveals(testimonialGrid);
});

/* Latest blog posts */
const postsSection = $('#home-posts-section');
const postsGrid = $('#home-posts');
useData({ posts: 'col:posts' }, ({ posts }) => {
  const list = publishedPosts(posts).slice(0, 3);
  show(postsSection, list.length > 0);
  postsGrid.innerHTML = list.map(postCard).join('');
  observeReveals(postsGrid);
});
