/** Dashboard home: KPIs, 14-day inquiry chart, recent messages, setup checklist. */
import { db, auth, collection, doc, getDoc, getCountFromServer } from './firebase.js';
import { esc, icon, $, timeAgo } from './ui.js';
import { onInquiries } from './state.js';
import { STATUSES } from './inquiries.js';

const COUNTS = [
  ['equipments', 'Equipment items', 'package', '#/equipments', 'navy'],
  ['clients', 'Clients', 'building', '#/clients', 'green'],
  ['gallery', 'Gallery photos', 'image', '#/gallery', 'amber'],
  ['trainings', 'Training programs', 'graduation', '#/trainings', 'blue'],
];

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export function renderOverview(container) {
  const name = (auth.currentUser?.email || '').split('@')[0];
  container.innerHTML = `
    <div class="page-head">
      <div><h1>${greeting()}${name ? `, ${esc(name)}` : ''} 👋</h1>
      <p>${new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} — here's what's happening on your website.</p></div>
      <div class="page-head__actions"><a class="btn btn--secondary" href="../index.html" target="_blank" rel="noopener">${icon('external')} View website</a></div>
    </div>
    <div class="stat-grid">
      <a class="card stat-card" href="#/inquiries"><div class="stat-card__icon">${icon('inbox')}</div><div><div class="stat-card__num" data-k="new">–</div><div class="stat-card__label">New inquiries</div></div></a>
      <a class="card stat-card" href="#/inquiries"><div class="stat-card__icon stat-card__icon--blue">${icon('calendar')}</div><div><div class="stat-card__num" data-k="month">–</div><div class="stat-card__label">Inquiries in last 30 days</div></div></a>
      ${COUNTS.map(([k, label, ic, href, color]) => `<a class="card stat-card" href="${href}"><div class="stat-card__icon stat-card__icon--${color}">${icon(ic)}</div><div><div class="stat-card__num" data-k="${k}">–</div><div class="stat-card__label">${label}</div></div></a>`).join('')}
    </div>
    <div class="overview-grid">
      <div style="display:grid;gap:18px;align-content:start">
        <section class="card">
          <div class="card__head"><h2>Inquiries — last 14 days</h2><span class="cell-muted" data-k="total14"></span></div>
          <div class="card__body"><div class="chart" data-chart></div><div class="chart__labels" data-chart-labels></div></div>
        </section>
        <section class="card">
          <div class="card__head"><h2>Recent inquiries</h2><a class="btn btn--sm btn--secondary" href="#/inquiries">View all</a></div>
          <div data-recent><div class="loading-block"><div class="boot__spinner"></div></div></div>
        </section>
      </div>
      <div style="display:grid;gap:18px;align-content:start">
        <section class="card">
          <div class="card__head"><h2>Quick actions</h2></div>
          <div class="card__body quick-actions">
            <a class="quick-action" href="#/equipments?new">${icon('plus')} Add equipment</a>
            <a class="quick-action" href="#/gallery?upload">${icon('upload')} Upload photos</a>
            <a class="quick-action" href="#/clients?new">${icon('building')} Add client</a>
            <a class="quick-action" href="#/slides?new">${icon('slides')} New hero slide</a>
            <a class="quick-action" href="#/testimonials?new">${icon('message')} Add testimonial</a>
            <a class="quick-action" href="#/settings">${icon('settings')} Site settings</a>
          </div>
        </section>
        <section class="card">
          <div class="card__head"><h2>Website setup checklist</h2><span class="badge" data-k="progress"></span></div>
          <div class="card__body"><ul class="checklist" data-checklist><li class="cell-muted">Checking…</li></ul></div>
        </section>
      </div>
    </div>`;

  const set = (k, v) => { const el = $(`[data-k="${k}"]`, container); if (el) el.textContent = v; };

  const stop = onInquiries((items) => {
    const now = Date.now();
    set('new', items.filter((i) => i.status === 'new').length);
    set('month', items.filter((i) => i.date && now - i.date.getTime() < 30 * 864e5).length);

    // 14-day chart
    const days = Array.from({ length: 14 }, (_, n) => {
      const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - (13 - n));
      return { d, count: 0 };
    });
    items.forEach((i) => {
      if (!i.date) return;
      const day = new Date(i.date); day.setHours(0, 0, 0, 0);
      const slot = days.find((x) => x.d.getTime() === day.getTime());
      if (slot) slot.count += 1;
    });
    const max = Math.max(4, ...days.map((x) => x.count));
    $('[data-chart]', container).innerHTML = days.map((x) => `<div class="chart__bar ${x.count ? '' : 'chart__bar--empty'}" style="height:${Math.max(2, (x.count / max) * 100)}%" title="${x.d.toDateString()}: ${x.count}">${x.count ? `<span>${x.count}</span>` : ''}</div>`).join('');
    $('[data-chart-labels]', container).innerHTML = days.map((x, n) => `<span>${n % 2 ? '' : x.d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>`).join('');
    set('total14', `${days.reduce((s, x) => s + x.count, 0)} total`);

    const recent = items.slice(0, 6);
    $('[data-recent]', container).innerHTML = recent.length
      ? `<div class="table-wrap"><table class="table"><tbody>${recent.map((i) => `
          <tr onclick="location.hash='#/inquiries/${esc(i.id)}'" class="${i.status === 'new' ? 'is-unread' : ''}">
            <td><div class="cell-name">${i.status === 'new' ? '<span class="dot"></span>' : ''}<div><div>${esc(i.name || '—')}</div><div class="cell-muted cell-truncate">${esc(i.subject || '')}</div></div></div></td>
            <td class="cell-muted" style="white-space:nowrap">${esc(timeAgo(i.date))}</td>
            <td><span class="badge ${STATUSES[i.status].cls}">${STATUSES[i.status].label}</span></td>
          </tr>`).join('')}</tbody></table></div>`
      : `<div class="empty">${icon('inbox')}<h3>No inquiries yet</h3></div>`;
  });

  // Content counts + checklist
  (async () => {
    const names = ['equipments', 'clients', 'gallery', 'trainings', 'team', 'testimonials', 'slides'];
    const counts = {};
    await Promise.all(names.map(async (n) => {
      try { counts[n] = (await getCountFromServer(collection(db, n))).data().count; } catch { counts[n] = null; }
    }));
    COUNTS.forEach(([k]) => set(k, counts[k] ?? '–'));
    let s = {};
    try { s = (await getDoc(doc(db, 'settings', 'site'))).data() || {}; } catch { /* ignore */ }

    const tasks = [
      [Boolean(s.phone && s.email && s.address), 'Add your phone, email & office address', '#/settings'],
      [Boolean(s.clientsSeeded), 'Import the built-in client logos so you can manage them', '#/clients'],
      [counts.trainings > 0, 'Import or add your training programs', '#/trainings'],
      [counts.gallery >= 4, 'Upload at least 4 photos to the gallery', '#/gallery?upload'],
      [counts.slides > 0, 'Add your own homepage hero slides (optional)', '#/slides'],
      [counts.testimonials > 0, 'Add a client testimonial', '#/testimonials'],
      [counts.team > 0, 'Introduce your team on the About page', '#/team'],
      [Boolean(s.mapEmbed), 'Add a Google Map to the Contact page', '#/settings'],
    ];
    const done = tasks.filter((t) => t[0]).length;
    set('progress', `${done}/${tasks.length} done`);
    $('[data-checklist]', container).innerHTML = tasks.map(([ok, label, href]) => `
      <li>${icon(ok ? 'check-circle' : 'alert', ok ? 'ok' : 'todo')}<span>${ok ? `<s style="color:var(--muted)">${esc(label)}</s>` : `<a href="${href}">${esc(label)}</a>`}</span></li>`).join('');
  })();

  return stop;
}
