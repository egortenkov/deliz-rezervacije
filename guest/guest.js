// Deliz — spletni obrazec za goste (samostojna stran ali vdelano v WordPress prek embed.js).

import { VENUE } from '../shared/config.js';
import { toISODate, parseISODate, timeSlots } from '../shared/availability.js';
import { getAdapter } from '../shared/data/index.js';
import { T, LANGS } from './i18n.js';
import { setThemePref, currentTheme } from '../shared/ui/theme.js';

const adapter = getAdapter();
const $g = document.getElementById('g');
const params = new URLSearchParams(location.search);
const embedded = params.has('embed');
if (embedded) document.documentElement.classList.add('is-embed');

const SUN = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
const MOON = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>';
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function initialLang() {
  const q = params.get('lang');
  if (LANGS.includes(q)) return q;
  const nav = (navigator.language || 'sl').slice(0, 2);
  return LANGS.includes(nav) ? nav : 'sl';
}

const S = {
  lang: initialLang(),
  step: 0, // 0 gostje, 1 datum, 2 ura, 3 podatki, 4 poslano
  guests: null, date: null, time: null,
  name: '', phone: '+386 ', email: '', note: '', consent: false,
  dates: null, errors: {}, sending: false,
};

const t = () => T[S.lang];
const locale = () => ({ sl: 'sl-SI', en: 'en-GB', de: 'de-DE', it: 'it-IT' })[S.lang];
const fmt = (iso, opts) => new Intl.DateTimeFormat(locale(), opts).format(parseISODate(iso));

function summary() {
  const parts = [];
  if (S.guests) parts.push(`<button class="sum-chip" data-act="goto" data-step="0">${t().guests(S.guests)}</button>`);
  if (S.date && S.step > 1) parts.push(`<button class="sum-chip" data-act="goto" data-step="1">${fmt(S.date, { weekday: 'short', day: 'numeric', month: 'short' })}</button>`);
  if (S.time && S.step > 2) parts.push(`<button class="sum-chip" data-act="goto" data-step="2">${S.time}</button>`);
  return parts.length && S.step < 4 ? `<div class="sum">${parts.join('')}</div>` : '';
}

function stepGuests() {
  const nums = Array.from({ length: VENUE.guestMaxParty }, (_, i) => i + 1);
  return `
    <h2 class="q">${t().guestsQ}</h2>
    <div class="grid grid--guests">${nums.map((n) => `<button class="opt opt--num ${S.guests === n ? 'is-on' : ''}" data-act="guests" data-n="${n}">${n}</button>`).join('')}</div>
    <p class="note">${t().more(VENUE.guestMaxParty, VENUE.phone)}</p>`;
}

function stepDate() {
  if (!S.dates) return `<h2 class="q">${t().dateQ}</h2><div class="spinner" aria-label="…"></div>`;
  if (!S.dates.length) return `<h2 class="q">${t().dateQ}</h2><p class="empty">${t().noDates}</p><p class="note"><a href="tel:${VENUE.phone.replace(/\s/g, '')}">${VENUE.phone}</a></p>`;
  const byMonth = {};
  for (const d of S.dates) (byMonth[d.slice(0, 7)] ??= []).push(d);
  return `
    <h2 class="q">${t().dateQ}</h2>
    <p class="note">${t().dateNote}</p>
    ${Object.entries(byMonth).map(([m, days]) => `
      <div class="month">${fmt(`${m}-01`, { month: 'long', year: 'numeric' })}</div>
      <div class="grid grid--dates">
        ${days.map((d) => `
          <button class="opt opt--date ${S.date === d ? 'is-on' : ''}" data-act="date" data-d="${d}">
            <span class="od-wd">${fmt(d, { weekday: 'short' })}</span>
            <span class="od-day">${parseISODate(d).getDate()}</span>
          </button>`).join('')}
      </div>`).join('')}`;
}

function stepTime() {
  const slots = timeSlots(S.date, VENUE);
  return `
    <h2 class="q">${t().timeQ}</h2>
    <p class="note">${t().timeNote}</p>
    <div class="grid grid--times">${slots.map((s) => `<button class="opt opt--time ${S.time === s ? 'is-on' : ''}" data-act="time" data-t="${s}">${s}</button>`).join('')}</div>`;
}

function stepContact() {
  const e = S.errors;
  const f = (key, label, attrs = '') => `
    <label class="fld ${e[key] ? 'is-err' : ''}">
      <span>${label}</span>
      <input data-field="${key}" value="${esc(S[key])}" ${attrs}>
      ${e[key] ? `<em>${e[key]}</em>` : ''}
    </label>`;
  return `
    <h2 class="q">${t().contactQ}</h2>
    <form class="form" data-form novalidate>
      ${f('name', t().name, 'autocomplete="name" autocapitalize="words" required')}
      <div class="form-row">
        ${f('phone', t().phone, 'type="tel" inputmode="tel" autocomplete="tel" required')}
        ${f('email', t().email, 'type="email" inputmode="email" autocomplete="email" required')}
      </div>
      <label class="fld"><span>${t().note}</span><textarea data-field="note" rows="2" placeholder="${t().notePh}">${esc(S.note)}</textarea></label>
      <label class="consent ${e.consent ? 'is-err' : ''}">
        <input type="checkbox" data-field="consent" ${S.consent ? 'checked' : ''}>
        <span>${t().consent}</span>
      </label>
      ${e.consent ? `<em class="err">${e.consent}</em>` : ''}
      ${e.send ? `<em class="err">${e.send}</em>` : ''}
      <button class="send" type="submit" ${S.sending ? 'disabled' : ''}>${t().send}</button>
    </form>`;
}

function stepSent() {
  return `
    <div class="sent">
      <div class="sent-ico"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div>
      <h2 class="q">${t().sentT}</h2>
      <p class="sent-sum">${t().guests(S.guests)} · ${fmt(S.date, { weekday: 'long', day: 'numeric', month: 'long' })} · ${S.time}</p>
      <p class="note">${t().sentP}</p>
      <button class="link" data-act="again">${t().again}</button>
    </div>`;
}

let lastStep = null;
function render() {
  const steps = t().steps;
  const body = [stepGuests, stepDate, stepTime, stepContact, stepSent][S.step]();
  document.documentElement.lang = S.lang;
  $g.innerHTML = `
    <div class="card">
      <header class="head">
        <nav class="langs" aria-label="Language">
          ${LANGS.map((l) => `<button class="lang ${S.lang === l ? 'is-on' : ''}" data-act="lang" data-l="${l}" aria-pressed="${S.lang === l}">${l.toUpperCase()}</button>`).join('<span class="lang-sep" aria-hidden="true">|</span>')}
          <span class="lang-sep" aria-hidden="true">|</span>
          <button class="lang theme-btn" data-act="theme" aria-label="${currentTheme() === 'dark' ? 'Light theme' : 'Dark theme'}">${currentTheme() === 'dark' ? SUN : MOON}</button>
        </nav>
        <div class="glow" aria-hidden="true"></div>
        <h1 class="logo"><img src="../shared/ui/deliz-logo.png" alt="Deliz"></h1>
      </header>
      ${S.step < 4 ? `
        <div class="intro">
          <h2 class="title">${t().title}</h2>
          <p class="lead">${t().lead}</p>
        </div>
        <ol class="progress">${steps.map((s, i) => `<li class="${i < S.step ? 'is-done' : i === S.step ? 'is-on' : ''}"><span>${i + 1}</span>${s}</li>`).join('')}</ol>
        ${summary()}` : ''}
      <section class="step ${S.step !== lastStep ? 'is-new' : ''}" aria-live="polite">${body}</section>
      ${S.step > 0 && S.step < 4 ? `<button class="back" data-act="back">← ${t().back}</button>` : ''}
    </div>
    ${embedded ? '' : `<footer class="foot">
      <p>PE Deliz vino &amp; delikatesa</p><p>Vodnikov trg 4</p><p>SI-2000 Maribor</p>
    </footer>`}`;
  lastStep = S.step;
  postHeight();
}

async function loadDates() {
  S.dates = null;
  render();
  S.dates = await adapter.publicAvailability(S.guests, toISODate(new Date()), VENUE.guestBookingDays);
  render();
}

function validate() {
  const e = {};
  if (!S.name.trim()) e.name = t().required;
  if (S.phone.replace(/[^\d]/g, '').length < 7) e.phone = t().required;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(S.email.trim())) e.email = S.email.trim() ? t().badEmail : t().required;
  if (!S.consent) e.consent = t().needConsent;
  S.errors = e;
  return !Object.keys(e).length;
}

async function send() {
  if (!validate()) { render(); $g.querySelector('.is-err input')?.focus(); return; }
  S.sending = true; render();
  try {
    await adapter.createRequest({
      date: S.date, time: S.time, guests: S.guests, name: S.name.trim(), phone: S.phone.trim(),
      email: S.email.trim(), note: S.note.trim(), lang: S.lang, consent: true,
    });
    S.step = 4;
  } catch (err) {
    console.error(err);
    S.errors = { send: t().error };
  }
  S.sending = false;
  render();
  if (!embedded) window.scrollTo({ top: 0, behavior: 'smooth' });
}

const actions = {
  lang: ({ l }) => { S.lang = l; S.errors = {}; },
  theme: () => { setThemePref(currentTheme() === 'dark' ? 'light' : 'dark', { persist: !embedded }); },
  guests: ({ n }) => { S.guests = Number(n); S.date = null; S.time = null; S.step = 1; loadDates(); return false; },
  date: ({ d }) => { S.date = d; S.time = null; S.step = 2; },
  time: ({ t: time }) => { S.time = time; S.step = 3; },
  goto: ({ step }) => { S.step = Number(step); if (S.step === 1 && !S.dates) { loadDates(); return false; } },
  back: () => { S.step -= 1; S.errors = {}; },
  again: () => { Object.assign(S, { step: 0, guests: null, date: null, time: null, note: '', consent: false, dates: null, errors: {} }); },
};

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  if (actions[el.dataset.act]({ ...el.dataset }) !== false) render();
});
document.addEventListener('input', (e) => {
  const f = e.target.dataset?.field;
  if (!f) return;
  S[f] = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
});
document.addEventListener('submit', (e) => { e.preventDefault(); send(); });

// Vdelava: sporoči višino staršu (embed.js), da iframe nima drsnika.
function postHeight() {
  if (!embedded || window.parent === window) return;
  requestAnimationFrame(() => window.parent.postMessage({ type: 'deliz:height', height: $g.offsetHeight + 2 }, '*'));
}
window.addEventListener('resize', postHeight);
matchMedia('(prefers-color-scheme: light)').addEventListener?.('change', () => render());

render();
