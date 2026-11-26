/**
 * Client review page (review.html?t=<token>).
 * The admin creates a secret, time-limited link in the dashboard; the client
 * opens it here and submits a review, which waits in the dashboard until the
 * admin chooses to show it on the website.
 */
import '../site.js';
import { getDocument, createDocument } from '../lib/firestore-rest.js';
import { processAndUpload } from '../lib/upload.js';
import { $, $$, esc, icon } from '../lib/dom.js';

const root = $('#review-root');
const token = (new URLSearchParams(location.search).get('t') || '').trim();
const TOKEN_OK = /^[A-Za-z0-9_-]{16,64}$/.test(token);
const doneKey = `fmz:review:${token}`;

let link = null;
let timer = null;

/* ---------- Helpers ---------- */
const fmtDate = (ms) => new Date(ms).toLocaleString('en-GB', {
  weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true,
});

function timeLeft(ms) {
  const diff = ms - Date.now();
  if (diff <= 0) return '';
  const mins = Math.floor(diff / 60000);
  const days = Math.floor(mins / 1440);
  const hours = Math.floor((mins % 1440) / 60);
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
  if (days >= 1) return `${plural(days, 'day')}${hours ? ` ${plural(hours, 'hour')}` : ''} left`;
  if (hours >= 1) return `${plural(hours, 'hour')} ${plural(mins % 60, 'minute')} left`;
  return mins >= 1 ? `${plural(mins, 'minute')} left` : 'less than a minute left';
}

function stored(fn) { try { return fn(); } catch { return null; } }

function stateCard({ iconName, tone = 'info', title, text, actions = true }) {
  clearInterval(timer);
  root.innerHTML = `
    <div class="review-state review-state--${tone}">
      <span class="review-state__icon">${icon(iconName)}</span>
      <h2>${esc(title)}</h2>
      <p>${text}</p>
      ${actions ? `<div class="review-state__actions">
        <a class="btn" href="index.html">Visit our website</a>
        <a class="btn btn--outline" href="contact.html">Contact us</a>
      </div>` : ''}
    </div>`;
  root.focus?.();
}

const showInvalid = () => stateCard({
  iconName: 'alert', tone: 'error', title: 'This link is not valid',
  text: 'Please check that you opened the complete link we sent you, or ask us for a new one.',
});
const showDisabled = () => stateCard({
  iconName: 'lock', tone: 'error', title: 'This link is no longer active',
  text: 'This review link has been closed. If you would still like to share feedback, please contact us and we will send you a new link.',
});
const showExpired = () => stateCard({
  iconName: 'clock', tone: 'error', title: 'This link has expired',
  text: `This review link expired on <strong>${esc(fmtDate(link.expiresAt))}</strong>. Please contact us if you would like a new link.`,
});
const showDone = (name) => stateCard({
  iconName: 'check-circle', tone: 'success', title: `Thank you${name ? `, ${esc(name.split(' ')[0])}` : ''}!`,
  text: 'Your review has been received. We really appreciate you taking the time to share your experience with FMZ Fire &amp; Safety Engineering.',
});
const showAlreadySent = () => stateCard({
  iconName: 'check-circle', tone: 'success', title: 'Review already received',
  text: 'A review has already been submitted with this link. Thank you! If you need to change something, please contact us.',
});

/* ---------- Expiry banner (live countdown) ---------- */
function updateExpiry() {
  const banner = $('[data-expiry]', root);
  if (!banner || !link) return;
  if (Date.now() >= link.expiresAt) { showExpired(); return; }
  $('[data-expiry-left]', banner).textContent = timeLeft(link.expiresAt);
  banner.classList.toggle('is-soon', link.expiresAt - Date.now() < 24 * 3600 * 1000);
}

/* ---------- Form ---------- */
function renderForm() {
  const greet = link.clientName ? `Hi ${esc(link.clientName)}, how did we do?` : 'How did we do?';
  root.innerHTML = `
    <div class="review-expiry" data-expiry>
      ${icon('clock')}
      <span>This link is valid until <strong>${esc(fmtDate(link.expiresAt))}</strong> <span class="review-expiry__left" data-expiry-left></span></span>
    </div>
    <h2 class="review-title">${greet}</h2>
    ${link.message ? `<p class="review-note">${esc(link.message)}</p>` : '<p class="review-note">Please tell us about your experience with our training, equipment or services. It only takes a minute.</p>'}
    <p style="color:var(--muted);font-size:.9rem">Fields marked <span style="color:var(--brand)">*</span> are required.</p>
    <div class="alert alert--error" id="review-error" role="alert" hidden></div>
    <form id="review-form" novalidate>
      <div class="form-grid">
        <fieldset class="field field--full star-field">
          <legend>Your rating <span>*</span></legend>
          <div class="star-picker">
            ${[5, 4, 3, 2, 1].map((n) => `
              <input type="radio" id="star-${n}" name="rating" value="${n}" ${n === 5 ? 'checked' : ''}>
              <label for="star-${n}" title="${n} star${n > 1 ? 's' : ''}">${icon('star-fill')}<span class="sr-only">${n} star${n > 1 ? 's' : ''}</span></label>`).join('')}
          </div>
          <span class="star-picker__text" data-rating-text>Excellent</span>
        </fieldset>
        <div class="field field--full"><label for="quote">Your review <span>*</span></label>
          <textarea class="input" id="quote" name="quote" rows="5" maxlength="600" required placeholder="What did you like about working with FMZ? How did the training or equipment help your team?"></textarea>
          <div class="review-counter"><span data-count>0</span> / 600</div>
          <div class="field__error"></div></div>
        <div class="field"><label for="name">Your name <span>*</span></label><input class="input" id="name" name="name" autocomplete="name" maxlength="80" required><div class="field__error"></div></div>
        <div class="field"><label for="company">Company / organisation</label><input class="input" id="company" name="company" autocomplete="organization" maxlength="100"><div class="field__error"></div></div>
        <div class="field"><label for="role">Job title</label><input class="input" id="role" name="role" autocomplete="organization-title" maxlength="80" placeholder="e.g. HSE Manager"><div class="field__error"></div></div>
        <div class="field"><label for="email">Email <small>(not shown publicly)</small></label><input class="input" id="email" name="email" type="email" autocomplete="email" maxlength="150"><div class="field__error"></div></div>
        <div class="field field--full"><span class="field__label">Your photo <small>(optional)</small></span>
          <div class="review-photo">
            <span class="review-photo__preview" data-photo-preview>${icon('image')}</span>
            <div>
              <label class="btn btn--outline btn--sm review-photo__btn">${icon('upload')} <span data-photo-label>Choose photo</span>
                <input type="file" accept="image/*" data-photo hidden></label>
              <button type="button" class="link-btn" data-photo-remove hidden>Remove</button>
              <div class="review-photo__status" data-photo-status>A square photo or your company logo works best.</div>
            </div>
          </div></div>
        <div class="field field--full"><label class="check-row"><input type="checkbox" name="consent" id="consent" required>
          <span>I agree that FMZ Fire &amp; Safety Engineering may show my review, name, company and photo on its website. <span>*</span></span></label>
          <div class="field__error"></div></div>
        <div class="hp-field" aria-hidden="true"><label for="website">Website</label><input id="website" name="website" tabindex="-1" autocomplete="off"></div>
        <div class="field--full"><button class="btn btn--lg btn--block" id="review-submit" type="submit">${icon('send')} Submit review</button></div>
      </div>
    </form>`;

  if (link.clientName && !/\s(ltd|limited|pvt|company|co\.?|inc|group|bank|industries)\b/i.test(` ${link.clientName}`)) {
    $('#name', root).value = link.clientName;
  } else if (link.clientName) {
    $('#company', root).value = link.clientName;
  }

  wireForm();
  updateExpiry();
  clearInterval(timer);
  timer = setInterval(updateExpiry, 30_000);
}

const RATING_TEXT = { 5: 'Excellent', 4: 'Very good', 3: 'Good', 2: 'Fair', 1: 'Poor' };

const rules = {
  name: (v) => (v.length >= 2 ? '' : 'Please enter your name.'),
  email: (v) => (!v || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? '' : 'Please enter a valid email address, or leave it empty.'),
  quote: (v) => (v.length >= 10 ? '' : 'Please write at least a sentence (10+ characters).'),
  consent: (_, el) => (el.checked ? '' : 'Please tick this box so we can show your review.'),
};

function validate(input) {
  const rule = rules[input.name];
  if (!rule) return true;
  const msg = rule(input.value.trim(), input);
  const field = input.closest('.field');
  field.classList.toggle('has-error', Boolean(msg));
  input.setAttribute('aria-invalid', String(Boolean(msg)));
  field.querySelector('.field__error').textContent = msg;
  return !msg;
}

function wireForm() {
  const form = $('#review-form', root);
  const errorBox = $('#review-error', root);
  const submit = $('#review-submit', root);
  const quote = $('#quote', root);
  let imageUrl = '';
  let uploading = false;

  $$('input[name="rating"]', form).forEach((r) => r.addEventListener('change', () => {
    $('[data-rating-text]', form).textContent = RATING_TEXT[r.value];
  }));
  quote.addEventListener('input', () => { $('[data-count]', form).textContent = quote.value.length; });

  $$('input[name], textarea[name]', form).forEach((input) => {
    if (!rules[input.name]) return;
    const evt = input.type === 'checkbox' ? 'change' : 'blur';
    input.addEventListener(evt, () => { if (input.type === 'checkbox' || input.value) validate(input); });
    input.addEventListener('input', () => { if (input.closest('.field')?.classList.contains('has-error')) validate(input); });
  });

  /* Optional photo */
  const fileInput = $('[data-photo]', form);
  const preview = $('[data-photo-preview]', form);
  const status = $('[data-photo-status]', form);
  const removeBtn = $('[data-photo-remove]', form);
  const resetPhoto = () => {
    imageUrl = '';
    preview.innerHTML = icon('image');
    removeBtn.hidden = true;
    $('[data-photo-label]', form).textContent = 'Choose photo';
    status.textContent = 'A square photo or your company logo works best.';
    status.classList.remove('is-error');
  };
  removeBtn.addEventListener('click', resetPhoto);
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    fileInput.value = '';
    if (!file) return;
    uploading = true;
    submit.disabled = true;
    status.classList.remove('is-error');
    status.textContent = 'Uploading… 0%';
    preview.innerHTML = `<img src="${URL.createObjectURL(file)}" alt="">`;
    try {
      imageUrl = await processAndUpload(file, { maxWidth: 400, quality: 0.85 }, (p) => { status.textContent = `Uploading… ${Math.round(p * 100)}%`; });
      status.textContent = 'Photo added.';
      removeBtn.hidden = false;
      $('[data-photo-label]', form).textContent = 'Change photo';
    } catch (err) {
      console.error(err);
      resetPhoto();
      status.textContent = 'Sorry, that photo could not be uploaded. You can submit your review without it.';
      status.classList.add('is-error');
    } finally {
      uploading = false;
      submit.disabled = false;
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorBox.hidden = true;
    if (uploading) return;
    if (Date.now() >= link.expiresAt) { showExpired(); return; }

    const inputs = $$('input[name], textarea[name]', form).filter((i) => rules[i.name]);
    if (!inputs.map(validate).every(Boolean)) { form.querySelector('[aria-invalid="true"]')?.focus(); return; }

    const val = (n) => form.elements[n].value.trim();
    if (val('website')) { showDone(val('name')); return; } // honeypot

    const data = {
      linkId: token,
      name: val('name'),
      rating: Number(form.querySelector('input[name="rating"]:checked')?.value || 5),
      quote: val('quote'),
      consent: true,
      status: 'new',
      createdAt: new Date(),
    };
    ['company', 'role', 'email'].forEach((k) => { if (val(k)) data[k] = val(k); });
    if (imageUrl) data.imageUrl = imageUrl;

    submit.disabled = true;
    const label = submit.innerHTML;
    submit.innerHTML = '<span class="spinner" aria-hidden="true"></span> Sending…';
    try {
      await createDocument('reviewSubmissions', data, link.singleUse ? token : undefined);
      if (link.singleUse) stored(() => localStorage.setItem(doneKey, '1'));
      showDone(data.name);
    } catch (err) {
      if (err.status !== 409 && err.status !== 403) console.error(err);
      if (err.status === 409) { stored(() => localStorage.setItem(doneKey, '1')); showAlreadySent(); return; }
      if (err.status === 403) {
        // Rejected by the rules: most likely the link was closed or expired meanwhile.
        const fresh = await getDocument(`reviewLinks/${token}`).catch(() => null);
        if (!fresh) { showInvalid(); return; }
        link = fresh;
        if (link.active === false) { showDisabled(); return; }
        if (Date.now() >= link.expiresAt) { showExpired(); return; }
      }
      errorBox.textContent = 'Sorry, your review could not be sent. Please check your connection and try again.';
      errorBox.hidden = false;
      submit.disabled = false;
      submit.innerHTML = label;
    }
  });
}

/* ---------- Boot ---------- */
(async () => {
  if (!TOKEN_OK) { showInvalid(); return; }
  try {
    link = await getDocument(`reviewLinks/${token}`);
  } catch (err) {
    console.error(err);
    stateCard({
      iconName: 'alert', tone: 'error', title: 'We could not open this link',
      text: 'Please check your internet connection and refresh the page.', actions: false,
    });
    return;
  }
  if (!link || !Number.isFinite(link.expiresAt)) { showInvalid(); return; }
  if (link.active === false) { showDisabled(); return; }
  if (link.singleUse && stored(() => localStorage.getItem(doneKey))) { showAlreadySent(); return; }
  if (Date.now() >= link.expiresAt) { showExpired(); return; }
  renderForm();
})();
