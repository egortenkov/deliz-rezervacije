// Deliz — aplikacija za osebje (iPad, PWA).

import { VENUE, STAFF, DEMO_PIN } from '../shared/config.js';
import {
  addDays, isOpen, timeSlots, nextOpenDays, freeTables, suggestTables, tableOptions,
  canBookWholeVenue, validateTables, occupancy,
} from '../shared/availability.js';
import { getAdapter } from '../shared/data/index.js';
import { Outbox } from '../shared/data/outbox.js';
import { uid } from '../shared/data/demo-adapter.js';
import {
  esc, icon, todayISO, dayLabel, longDate, shortDate, guestsWord, resWord, tablesLabel, tablesArea,
  timeAgo, dateStrip, calendarGrid, floorPlan, seatsLabel,
} from './ui.js';

const adapter = getAdapter();
const outbox = new Outbox(adapter);
const $app = document.getElementById('app');
const $modal = document.getElementById('modal-root');
const $toasts = document.getElementById('toast-root');

const NOTE_CHIPS = ['Rojstni dan', 'Degustacija', 'Otroški stol', 'Alergije', 'Želi teraso', 'Redni gost'];
const STATUS = {
  confirmed: { label: 'Potrjeno' },
  arrived: { label: 'Prišli' },
  noshow: { label: 'Niso prišli' },
  cancelled: { label: 'Preklicano' },
};

const store = {
  get(k, d = null) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* zasebno okno */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* */ } },
};

const firstOpen = () => nextOpenDays(todayISO(), 1, VENUE)[0] ?? todayISO();

const blankForm = (date = firstOpen()) => ({
  id: null, date, guests: 2, time: '', name: '', phone: '+386 ', note: '',
  tables: [], manual: false, wholeVenue: false, errors: {}, original: null,
});

const S = {
  user: store.get('deliz.user'),
  view: 'new',
  res: [],
  reqs: [],
  settings: { terraceOpen: true },
  form: blankForm(),
  day: firstOpen(),
  focus: null,
  modal: null,
  pin: { user: null, entry: '', error: false },
  loaded: false,
  knownPending: null,
};

// Rezervacije iz strežnika + neposlane iz lokalne vrste.
function allRes() {
  const queued = outbox.items().map((r) => ({ ...r, _unsent: true }));
  const ids = new Set(queued.map((r) => r.id));
  return [...S.res.filter((r) => !ids.has(r.id)), ...queued];
}

// ---------- podatki ----------

let lastSig = '';
let lastView = null;
async function refresh() {
  try {
    const t = todayISO();
    const [res, reqs, settings] = await Promise.all([
      adapter.listReservations(addDays(t, -7), addDays(t, 400)),
      adapter.listRequests(),
      adapter.getSettings(),
    ]);
    const sig = JSON.stringify([res, reqs, settings, outbox.items(), outbox.online]);
    S.res = res; S.reqs = reqs; S.settings = settings; S.loaded = true;
    checkNewRequests();
    if (sig !== lastSig) { lastSig = sig; render(); }
  } catch (e) {
    console.error(e);
    toast('Podatkov ni bilo mogoče naložiti', 'warn');
  }
}

function pending() {
  return S.reqs.filter((q) => q.status === 'pending').sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

function checkNewRequests() {
  const ids = pending().map((q) => q.id);
  if (S.knownPending) {
    const fresh = ids.filter((id) => !S.knownPending.has(id));
    if (fresh.length && S.user) {
      chime();
      const q = S.reqs.find((x) => x.id === fresh[0]);
      toast(`Nova spletna zahteva — ${esc(q.name)}, ${guestsWord(q.guests)}, ${shortDate(q.date)}`, 'info', {
        action: 'Odpri', act: 'nav', data: { view: 'requests' },
      });
    }
  }
  S.knownPending = new Set(ids);
}

// ---------- zvok ----------

let audio = null;
function unlockAudio() {
  if (audio) return;
  try { audio = new (window.AudioContext || window.webkitAudioContext)(); } catch { audio = null; }
}
function chime() {
  navigator.vibrate?.([80, 60, 80]);
  if (!audio) return;
  audio.resume?.();
  const now = audio.currentTime;
  [[784, 0], [1175, 0.16], [1568, 0.32]].forEach(([f, d]) => {
    const o = audio.createOscillator();
    const g = audio.createGain();
    o.type = 'sine';
    o.frequency.value = f;
    g.gain.setValueAtTime(0, now + d);
    g.gain.linearRampToValueAtTime(0.22, now + d + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, now + d + 0.9);
    o.connect(g).connect(audio.destination);
    o.start(now + d);
    o.stop(now + d + 1);
  });
}

// ---------- obvestila ----------

function toast(html, kind = 'info', opts = {}) {
  const el = document.createElement('div');
  el.className = `toast toast--${kind}`;
  el.innerHTML = `<span>${html}</span>${opts.action ? `<button class="toast-act" data-act="${opts.act}" ${Object.entries(opts.data || {}).map(([k, v]) => `data-${k}="${esc(v)}"`).join(' ')}>${opts.action}</button>` : ''}`;
  $toasts.appendChild(el);
  requestAnimationFrame(() => el.classList.add('is-in'));
  const close = () => { el.classList.remove('is-in'); setTimeout(() => el.remove(), 300); };
  el.addEventListener('click', close);
  setTimeout(close, opts.ms ?? 5000);
}

function savedOverlay(r, queued) {
  const el = document.createElement('div');
  el.className = `saved ${queued ? 'saved--queued' : ''}`;
  el.innerHTML = `
    <div class="saved-card">
      <div class="saved-ico">${icon(queued ? 'wifiOff' : 'check', 44)}</div>
      <div class="saved-title">${queued ? 'Shranjeno v napravi' : 'Rezervacija shranjena'}</div>
      <div class="saved-sub">${esc(r.name)} · ${guestsWord(r.guests)}</div>
      <div class="saved-sub">${longDate(r.date)}${r.time ? ` · ${r.time}` : ''} · ${r.wholeVenue ? 'vsa vinoteka' : tablesLabel(r.tables)}</div>
      ${queued ? '<div class="saved-note">Ni poslano — poslalo se bo samodejno, ko bo povezava.</div>' : ''}
    </div>`;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('is-in'));
  const close = () => { el.classList.remove('is-in'); setTimeout(() => el.remove(), 250); };
  el.addEventListener('click', close);
  setTimeout(close, 2400);
}

// ---------- izris ----------

function render() {
  // ohrani fokus in kurzor v polju, da osveževanje ne moti tipkanja
  const a = document.activeElement;
  const field = a?.dataset?.field;
  const sel = field && 'selectionStart' in a ? [a.selectionStart, a.selectionEnd] : null;

  if (!S.user) {
    $app.innerHTML = lockScreen();
  } else {
    if (S.view === 'new') syncSuggestion();
    const fresh = S.view !== lastView;
    lastView = S.view;
    $app.innerHTML = `${rail()}<main class="main view-${S.view} ${fresh ? 'is-new' : ''}">${S.loaded ? view() : '<div class="loading">Nalagam …</div>'}</main>`;
  }
  renderModal();

  if (field) {
    const el = $app.querySelector(`[data-field="${field}"]`) || $modal.querySelector(`[data-field="${field}"]`);
    if (el) { el.focus({ preventScroll: true }); if (sel) try { el.setSelectionRange(...sel); } catch { /* */ } }
  }
}

function view() {
  switch (S.view) {
    case 'today': return todayView();
    case 'requests': return requestsView();
    case 'settings': return settingsView();
    default: return newView();
  }
}

function rail() {
  const n = pending().length;
  const unsent = outbox.items().length;
  const item = (v, ic, label, badge = '') => `
    <button class="rail-btn ${S.view === v ? 'is-on' : ''}" data-act="nav" data-view="${v}" aria-current="${S.view === v}">
      ${icon(ic, 28)}<span>${label}</span>${badge}
    </button>`;
  return `
    <nav class="rail" aria-label="Glavni meni">
      <div class="brand"><img src="../shared/ui/deliz-logo.png" alt="Deliz"></div>
      ${item('new', 'plus', 'Nova')}
      ${item('today', 'list', 'Pregled')}
      ${item('requests', 'inbox', 'Zahteve', n ? `<span class="badge">${n}</span>` : '')}
      ${item('settings', 'gear', 'Nastavitve')}
      <div class="rail-foot">
        ${!outbox.online ? `<div class="net-off" title="Brez povezave">${icon('wifiOff', 22)}<span>brez povezave</span></div>` : ''}
        ${unsent ? `<div class="net-queue">${unsent} ni poslano</div>` : ''}
        <button class="avatar" data-act="nav" data-view="settings" aria-label="Oseba: ${esc(S.user.name)}">${esc(S.user.name[0])}</button>
      </div>
    </nav>`;
}

// ---------- prijava ----------

function lockScreen() {
  const p = S.pin;
  if (!p.user) {
    return `
      <div class="lock">
        <div class="lock-brand"><img src="../shared/ui/deliz-logo.png" alt="Deliz"><span class="caps">Rezervacije</span></div>
        <h1 class="lock-q">Kdo dela danes?</h1>
        <div class="lock-people">
          ${STAFF.map((s) => `<button class="person" data-act="pick-user" data-id="${s.id}"><span class="person-i">${s.name[0]}</span>${s.name}</button>`).join('')}
        </div>
        <p class="lock-hint">Izbira se zapomni na tej napravi.</p>
      </div>`;
  }
  const dots = [0, 1, 2, 3].map((i) => `<span class="dot ${i < p.entry.length ? 'is-on' : ''}"></span>`).join('');
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'back', '0', 'ok'];
  return `
    <div class="lock">
      <div class="lock-brand"><img src="../shared/ui/deliz-logo.png" alt="Deliz"><span class="caps">Rezervacije</span></div>
      <h1 class="lock-q">Živjo, ${esc(STAFF.find((s) => s.id === p.user).name)}</h1>
      <p class="lock-hint">Vnesi PIN <span class="demo-tag">demo: ${DEMO_PIN}</span></p>
      <div class="dots ${p.error ? 'is-err' : ''}">${dots}</div>
      <div class="pinpad">
        ${keys.map((k) => k === 'back'
          ? `<button class="pin-key pin-key--ghost" data-act="pin-back" aria-label="Nazaj">${icon('chevL', 28)}</button>`
          : k === 'ok'
            ? `<button class="pin-key pin-key--ghost" data-act="pin-cancel">Druga oseba</button>`
            : `<button class="pin-key" data-act="pin-key" data-k="${k}">${k}</button>`).join('')}
      </div>
    </div>`;
}

// ---------- NOVA REZERVACIJA ----------

function syncSuggestion() {
  const f = S.form;
  if (f.wholeVenue || f.manual) return;
  const opt = suggestTables(f.guests, f.date, allRes(), VENUE, S.settings, { excludeId: f.id });
  f.tables = opt ? opt.tables : [];
}

function freeCount(iso) {
  const occ = occupancy(iso, allRes());
  if (occ.wholeVenue) return 'zasedeno';
  const n = freeTables(iso, allRes(), VENUE, S.settings).length;
  return n ? `${n} prostih` : 'polno';
}

function newView() {
  const f = S.form;
  const slots = timeSlots(f.date, VENUE);
  const guestBtns = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) =>
    `<button class="num ${f.guests === n ? 'is-on' : ''}" data-act="set-guests" data-n="${n}" aria-pressed="${f.guests === n}">${n}</button>`).join('');
  const big = f.guests > 10;

  let tableCard;
  if (f.wholeVenue) {
    tableCard = `<div class="tcard tcard--whole">${icon('glass', 28)}<div><b>Vsa vinoteka</b><small>vse mize ${dayLabel(f.date).toLowerCase()}</small></div></div>`;
  } else if (f.tables.length) {
    tableCard = `<div class="tcard">${icon('table', 28)}<div><b>${tablesLabel(f.tables)}</b><small>${tablesArea(f.tables)} · ${seatsLabel(f.tables)}${f.manual ? ' · ročno' : ' · samodejno'}</small></div></div>`;
  } else {
    tableCard = `<div class="tcard tcard--none">${icon('x', 28)}<div><b>Ni proste mize</b><small>za ${guestsWord(f.guests)} — izberi ročno ali drug dan</small></div></div>`;
  }
  const canWhole = canBookWholeVenue(f.date, allRes(), VENUE, { excludeId: f.id });

  return `
    <header class="vhead">
      <h1 class="vtitle">${f.id ? 'Urejanje rezervacije' : 'Nova rezervacija'}</h1>
      <div class="vhead-right">
        ${f.id ? `<button class="btn btn--ghost" data-act="cancel-edit">${icon('x', 20)} Prekliči urejanje</button>` : ''}
        <span class="vdate">${longDate(f.date)}</span>
      </div>
    </header>

    <section class="blk blk--dates">
      ${dateStrip(f.date, 'form-date', { counts: freeCount })}
    </section>

    <div class="newgrid">
      <div class="col">
        <section class="blk">
          <h2 class="lbl">Število gostov</h2>
          <div class="nums">${guestBtns}
            <button class="num num--plus ${big ? 'is-on' : ''}" data-act="guests-more">${big ? f.guests : '+'}</button>
          </div>
        </section>
        <section class="blk">
          <h2 class="lbl">Prihod <span class="lbl-note">orientacijsko</span></h2>
          <div class="times">
            ${slots.map((s) => `<button class="time ${f.time === s ? 'is-on' : ''}" data-act="set-time" data-t="${s}">${s.replace(':00', '')}<small>:00</small></button>`).join('') || '<p class="muted">Zaprto</p>'}
          </div>
        </section>
        <section class="blk">
          <h2 class="lbl">Miza</h2>
          <div class="trow">
            ${tableCard}
            <button class="btn btn--line" data-act="open-tables" ${f.wholeVenue ? 'disabled' : ''}>Spremeni</button>
            <button class="btn btn--line ${f.wholeVenue ? 'is-on' : ''}" data-act="toggle-whole" ${!canWhole && !f.wholeVenue ? 'disabled' : ''}
              title="${canWhole ? '' : 'Ta dan že ima rezervacije'}">Vsa vinoteka</button>
          </div>
        </section>
      </div>

      <div class="col">
        <section class="blk">
          <div class="frow">
            <label class="fld fld--grow ${f.errors.name ? 'is-err' : ''}">
              <span class="lbl">Ime in priimek</span>
              <input data-field="name" value="${esc(f.name)}" autocomplete="off" autocapitalize="words" enterkeyhint="next" placeholder="npr. Ana Novak">
            </label>
            <label class="fld fld--phone">
              <span class="lbl">Telefon</span>
              <input data-field="phone" value="${esc(f.phone)}" inputmode="tel" type="tel" autocomplete="off" enterkeyhint="next">
            </label>
          </div>
          ${f.errors.name ? `<div class="err">${f.errors.name}</div>` : ''}
        </section>
        <section class="blk">
          <label class="fld">
            <span class="lbl">Opomba</span>
            <input data-field="note" value="${esc(f.note)}" autocomplete="off" enterkeyhint="done" placeholder="Posebne želje …">
          </label>
          <div class="chips">
            ${NOTE_CHIPS.map((c) => `<button class="chip ${f.note.includes(c) ? 'is-on' : ''}" data-act="note-chip" data-c="${c}">${c}</button>`).join('')}
          </div>
        </section>
        ${f.errors.tables ? `<div class="err err--box">${f.errors.tables}</div>` : ''}
        <button class="save" data-act="save">${icon('check', 30)} ${f.id ? 'Shrani spremembe' : 'Shrani'}</button>
      </div>
    </div>`;
}

async function saveForm() {
  const f = S.form;
  f.errors = {};
  const name = f.name.trim();
  if (!name) f.errors.name = 'Vpiši ime gosta.';
  const res = allRes();
  if (f.wholeVenue) {
    if (!canBookWholeVenue(f.date, res, VENUE, { excludeId: f.id })) f.errors.tables = 'Ta dan že ima rezervacije — vse vinoteke ni mogoče rezervirati.';
  } else {
    const v = validateTables(f.tables, f.guests, f.date, res, VENUE, S.settings, { excludeId: f.id });
    if (!v.ok) {
      f.errors.tables = v.error === 'taken' ? `${tablesLabel(v.tables)} je že zasedena ta dan.` :
        v.error === 'closed' ? 'Ta dan je vinoteka zaprta.' : 'Ni izbrane mize — izberi mizo ali drug dan.';
    }
  }
  if (Object.keys(f.errors).length) { render(); return; }

  const o = f.original || {};
  const phone = f.phone.trim() === '+386' ? '' : f.phone.trim();
  const r = {
    ...o,
    id: f.id || uid(), date: f.date, time: f.time, guests: f.guests, name, phone, note: f.note.trim(),
    tables: f.wholeVenue ? [] : f.tables, wholeVenue: f.wholeVenue,
    status: o.status || 'confirmed', source: o.source || 'staff', createdBy: o.createdBy || S.user.id,
    updatedBy: S.user.id,
  };
  delete r._unsent;
  const { queued } = await outbox.saveReservation(r);
  savedOverlay(r, queued);
  const wasEdit = !!f.id;
  S.form = blankForm(wasEdit ? firstOpen() : f.date);
  if (wasEdit) { S.view = 'today'; S.day = r.date; S.focus = r.id; }
  await refresh();
  render();
}

function editReservation(id) {
  const r = allRes().find((x) => x.id === id);
  if (!r) return;
  S.form = {
    id: r.id, date: r.date, guests: r.guests, time: r.time || '', name: r.name, phone: r.phone || '+386 ',
    note: r.note || '', tables: [...(r.tables || [])], manual: true, wholeVenue: !!r.wholeVenue, errors: {}, original: r,
  };
  S.view = 'new';
  render();
}

// ---------- PREGLED DNEVA ----------

function todayView() {
  const res = allRes().filter((r) => r.date === S.day)
    .sort((a, b) => (a.status === 'cancelled') - (b.status === 'cancelled') || (a.time || '99').localeCompare(b.time || '99'));
  const active = res.filter((r) => r.status !== 'cancelled' && r.status !== 'noshow');
  const guests = active.reduce((s, r) => s + r.guests, 0);
  const free = freeTables(S.day, allRes(), VENUE, S.settings).length;

  const card = (r) => {
    const st = r.status;
    const sb = (s, label, ic) => `<button class="st st--${s} ${st === s ? 'is-on' : ''}" data-act="status" data-id="${r.id}" data-s="${s}" aria-pressed="${st === s}">${icon(ic, 22)}<span>${label}</span></button>`;
    return `
      <article class="rcard st-${st} ${S.focus === r.id ? 'is-focus' : ''}" id="r-${r.id}">
        <button class="rcard-main" data-act="edit" data-id="${r.id}" aria-label="Uredi ${esc(r.name)}">
          <span class="rc-time">${r.time || '—'}</span>
          <span class="rc-body">
            <span class="rc-name">${esc(r.name)}
              ${r.source === 'web' ? '<span class="tag">splet</span>' : ''}
              ${r._unsent ? `<span class="tag tag--warn">${icon('wifiOff', 14)} ni poslano</span>` : ''}
              ${st !== 'confirmed' ? `<span class="tag tag--${st}">${STATUS[st].label}</span>` : ''}
            </span>
            <span class="rc-meta">${guestsWord(r.guests)} · ${r.wholeVenue ? 'vsa vinoteka' : tablesLabel(r.tables)}${r.phone ? ` · ${esc(r.phone)}` : ''}</span>
            ${r.note ? `<span class="rc-note">${esc(r.note)}</span>` : ''}
          </span>
          <span class="rc-edit">${icon('edit', 20)}</span>
        </button>
        <div class="rc-actions">
          ${sb('arrived', 'Prišli', 'check')}
          ${sb('noshow', 'Niso prišli', 'clock')}
          ${sb('cancelled', 'Preklic', 'x')}
        </div>
      </article>`;
  };

  return `
    <header class="vhead">
      <h1 class="vtitle">${dayLabel(S.day)} <span class="vtitle-sub">${longDate(S.day)}</span></h1>
      <div class="stats">
        <span><b>${active.length}</b> ${resWord(active.length).replace(/^\d+ /, '')}</span>
        <span><b>${guests}</b> ${guestsWord(guests).replace(/^\d+ /, '')}</span>
        <span><b>${free}</b> prostih miz</span>
      </div>
    </header>
    <section class="blk blk--dates">${dateStrip(S.day, 'day-date', { counts: (iso) => { const n = allRes().filter((r) => r.date === iso && r.status !== 'cancelled').length; return n ? `${n} rez.` : '—'; } })}</section>
    <div class="daygrid">
      <section class="rlist" aria-label="Rezervacije">
        ${res.length ? res.map(card).join('') : `<div class="empty">${icon('glass', 40)}<p>Za ta dan še ni rezervacij.</p><button class="btn btn--wine" data-act="new-for-day">${icon('plus', 20)} Nova rezervacija</button></div>`}
      </section>
      <section class="floorwrap" aria-label="Shema miz">
        ${floorPlan(S.day, allRes(), S.settings, { highlight: S.focus })}
        <div class="legend"><span class="lg lg--free"></span>prosto <span class="lg lg--busy"></span>zasedeno <span class="legend-tip">Tapni prosto mizo za novo rezervacijo</span></div>
      </section>
    </div>`;
}

async function changeStatus(id, s) {
  const r = allRes().find((x) => x.id === id);
  if (!r) return;
  const next = r.status === s ? 'confirmed' : s;
  if (r._unsent || !outbox.online) {
    const { _unsent, ...clean } = r;
    await outbox.saveReservation({ ...clean, status: next, updatedBy: S.user.id });
  } else {
    await adapter.setStatus(id, next, S.user.id);
  }
  S.focus = id;
  if (next === 'cancelled') {
    toast(`Preklicano: ${esc(r.name)}`, 'info', { action: 'Razveljavi', act: 'status', data: { id, s: 'cancelled' } });
  }
  await refresh();
}

// ---------- SPLETNE ZAHTEVE ----------

const LANG = { sl: 'SL', en: 'EN', de: 'DE', it: 'IT' };

function requestsView() {
  const list = pending();
  const done = S.reqs.filter((q) => q.status !== 'pending').sort((a, b) => (b.handledAt || '').localeCompare(a.handledAt || '')).slice(0, 8);
  const card = (q) => {
    const opt = suggestTables(q.guests, q.date, allRes(), VENUE, S.settings);
    return `
      <article class="qcard">
        <div class="qc-head">
          <div>
            <div class="qc-name">${esc(q.name)} <span class="tag">${LANG[q.lang] || q.lang}</span></div>
            <div class="qc-when">${dayLabel(q.date)}, ${shortDate(q.date)} · ${q.time || 'brez ure'} · <b>${guestsWord(q.guests)}</b></div>
          </div>
          <span class="qc-ago">${timeAgo(q.createdAt)}</span>
        </div>
        <div class="qc-contact">
          ${q.phone ? `<a href="tel:${esc(q.phone.replace(/\s/g, ''))}">${icon('phone', 18)} ${esc(q.phone)}</a>` : ''}
          ${q.email ? `<a href="mailto:${esc(q.email)}">${icon('mail', 18)} ${esc(q.email)}</a>` : ''}
        </div>
        ${q.note ? `<p class="qc-note">„${esc(q.note)}“</p>` : ''}
        <div class="qc-foot">
          <span class="qc-fit ${opt ? '' : 'is-none'}">${opt ? `Predlog: ${tablesLabel(opt.tables)} (${seatsLabel(opt.tables)})` : 'Ni proste mize ta dan'}</span>
          <div class="qc-btns">
            <button class="btn btn--line btn--lg" data-act="req-reject" data-id="${q.id}">${icon('x', 22)} Zavrni</button>
            <button class="btn btn--ok btn--lg" data-act="req-confirm" data-id="${q.id}" ${opt ? '' : 'disabled'}>${icon('check', 22)} Potrdi</button>
          </div>
        </div>
      </article>`;
  };
  return `
    <header class="vhead">
      <h1 class="vtitle">Spletne zahteve ${list.length ? `<span class="count">${list.length}</span>` : ''}</h1>
      <button class="btn btn--line" data-act="demo-request">${icon('plus', 20)} Testna zahteva</button>
    </header>
    <div class="qlist">
      ${list.length ? list.map(card).join('') : `<div class="empty">${icon('inbox', 40)}<p>Ni novih zahtev. Ko gost odda obrazec na spletni strani, se prikaže tukaj — z zvokom.</p></div>`}
    </div>
    ${done.length ? `
      <h2 class="lbl lbl--section">Obdelane</h2>
      <div class="donelist">${done.map((q) => `
        <div class="done done--${q.status}">
          <span>${q.status === 'confirmed' ? icon('check', 18) : icon('x', 18)}</span>
          <span class="done-name">${esc(q.name)}</span>
          <span>${shortDate(q.date)} · ${guestsWord(q.guests)}</span>
          <span class="muted">${q.status === 'confirmed' ? 'potrdil' : 'zavrnil'} ${esc(STAFF.find((s) => s.id === q.handledBy)?.name || '')} ${q.handledAt ? timeAgo(q.handledAt) : ''}</span>
        </div>`).join('')}
      </div>` : ''}`;
}

// ---------- NASTAVITVE ----------

function settingsView() {
  const sw = (act, on, title, sub) => `
    <button class="setting" data-act="${act}" role="switch" aria-checked="${on}">
      <span><b>${title}</b><small>${sub}</small></span>
      <span class="switch ${on ? 'is-on' : ''}"><span></span></span>
    </button>`;
  return `
    <header class="vhead"><h1 class="vtitle">Nastavitve</h1></header>
    <div class="settings">
      <section class="sgroup">
        <h2 class="lbl lbl--section">Lokal</h2>
        ${sw('toggle-terrace', S.settings.terraceOpen !== false, 'Terasa odprta', 'Ko je izklopljeno, terasnih miz ni mogoče rezervirati — ne osebje ne gostje.')}
      </section>
      <section class="sgroup">
        <h2 class="lbl lbl--section">Oseba</h2>
        <div class="setting setting--static">
          <span class="person-i person-i--sm">${esc(S.user.name[0])}</span>
          <span><b>${esc(S.user.name)}</b><small>Prijavljen na tej napravi</small></span>
          <button class="btn btn--line" data-act="logout">${icon('logout', 20)} Zamenjaj osebo</button>
        </div>
      </section>
      <section class="sgroup">
        <h2 class="lbl lbl--section">Demo</h2>
        ${sw('toggle-offline', outbox.simulateOffline, 'Simuliraj brez povezave', 'Nove rezervacije gredo v čakalno vrsto z oznako «ni poslano».')}
        <div class="setting setting--static">
          <span><b>Obrazec za goste</b><small>Zahteve iz obrazca se na tej napravi takoj pojavijo pod «Zahteve».</small></span>
          <a class="btn btn--line" href="../guest/" target="_blank" rel="noopener">${icon('globe', 20)} Odpri</a>
        </div>
        <div class="setting setting--static">
          <span><b>Ponastavi demo podatke</b><small>Znova ustvari rezervacije za naslednja 2 tedna.</small></span>
          <button class="btn btn--line" data-act="reset-demo">Ponastavi</button>
        </div>
      </section>
      <section class="sgroup">
        <h2 class="lbl lbl--section">Namestitev na iPad</h2>
        <p class="help">V Safariju tapni <b>Deli</b> → <b>Dodaj na začetni zaslon</b>. Aplikacija se nato odpre kot samostojna, brez naslovne vrstice.</p>
        <p class="help muted">Podatki: ${adapter.name === 'demo' ? 'demo način (shranjeno samo v tej napravi)' : 'Google Sheets'} · različica 0.1</p>
      </section>
    </div>`;
}

// ---------- modalna okna ----------

function renderModal() {
  const m = S.modal;
  if (!m) { $modal.innerHTML = ''; return; }
  let body = '';
  if (m.type === 'calendar') {
    const selected = m.target === 'form-date' ? S.form.date : S.day;
    body = `<div class="sheet sheet--cal">${calendarGrid(m.month, selected, m.target, { minIso: m.target === 'form-date' ? todayISO() : null })}
      <button class="btn btn--line btn--block" data-act="close-modal">Zapri</button></div>`;
  } else if (m.type === 'guests') {
    const nums = Array.from({ length: 30 }, (_, i) => i + 11);
    body = `<div class="sheet">
      <h2 class="sheet-title">Večja skupina</h2>
      <div class="nums nums--grid">${nums.map((n) => `<button class="num ${S.form.guests === n ? 'is-on' : ''}" data-act="set-guests" data-n="${n}">${n}</button>`).join('')}</div>
      <p class="help muted">Za več kot ${Math.max(...VENUE.combinations.map((c) => c.seats))} gostov izberi «Vsa vinoteka».</p>
      <button class="btn btn--line btn--block" data-act="close-modal">Zapri</button></div>`;
  } else if (m.type === 'tables') {
    const res = allRes();
    const free = freeTables(m.date, res, VENUE, S.settings, { excludeId: m.excludeId });
    const opts = tableOptions(m.guests, free, VENUE).slice(0, 5);
    const v = m.selected.length ? validateTables(m.selected, m.guests, m.date, res, VENUE, S.settings, { excludeId: m.excludeId }) : null;
    const req = m.reqId ? S.reqs.find((q) => q.id === m.reqId) : null;
    body = `<div class="sheet sheet--wide">
      <div class="sheet-head">
        <div>
          <h2 class="sheet-title">${req ? `Potrdi zahtevo — ${esc(req.name)}` : 'Izberi mizo'}</h2>
          <p class="muted">${longDate(m.date)} · ${guestsWord(m.guests)} · tapni eno ali več prostih miz</p>
        </div>
        <button class="icon-btn" data-act="close-modal" aria-label="Zapri">${icon('x', 26)}</button>
      </div>
      ${opts.length ? `<div class="chips">${opts.map((o) => `<button class="chip ${o.tables.join() === m.selected.join() ? 'is-on' : ''}" data-act="pick-option" data-tables="${o.tables.join(',')}">${tablesLabel(o.tables)} · ${o.seats}</button>`).join('')}</div>` : ''}
      ${floorPlan(m.date, res, S.settings, { mode: 'pick', selected: m.selected, excludeId: m.excludeId })}
      <div class="sheet-foot">
        <span class="${v?.warning ? 'warn-text' : 'muted'}">${m.selected.length ? `${tablesLabel(m.selected)} · ${seatsLabel(m.selected)}${v?.warning ? ' — premalo mest za to skupino' : ''}` : 'Nobena miza ni izbrana'}</span>
        <div class="qc-btns">
          ${!req ? '<button class="btn btn--line btn--lg" data-act="tables-auto">Samodejno</button>' : ''}
          <button class="btn ${req ? 'btn--ok' : 'btn--wine'} btn--lg" data-act="tables-ok" ${m.selected.length ? '' : 'disabled'}>${icon('check', 22)} ${req ? 'Potrdi rezervacijo' : 'Izberi'}</button>
        </div>
      </div>
    </div>`;
  }
  const fresh = !$modal.firstElementChild;
  $modal.innerHTML = `<div class="modal ${fresh ? 'is-new' : ''}" data-act="backdrop">${body}</div>`;
}

// ---------- dejanja ----------

const actions = {
  'pick-user': ({ id }) => { unlockAudio(); S.pin = { user: id, entry: '', error: false }; },
  'pin-key': ({ k }) => {
    unlockAudio();
    const p = S.pin;
    if (p.entry.length >= 4) return;
    p.entry += k; p.error = false;
    if (p.entry.length === 4) {
      if (p.entry === DEMO_PIN) {
        const s = STAFF.find((x) => x.id === p.user);
        S.user = { id: s.id, name: s.name };
        store.set('deliz.user', S.user);
        S.pin = { user: null, entry: '', error: false };
        S.knownPending = null;
        refresh();
      } else {
        p.error = true; p.entry = '';
        navigator.vibrate?.(200);
      }
    }
  },
  'pin-back': () => { S.pin.entry = S.pin.entry.slice(0, -1); },
  'pin-cancel': () => { S.pin = { user: null, entry: '', error: false }; },
  logout: () => { store.del('deliz.user'); S.user = null; },

  nav: ({ view }) => { S.view = view; S.modal = null; S.focus = null; window.scrollTo(0, 0); },

  'form-date': ({ date }) => { S.form.date = date; S.form.manual = false; S.form.time = ''; S.form.errors = {}; if (S.form.wholeVenue && !canBookWholeVenue(date, allRes(), VENUE, { excludeId: S.form.id })) S.form.wholeVenue = false; S.modal = null; },
  'day-date': ({ date }) => { S.day = date; S.focus = null; S.modal = null; },
  'open-calendar': ({ target }) => { const sel = target === 'form-date' ? S.form.date : S.day; S.modal = { type: 'calendar', target, month: sel }; },
  'cal-month': ({ month }) => { S.modal.month = month; },
  'close-modal': () => { S.modal = null; },
  backdrop: (_, el, e) => { if (e.target === el) S.modal = null; else return false; },

  'set-guests': ({ n }) => { S.form.guests = Number(n); S.form.manual = false; S.form.errors = {}; if (S.modal?.type === 'guests') S.modal = null; },
  'guests-more': () => { S.modal = { type: 'guests' }; },
  'set-time': ({ t }) => { S.form.time = S.form.time === t ? '' : t; },
  'note-chip': ({ c }) => {
    const f = S.form;
    const parts = f.note.split(',').map((s) => s.trim()).filter(Boolean);
    f.note = (parts.includes(c) ? parts.filter((p) => p !== c) : [...parts, c]).join(', ');
  },
  'toggle-whole': () => {
    const f = S.form;
    f.wholeVenue = !f.wholeVenue;
    f.manual = false; f.errors = {};
    if (f.wholeVenue) f.tables = [];
  },
  'open-tables': () => {
    const f = S.form;
    S.modal = { type: 'tables', ctx: 'form', date: f.date, guests: f.guests, excludeId: f.id, selected: [...f.tables] };
  },
  'pick-table': ({ table }) => {
    const m = S.modal;
    m.selected = m.selected.includes(table) ? m.selected.filter((t) => t !== table) : [...m.selected, table];
    const order = VENUE.tables.map((t) => t.id);
    m.selected.sort((a, b) => order.indexOf(a) - order.indexOf(b));
  },
  'pick-option': ({ tables }) => { S.modal.selected = tables.split(','); },
  'tables-auto': () => { S.form.manual = false; S.form.errors = {}; S.modal = null; },
  'tables-ok': async () => {
    const m = S.modal;
    if (m.ctx === 'request') {
      if (!outbox.online) { toast('Brez povezave — zahtevo potrdi, ko bo povezava.', 'warn'); return; }
      const { reservation } = await adapter.confirmRequest(m.reqId, m.selected, S.user.id);
      S.modal = null;
      toast(`${icon('check', 18)} Potrjeno: ${esc(reservation.name)} · ${tablesLabel(reservation.tables)} · ${shortDate(reservation.date)}`, 'ok');
      await refresh();
    } else {
      Object.assign(S.form, { tables: m.selected, manual: true, wholeVenue: false, errors: {} });
      S.modal = null;
    }
  },
  save: () => saveForm(),
  'cancel-edit': () => { S.form = blankForm(); S.view = 'today'; },

  edit: ({ id }) => editReservation(id),
  status: ({ id, s }) => changeStatus(id, s),
  'focus-res': ({ id }) => {
    S.focus = id;
    render();
    document.getElementById(`r-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return false;
  },
  'new-at-table': ({ table }) => {
    S.form = { ...blankForm(S.day), tables: [table], manual: true };
    S.view = 'new';
  },
  'new-for-day': () => { S.form = blankForm(S.day); S.view = 'new'; },

  'req-confirm': ({ id }) => {
    const q = S.reqs.find((x) => x.id === id);
    const opt = suggestTables(q.guests, q.date, allRes(), VENUE, S.settings);
    S.modal = { type: 'tables', ctx: 'request', reqId: id, date: q.date, guests: q.guests, selected: opt ? opt.tables : [] };
  },
  'req-reject': async ({ id }) => {
    if (!outbox.online) { toast('Brez povezave — poskusi znova, ko bo povezava.', 'warn'); return false; }
    const q = await adapter.rejectRequest(id, S.user.id);
    toast(`Zavrnjeno: ${esc(q.name)}`, 'info');
    await refresh();
  },
  'demo-request': async () => {
    const names = [['Sophie Martin', 'en'], ['Jana Kranjc', 'sl'], ['Marco Ferrari', 'it'], ['Anna Huber', 'de'], ['Peter Zajc', 'sl']];
    const [name, lang] = names[Math.floor(Math.random() * names.length)];
    const guests = [2, 2, 3, 4, 6][Math.floor(Math.random() * 5)];
    const days = nextOpenDays(addDays(todayISO(), 1), 6, VENUE);
    const date = days[Math.floor(Math.random() * days.length)];
    const slots = timeSlots(date, VENUE);
    await adapter.createRequest({ date, time: slots[Math.min(3, slots.length - 1)], guests, name, phone: '+386 41 222 333',
      email: `${name.split(' ')[0].toLowerCase()}@example.com`, note: '', lang, consent: true });
    await refresh();
    return false;
  },

  'toggle-terrace': async () => {
    const on = S.settings.terraceOpen === false;
    S.settings = await adapter.saveSettings({ terraceOpen: on });
    toast(on ? 'Terasa je odprta.' : 'Terasa je zaprta — terasnih miz ni mogoče rezervirati.', 'info');
  },
  'toggle-offline': () => { outbox.simulateOffline = !outbox.simulateOffline; },
  'reset-demo': async () => {
    if (!confirm('Ponastavim demo podatke? Vse spremembe bodo izgubljene.')) return false;
    await adapter.reset?.();
    store.del('deliz.outbox.v1');
    S.knownPending = null;
    await refresh();
    toast('Demo podatki ponastavljeni.', 'ok');
  },
};

document.addEventListener('click', async (e) => {
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  const fn = actions[el.dataset.act];
  if (!fn) return;
  const result = await fn({ ...el.dataset }, el, e);
  if (result !== false) render();
});

document.addEventListener('input', (e) => {
  const f = e.target.dataset?.field;
  if (!f) return;
  S.form[f] = e.target.value;
  if (f === 'name' && S.form.errors.name) { delete S.form.errors.name; e.target.closest('.fld')?.classList.remove('is-err'); }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && S.modal) { S.modal = null; render(); }
  if (e.key === 'Enter' && e.target.dataset?.field === 'note') e.target.blur();
});

// ---------- zagon ----------

outbox.onChange(() => refresh());
window.addEventListener('online', () => { refresh(); toast('Povezava je spet vzpostavljena.', 'ok'); });
window.addEventListener('offline', () => render());
adapter.subscribe(() => refresh());
setInterval(refresh, 15000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

render();
refresh();
