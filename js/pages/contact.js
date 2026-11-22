import '../site.js';
import { useData } from '../lib/store.js';
import { createDocument } from '../lib/firestore-rest.js';
import { $, $$ } from '../lib/dom.js';

const form = $('#contact-form');
const success = $('#form-success');
const failure = $('#form-error');
const submitBtn = $('#contact-submit');
const COOLDOWN_MS = 30_000;

/* Prefill subject from ?subject= (equipment / training "Get a quote" links) */
const params = new URLSearchParams(location.search);
const presetSubject = params.get('subject') || params.get('inquiry');
if (presetSubject) $('#subject').value = presetSubject.slice(0, 150);

const rules = {
  name: (v) => (v.length >= 2 ? '' : 'Please enter your name.'),
  email: (v) => (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? '' : 'Please enter a valid email address.'),
  phone: (v) => (!v || /^[+\d][\d\s()-]{6,19}$/.test(v) ? '' : 'Please enter a valid phone number.'),
  subject: (v) => (v.length >= 3 ? '' : 'Please add a short subject.'),
  message: (v) => (v.length >= 10 ? '' : 'Please write at least a few words (10+ characters).'),
};

function validateField(input) {
  const rule = rules[input.name];
  if (!rule) return true;
  const msg = rule(input.value.trim());
  const field = input.closest('.field');
  field.classList.toggle('has-error', Boolean(msg));
  input.setAttribute('aria-invalid', String(Boolean(msg)));
  field.querySelector('.field__error').textContent = msg;
  return !msg;
}

$$('input, textarea', form).forEach((input) => {
  input.addEventListener('blur', () => { if (input.value) validateField(input); });
  input.addEventListener('input', () => { if (input.closest('.field')?.classList.contains('has-error')) validateField(input); });
});

function setLoading(on) {
  submitBtn.disabled = on;
  submitBtn.innerHTML = on ? '<span class="spinner" aria-hidden="true"></span> Sending…' : submitBtn.dataset.label;
}
submitBtn.dataset.label = submitBtn.innerHTML;

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  success.hidden = true;
  failure.hidden = true;

  const inputs = $$('input[name], textarea[name]', form).filter((i) => rules[i.name]);
  const valid = inputs.map(validateField).every(Boolean);
  if (!valid) { form.querySelector('[aria-invalid="true"]')?.focus(); return; }

  // Spam protection: honeypot + client-side cooldown
  if (form.website.value) { success.hidden = false; form.reset(); return; }
  const last = Number(localStorage.getItem('fmz:lastContact') || 0);
  if (Date.now() - last < COOLDOWN_MS) {
    failure.textContent = 'You just sent a message — please wait a moment before sending another.';
    failure.hidden = false;
    return;
  }

  const data = Object.fromEntries(inputs.map((i) => [i.name, i.value.trim()]));
  setLoading(true);
  try {
    await createDocument('contacts', {
      ...data,
      status: 'new',
      source: 'website',
      createdAt: new Date(),
    });
    try { localStorage.setItem('fmz:lastContact', String(Date.now())); } catch { /* ignore */ }
    form.reset();
    success.hidden = false;
    success.scrollIntoView({ behavior: 'smooth', block: 'center' });
  } catch (err) {
    console.error(err);
    failure.textContent = 'Sorry, your message could not be sent. Please try again, or reach us by phone or WhatsApp.';
    failure.hidden = false;
  } finally {
    setLoading(false);
  }
});

/* Google Map embed managed from admin settings */
function mapSrc(value) {
  const v = String(value || '').trim();
  const m = v.match(/src=["']([^"']+)["']/);
  const url = m ? m[1] : v;
  return /^https:\/\/(www\.)?google\.[a-z.]+\/maps\/embed/.test(url) ? url : '';
}
useData({ settings: 'doc:settings/site' }, ({ settings }) => {
  const src = mapSrc(settings?.mapEmbed);
  const section = $('#map-section');
  section.hidden = !src;
  if (src) {
    const frame = $('#map-frame');
    if (frame.src !== src) frame.src = src;
  }
});
