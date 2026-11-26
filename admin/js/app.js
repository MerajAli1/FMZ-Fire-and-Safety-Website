/** Admin shell: auth guard, sidebar, hash router, live inquiry notifications. */
import { auth, db, currentAdmin, signOut, collection, onSnapshot } from './firebase.js';
import { esc, icon, $, $$, toast, initials } from './ui.js';
import { SCHEMAS } from './schemas.js';
import { renderCollection } from './crud.js';
import { renderInquiries, normaliseInquiries } from './inquiries.js';
import { renderOverview } from './overview.js';
import { renderSettings } from './settings.js';
import { renderReviews } from './reviews.js';
import { setInquiries } from './state.js';

const ROUTES = {
  overview: { title: 'Overview', icon: 'dashboard', render: renderOverview },
  inquiries: { title: 'Inquiries', icon: 'inbox', render: renderInquiries },
  ...Object.fromEntries(Object.entries(SCHEMAS).map(([k, s]) => [k, { title: s.title, icon: s.navIcon, render: (el) => renderCollection(el, k) }])),
  reviews: { title: 'Client reviews', icon: 'star', render: renderReviews },
  settings: { title: 'Settings', icon: 'settings', render: renderSettings },
};

const NAV = [
  { label: null, items: ['overview', 'inquiries'] },
  { label: 'Website content', items: ['posts', 'equipments', 'clients', 'gallery', 'trainings', 'slides', 'testimonials', 'reviews', 'team'] },
  { label: 'Configuration', items: ['settings'] },
];

let cleanup = null;
const baseTitle = 'FMZ Admin';

function shell(user) {
  document.body.innerHTML = `
    <div class="app">
      <aside class="sidebar" id="sidebar">
        <div class="sidebar__brand">
          <img src="../assets/img/icon-192.png" alt="">
          <div><strong>FMZ Admin</strong><span>Website dashboard</span></div>
        </div>
        <nav class="sidebar__nav" aria-label="Dashboard">
          ${NAV.map((g) => `${g.label ? `<div class="sidebar__label">${g.label}</div>` : ''}${g.items.map((k) => `
            <a class="sidebar__link" href="#/${k}" data-route="${k}">${icon(ROUTES[k].icon)} ${esc(ROUTES[k].title)}${k === 'inquiries' ? '<span class="badge badge--brand" data-unread hidden></span>' : ''}${k === 'reviews' ? '<span class="badge badge--brand" data-new-reviews hidden></span>' : ''}</a>`).join('')}`).join('')}
        </nav>
        <div class="sidebar__footer">
          <a class="sidebar__link" href="../index.html" target="_blank" rel="noopener">${icon('globe')} View website</a>
          <button class="sidebar__link" style="background:none;border:0;width:100%;text-align:left" data-logout>${icon('logout')} Sign out</button>
        </div>
      </aside>
      <div class="sidebar-backdrop" data-close-nav></div>
      <div class="main">
        <header class="topbar">
          <button class="icon-btn menu-btn" data-toggle-nav aria-label="Open menu">${icon('menu')}</button>
          <h1 class="topbar__title" data-title></h1>
          <span class="topbar__spacer"></span>
          <div class="topbar__user"><span>${esc(user.email)}</span><div class="avatar" title="${esc(user.email)}">${esc(initials(user.email))}</div></div>
        </header>
        <main class="content" id="view" tabindex="-1"></main>
      </div>
    </div>`;

  const app = $('.app');
  $('[data-toggle-nav]').addEventListener('click', () => app.classList.toggle('nav-open'));
  $('[data-close-nav]').addEventListener('click', () => app.classList.remove('nav-open'));
  $('[data-logout]').addEventListener('click', async () => {
    await signOut(auth);
    location.replace('login.html');
  });
}

function route() {
  const [path, query = ''] = location.hash.replace(/^#\/?/, '').split('?');
  const name = path.split('/')[0] || 'overview';
  const r = ROUTES[name] || ROUTES.overview;
  const key = ROUTES[name] ? name : 'overview';

  cleanup?.();
  // Fresh element per view so listeners from the previous view are discarded with it.
  const view = document.createElement('div');
  $('#view').replaceChildren(view);
  window.scrollTo(0, 0);
  cleanup = r.render(view) || null;

  $$('[data-route]').forEach((a) => a.classList.toggle('is-active', a.dataset.route === key));
  $('[data-title]').textContent = r.title;
  $('.app').classList.remove('nav-open');
  updateTitle();

  // Quick-action deep links: #/equipments?new, #/gallery?upload
  if (query === 'new') setTimeout(() => $('[data-action="add"]', view)?.click(), 50);
  if (query === 'upload') setTimeout(() => $('[data-action="bulk-upload"]', view)?.click(), 50);
  if (query) history.replaceState(null, '', `#/${path}`);
}

let unread = 0;
function updateTitle() {
  const current = $('[data-title]')?.textContent || '';
  document.title = `${unread ? `(${unread}) ` : ''}${current} · ${baseTitle}`;
}

function watchInquiries() {
  let first = true;
  let known = new Set();
  onSnapshot(collection(db, 'contacts'), (snap) => {
    const list = normaliseInquiries(snap);
    setInquiries(list);
    unread = list.filter((i) => i.status === 'new').length;
    const badge = $('[data-unread]');
    if (badge) { badge.hidden = !unread; badge.textContent = unread; }
    updateTitle();
    if (!first) {
      list.filter((i) => !known.has(i.id) && i.status === 'new').forEach((i) => toast(`New inquiry from ${i.name || 'a visitor'}`, 'info', 6000));
    }
    known = new Set(list.map((i) => i.id));
    first = false;
  }, (err) => console.warn('Inquiry listener error', err));
}

function watchReviews() {
  let first = true;
  let known = new Set();
  onSnapshot(collection(db, 'reviewSubmissions'), (snap) => {
    const fresh = snap.docs.filter((d) => (d.data().status || 'new') === 'new');
    const badge = $('[data-new-reviews]');
    if (badge) { badge.hidden = !fresh.length; badge.textContent = fresh.length; }
    if (!first) fresh.filter((d) => !known.has(d.id)).forEach((d) => toast(`New client review from ${d.data().name || 'a client'}`, 'info', 6000));
    known = new Set(snap.docs.map((d) => d.id));
    first = false;
  }, (err) => console.warn('Review listener error', err));
}

(async () => {
  const user = await currentAdmin();
  if (!user) {
    if (auth.currentUser) await signOut(auth);
    location.replace(`login.html${location.hash ? `?next=${encodeURIComponent(location.hash)}` : ''}`);
    return;
  }
  shell(user);
  window.addEventListener('hashchange', route);
  route();
  watchInquiries();
  watchReviews();
})();
