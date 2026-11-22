/**
 * Homepage hero slider: cross-fading background images with per-slide text.
 * Autoplays (paused on hover/focus/hidden tab), respects reduced motion,
 * lazy-loads non-visible slides and supports swipe + keyboard.
 */
import { esc, imgUrl, safeUrl, prefersReducedMotion } from '../lib/dom.js';

const INTERVAL = 6500;

export class HeroSlider {
  constructor(root) {
    this.root = root;
    this.slidesWrap = root.querySelector('.hero__slides');
    this.textEl = root.querySelector('.hero__text');
    this.titleEl = root.querySelector('.hero__title');
    this.leadEl = root.querySelector('.hero__lead');
    this.ctaEl = root.querySelector('.hero__cta');
    this.dotsEl = root.querySelector('.hero__dots');
    this.index = 0;
    this.timer = null;
    this.paused = false;
    this.slides = Array.from(root.querySelectorAll('.hero__slide')).map((el) => ({
      el,
      title: el.dataset.title,
      titleHtml: el.dataset.titleHtml,
      subtitle: el.dataset.subtitle,
      ctaText: el.dataset.ctaText,
      ctaLink: el.dataset.ctaLink,
    }));
    root.style.setProperty('--hero-interval', `${INTERVAL}ms`);
    this.bind();
    this.renderDots();
    this.start();
    const loadRest = () => this.slides.forEach((s) => this.load(s.el));
    if (document.readyState === 'complete') setTimeout(loadRest, 300);
    else window.addEventListener('load', () => setTimeout(loadRest, 300), { once: true });
  }

  /** Replace slides with admin-managed ones from Firestore. */
  setSlides(list) {
    if (!list.length) return;
    this.stop();
    this.slidesWrap.innerHTML = list.map((s, i) => `
      <div class="hero__slide${i === 0 ? ' is-active' : ''}">
        <img ${i === 0 ? 'src' : 'data-src'}="${esc(imgUrl(s.imageUrl, 1920))}" alt="" ${i === 0 ? 'fetchpriority="high"' : ''}>
      </div>`).join('');
    this.slides = Array.from(this.slidesWrap.children).map((el, i) => ({
      el,
      title: list[i].title,
      subtitle: list[i].subtitle,
      ctaText: list[i].ctaText,
      ctaLink: safeUrl(list[i].ctaLink),
    }));
    this.index = 0;
    this.renderText(this.slides[0], false);
    this.renderDots();
    this.slides.forEach((s) => this.load(s.el));
    this.start();
  }

  load(el) {
    const img = el.querySelector('img[data-src]');
    if (!img) return;
    if (img.dataset.srcset) { img.sizes = '100vw'; img.srcset = img.dataset.srcset; }
    img.src = img.dataset.src;
    img.removeAttribute('data-src');
  }

  bind() {
    this.root.querySelector('.hero__prev')?.addEventListener('click', () => this.go(this.index - 1, true));
    this.root.querySelector('.hero__next')?.addEventListener('click', () => this.go(this.index + 1, true));
    this.root.addEventListener('mouseenter', () => this.pause(true));
    this.root.addEventListener('mouseleave', () => this.pause(false));
    this.root.addEventListener('focusin', () => this.pause(true));
    this.root.addEventListener('focusout', () => this.pause(false));
    document.addEventListener('visibilitychange', () => this.pause(document.hidden));
    let startX = null;
    this.root.addEventListener('touchstart', (e) => { startX = e.touches[0].clientX; }, { passive: true });
    this.root.addEventListener('touchend', (e) => {
      if (startX === null) return;
      const dx = e.changedTouches[0].clientX - startX;
      if (Math.abs(dx) > 50) this.go(this.index + (dx < 0 ? 1 : -1), true);
      startX = null;
    });
  }

  renderDots() {
    if (!this.dotsEl) return;
    const multi = this.slides.length > 1;
    this.root.querySelector('.hero__arrows')?.toggleAttribute('hidden', !multi);
    this.dotsEl.innerHTML = multi
      ? this.slides.map((_, i) => `<button class="hero__dot${i === this.index ? ' is-active' : ''}" type="button" aria-label="Go to slide ${i + 1}"></button>`).join('')
      : '';
    Array.from(this.dotsEl.children).forEach((dot, i) => dot.addEventListener('click', () => this.go(i, true)));
  }

  renderText(slide, animate = true) {
    const apply = () => {
      if (slide.titleHtml) this.titleEl.innerHTML = slide.titleHtml;
      else if (slide.title) this.titleEl.textContent = slide.title;
      if (slide.subtitle) this.leadEl.textContent = slide.subtitle;
      if (this.ctaEl) {
        const label = this.ctaEl.querySelector('span');
        if (slide.ctaText && label) label.textContent = slide.ctaText;
        if (slide.ctaLink) this.ctaEl.href = slide.ctaLink;
      }
      this.textEl.classList.remove('is-changing');
    };
    if (!animate || prefersReducedMotion()) return apply();
    this.textEl.classList.add('is-changing');
    setTimeout(apply, 350);
  }

  go(i, user = false) {
    const n = this.slides.length;
    if (n < 2) return;
    const next = (i + n) % n;
    const prev = this.slides[this.index];
    const target = this.slides[next];
    this.load(target.el);
    prev.el.classList.remove('is-active');
    target.el.classList.add('is-active');
    this.index = next;
    this.renderText(target);
    Array.from(this.dotsEl.children).forEach((d, k) => {
      d.classList.remove('is-active');
      if (k === next) { void d.offsetWidth; d.classList.add('is-active'); }
    });
    if (user) this.start();
  }

  start() {
    this.stop();
    if (this.slides.length < 2 || prefersReducedMotion()) return;
    this.timer = setInterval(() => { if (!this.paused) this.go(this.index + 1); }, INTERVAL);
  }

  stop() { clearInterval(this.timer); }

  pause(state) {
    this.paused = state;
    this.root.classList.toggle('is-paused', state);
  }
}
