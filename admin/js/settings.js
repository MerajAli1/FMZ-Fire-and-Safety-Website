/** Site settings: contact details, social links, homepage stats, announcement, map. */
import {
  db, auth, doc, getDoc, setDoc, serverTimestamp, sendPasswordResetEmail, collection, getDocs, toDate,
} from './firebase.js';
import { esc, icon, $, $$, toast, setBusy, friendlyError } from './ui.js';
import { DEFAULT_SETTINGS, SITE_URL, SITE_PAGES } from '../../js/config.js';

/** Build sitemap.xml: static pages + published blog posts + published equipment. */
export async function buildSitemap() {
  const today = new Date().toISOString().slice(0, 10);
  const day = (v) => (toDate(v) || new Date()).toISOString().slice(0, 10);
  const xmlEsc = (u) => u.replace(/&/g, '&amp;');
  const entries = SITE_PAGES.map(([path, priority]) => ({ loc: `${SITE_URL}/${path}`, lastmod: today, priority }));
  const [posts, equipment] = await Promise.all([getDocs(collection(db, 'posts')), getDocs(collection(db, 'equipments'))]);
  posts.docs.map((d) => d.data()).filter((p) => p.published !== false && p.slug).forEach((p) => {
    entries.push({ loc: `${SITE_URL}/article.html?slug=${encodeURIComponent(p.slug)}`, lastmod: day(p.updatedAt || p.createdAt), priority: 0.7 });
  });
  equipment.docs.filter((d) => d.data().published !== false).forEach((d) => {
    entries.push({ loc: `${SITE_URL}/product.html?id=${encodeURIComponent(d.id)}`, lastmod: day(d.data().updatedAt || d.data().createdAt), priority: 0.6 });
  });
  const body = entries.map((e) => `  <url>\n    <loc>${xmlEsc(e.loc)}</loc>\n    <lastmod>${e.lastmod}</lastmod>\n    <priority>${e.priority.toFixed(1)}</priority>\n  </url>`).join('\n');
  return { xml: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`, count: entries.length };
}

const SECTIONS = [
  {
    title: 'Company & contact',
    text: 'Shown in the header, footer, contact page and WhatsApp buttons across the website.',
    fields: [
      ['companyName', 'Company name', 'text'],
      ['tagline', 'Tagline', 'text'],
      ['phone', 'Phone number', 'tel', '+92 3xx xxxxxxx'],
      ['whatsapp', 'WhatsApp number', 'tel', 'Country code + number, e.g. 923452008861'],
      ['email', 'Email address', 'email'],
      ['hours', 'Working hours', 'text', 'Mon – Sat: 9:00 AM – 6:00 PM'],
      ['address', 'Office address', 'textarea', '', true],
    ],
  },
  {
    title: 'Social media',
    text: 'Leave a field empty to hide that icon on the website.',
    fields: [
      ['facebook', 'Facebook URL', 'url'],
      ['linkedin', 'LinkedIn URL', 'url'],
      ['instagram', 'Instagram URL', 'url'],
      ['youtube', 'YouTube URL', 'url'],
    ],
  },
  {
    title: 'Homepage figures',
    text: 'The animated numbers shown on the homepage, About and Training pages (a “+” is added automatically).',
    fields: [
      ['statYears', 'Years of experience', 'number'],
      ['statClients', 'Organisations served', 'number'],
      ['statTrained', 'Professionals trained', 'number'],
      ['statPrograms', 'Training programs', 'number'],
    ],
  },
  {
    title: 'Announcement bar',
    text: 'A coloured strip at the very top of every page — great for offers, new courses or holiday hours. Leave empty to hide it.',
    fields: [
      ['announcement', 'Announcement text', 'text', 'e.g. New: Working at Height course starting 1st March', true],
      ['announcementLink', 'Link (optional)', 'text', 'e.g. training.html', true],
    ],
  },
  {
    title: 'Google Map',
    text: 'In Google Maps, open your location → Share → Embed a map → Copy HTML, then paste it here.',
    fields: [['mapEmbed', 'Map embed code or URL', 'textarea', '<iframe src="https://www.google.com/maps/embed?pb=…"></iframe>', true]],
  },
];

function input([name, label, type, placeholder = '', full = false], value) {
  const id = `set-${name}`;
  const v = value ?? '';
  const control = type === 'textarea'
    ? `<textarea class="textarea" id="${id}" name="${name}" rows="3" placeholder="${esc(placeholder)}">${esc(v)}</textarea>`
    : `<input class="input" id="${id}" name="${name}" type="${type}" value="${esc(v)}" placeholder="${esc(placeholder || DEFAULT_SETTINGS[name] || '')}" ${type === 'number' ? 'min="0" step="1"' : ''}>`;
  return `<div class="field ${full ? 'full' : ''}"><label for="${id}">${esc(label)}</label>${control}</div>`;
}

export function renderSettings(container) {
  container.innerHTML = '<div class="loading-block"><div class="boot__spinner"></div></div>';
  const ref = doc(db, 'settings', 'site');

  (async () => {
    let data = {};
    try { data = (await getDoc(ref)).data() || {}; } catch (err) { toast(friendlyError(err), 'error'); }
    const values = { ...DEFAULT_SETTINGS, ...data };

    container.innerHTML = `
      <div class="page-head"><div><h1>Settings</h1><p>Update company details and site-wide content without touching code. Changes go live immediately.</p></div></div>
      <form class="card" data-form novalidate>
        ${SECTIONS.map((s) => `
          <section class="settings-section">
            <div><h2>${esc(s.title)}</h2><p>${esc(s.text)}</p></div>
            <div class="form-grid">${s.fields.map((f) => input(f, values[f[0]])).join('')}</div>
          </section>`).join('')}
        <div class="sticky-save">
          <span class="cell-muted" style="margin-right:auto;align-self:center" data-dirty></span>
          <button class="btn" type="submit" data-save>${icon('check')} Save settings</button>
        </div>
      </form>
      <section class="card" style="margin-top:18px">
        <div class="settings-section">
          <div><h2>SEO & sitemap</h2><p>The sitemap tells Google about every page, article and product on your website.</p></div>
          <div>
            <p style="margin-bottom:12px">After publishing new articles or equipment, download a fresh <strong>sitemap.xml</strong>, upload it to your website's main folder (replacing the old one), then click <em>Resubmit</em> in Google Search Console → Sitemaps.</p>
            <div style="display:flex;flex-wrap:wrap;gap:8px">
              <button class="btn" type="button" data-sitemap>${icon('download')} Download sitemap.xml</button>
              <a class="btn btn--secondary" href="https://search.google.com/search-console" target="_blank" rel="noopener">${icon('external')} Open Search Console</a>
            </div>
            <p class="field__help" data-sitemap-note style="margin-top:10px"></p>
          </div>
        </div>
      </section>
      <section class="card" style="margin-top:18px">
        <div class="settings-section">
          <div><h2>Account & security</h2><p>Signed in as <strong>${esc(auth.currentUser?.email || '')}</strong>.</p></div>
          <div>
            <p style="margin-bottom:12px">To change your password, we'll email you a secure reset link.</p>
            <button class="btn btn--secondary" type="button" data-reset>${icon('lock')} Send password reset email</button>
          </div>
        </div>
      </section>`;

    const form = $('[data-form]', container);
    const dirty = $('[data-dirty]', container);
    form.addEventListener('input', () => { dirty.textContent = 'You have unsaved changes'; });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const out = {};
      $$('[name]', form).forEach((el) => {
        out[el.name] = el.type === 'number' ? (el.value === '' ? null : Number(el.value)) : el.value.trim();
      });
      if (out.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(out.email)) return toast('Please enter a valid email address', 'error');
      const badUrl = ['facebook', 'linkedin', 'instagram', 'youtube'].find((k) => out[k] && !/^https?:\/\//i.test(out[k]));
      if (badUrl) return toast(`The ${badUrl} link must start with https://`, 'error');
      out.whatsapp = String(out.whatsapp || '').replace(/\D/g, '');
      const btn = $('[data-save]', container);
      setBusy(btn, true);
      try {
        await setDoc(ref, { ...out, updatedAt: serverTimestamp(), updatedBy: auth.currentUser?.email || '' }, { merge: true });
        toast('Settings saved — the website is updated');
        dirty.textContent = '';
      } catch (err) {
        toast(friendlyError(err), 'error', 7000);
      } finally { setBusy(btn, false); }
    });

    $('[data-sitemap]', container).addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      setBusy(btn, true, 'Building…');
      try {
        const { xml, count } = await buildSitemap();
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([xml], { type: 'application/xml' }));
        a.download = 'sitemap.xml';
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        $('[data-sitemap-note]', container).textContent = `sitemap.xml downloaded with ${count} pages. Upload it to the website root, e.g. ${SITE_URL}/sitemap.xml`;
      } catch (err) {
        toast(friendlyError(err), 'error');
      } finally { setBusy(btn, false); }
    });

    $('[data-reset]', container).addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      setBusy(btn, true, 'Sending…');
      try {
        await sendPasswordResetEmail(auth, auth.currentUser.email);
        toast(`Reset link sent to ${auth.currentUser.email}`);
      } catch (err) { toast(friendlyError(err), 'error'); } finally { setBusy(btn, false); }
    });
  })();

  return () => {};
}
