/** Site settings: contact details, social links, homepage stats, announcement, map. */
import { db, auth, doc, getDoc, setDoc, serverTimestamp, sendPasswordResetEmail } from './firebase.js';
import { esc, icon, $, $$, toast, setBusy, friendlyError } from './ui.js';
import { DEFAULT_SETTINGS } from '../../js/config.js';

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
