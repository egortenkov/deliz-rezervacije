/**
 * Deliz — rezervacije: strežnik (Google Apps Script + Google Sheets).
 *
 * Namestitev (enkrat):
 *   1. Odpri preglednico «Deliz · Rezervacije» → Razširitve → Apps Script, prilepi Code.gs in Config.gs.
 *   2. Zaženi funkcijo setup() — ustvari liste in osebje (Gleb, Franc, PIN 1234 — takoj spremenite!).
 *   3. Uvedi → Nova uvedba → Spletna aplikacija: «Izvedi kot: jaz», «Dostop: Vsi».
 *   4. URL …/exec vpiši v shared/data/index.js (APPS_SCRIPT_URL) in nastavi DATA_ADAPTER = 'appsscript'.
 *
 * Neobvezno (Project Settings → Script properties):
 *   STAFF_EMAIL      komu pošljemo obvestilo o novi spletni zahtevi (privzeto lastnik skripte)
 *   TELEGRAM_TOKEN   žeton Telegram bota
 *   TELEGRAM_CHAT    chat_id skupine/osebe, kamor bot pošilja
 *
 * PIN spremenite s funkcijo setPin('gleb', '4821') v urejevalniku.
 * Pogodba API: docs/API.md.
 */

const SHEETS = {
  Reservations: ['id', 'date', 'time', 'guests', 'name', 'phone', 'note', 'tables', 'wholeVenue', 'status', 'source',
    'requestId', 'createdBy', 'createdAt', 'updatedBy', 'updatedAt'],
  Requests: ['id', 'date', 'time', 'guests', 'name', 'phone', 'email', 'note', 'lang', 'consent', 'status',
    'createdAt', 'handledBy', 'handledAt', 'reservationId'],
  Settings: ['key', 'value'],
  Staff: ['id', 'name', 'pinHash'],
};
const NUM = { guests: true };
const BOOL = { wholeVenue: true, consent: true };
const LIST = { tables: true };
const TOKEN_DAYS = 30;
const STATUSES = ['confirmed', 'arrived', 'noshow', 'cancelled'];

// ======================= vstop =======================

function doPost(e) {
  let body;
  try { body = JSON.parse(e.postData.contents); } catch (err) { return out_({ ok: false, error: 'Neveljaven zahtevek' }); }
  try {
    const fn = ACTIONS[body.action];
    if (!fn) return out_({ ok: false, error: 'Neznana akcija: ' + body.action });
    if (!PUBLIC[body.action]) requireStaff_(body.token);
    return out_({ ok: true, result: fn(body) });
  } catch (err) {
    console.error(body.action, err);
    return out_({ ok: false, error: String(err.message || err) });
  }
}

function doGet() {
  return out_({ ok: true, result: 'Deliz rezervacije — API deluje. Uporabite POST.' });
}

function out_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

const PUBLIC = { login: true, publicAvailability: true, createRequest: true };

const ACTIONS = {
  login: (b) => login_(b.staffId, b.pin),
  listReservations: (b) => readAll_('Reservations').filter((r) => r.date >= b.from && r.date <= b.to),
  saveReservation: (b) => withLock_(() => saveReservation_(b.reservation)),
  setStatus: (b) => withLock_(() => setStatus_(b.id, b.status, b.by)),
  listRequests: () => readAll_('Requests'),
  confirmRequest: (b) => withLock_(() => confirmRequest_(b.id, b.tables, b.by)),
  rejectRequest: (b) => withLock_(() => rejectRequest_(b.id, b.by)),
  getSettings: () => getSettings_(),
  saveSettings: (b) => withLock_(() => saveSettings_(b.settings || {})),
  publicAvailability: (b) => publicAvailability_(Number(b.guests), b.from, Math.min(Number(b.days) || 30, 60)),
  createRequest: (b) => withLock_(() => createRequest_(b.request || {})),
};

// ======================= osebje =======================

function login_(staffId, pin) {
  const s = readAll_('Staff').find((x) => x.id === staffId);
  if (!s || !pin || hash_(String(pin)) !== s.pinHash) throw new Error('Napačen PIN');
  const token = Utilities.getUuid();
  const exp = Date.now() + TOKEN_DAYS * 864e5;
  PropertiesService.getScriptProperties().setProperty('tok_' + token, JSON.stringify({ staffId, exp }));
  return { token, staff: { id: s.id, name: s.name } };
}

function requireStaff_(token) {
  if (!token) throw new Error('Prijava potrebna');
  const raw = PropertiesService.getScriptProperties().getProperty('tok_' + token);
  if (!raw) throw new Error('Prijava potrebna');
  const t = JSON.parse(raw);
  if (t.exp < Date.now()) {
    PropertiesService.getScriptProperties().deleteProperty('tok_' + token);
    throw new Error('Prijava potekla');
  }
  return t.staffId;
}

function hash_(s) {
  const salt = PropertiesService.getScriptProperties().getProperty('PIN_SALT') || '';
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + s, Utilities.Charset.UTF_8);
  return bytes.map((b) => ('0' + (b & 0xff).toString(16)).slice(-2)).join('');
}

/** Ročno v urejevalniku: setPin('gleb', '4821') */
function setPin(staffId, pin) {
  if (!/^\d{4}$/.test(String(pin))) throw new Error('PIN mora imeti 4 števke');
  const rows = readAll_('Staff');
  const s = rows.find((x) => x.id === staffId);
  if (!s) throw new Error('Ni osebe ' + staffId);
  s.pinHash = hash_(String(pin));
  upsert_('Staff', s);
  return 'PIN za ' + s.name + ' spremenjen';
}

// ======================= rezervacije =======================

function saveReservation_(r) {
  if (!r || !r.id || !r.date) throw new Error('Manjkajo podatki rezervacije');
  const all = readAll_('Reservations');
  const prev = all.find((x) => x.id === r.id);
  const now = new Date().toISOString();
  const row = Object.assign({}, prev || {}, r, {
    tables: r.wholeVenue ? [] : (r.tables || []),
    wholeVenue: !!r.wholeVenue,
    status: STATUSES.indexOf(r.status) >= 0 ? r.status : 'confirmed',
    source: r.source || (prev && prev.source) || 'staff',
    createdAt: (prev && prev.createdAt) || r.createdAt || now,
    updatedAt: now,
  });
  if (isBlocking_(row)) assertFree_(row, all, getSettings_());
  upsert_('Reservations', row);
  return row;
}

function setStatus_(id, status, by) {
  if (STATUSES.indexOf(status) < 0) throw new Error('Neveljaven status');
  const all = readAll_('Reservations');
  const r = all.find((x) => x.id === id);
  if (!r) throw new Error('Rezervacija ne obstaja');
  const next = Object.assign({}, r, { status, updatedBy: by || '', updatedAt: new Date().toISOString() });
  if (isBlocking_(next) && !isBlocking_(r)) assertFree_(next, all, getSettings_());
  upsert_('Reservations', next);
  return next;
}

// Mize so lahko zasedle vmes (drug iPad) — preverimo znova na strežniku.
function assertFree_(r, all, settings) {
  if (!isOpen_(r.date)) throw new Error('Ta dan je vinoteka zaprta');
  const occ = occupancy_(r.date, all, r.id);
  if (r.wholeVenue) {
    if (occ.wholeVenue || Object.keys(occ.byTable).length) throw new Error('Ta dan so nekatere mize že zasedene');
    return;
  }
  if (occ.wholeVenue) throw new Error('Ta dan je rezervirana vsa vinoteka');
  const terraceOpen = settings.terraceOpen !== false;
  const taken = (r.tables || []).filter((id) => {
    const t = VENUE.tables.find((x) => x.id === id);
    return !t || occ.byTable[id] || (!terraceOpen && t.area === 'terrace');
  });
  if (taken.length) throw new Error('Mize ' + taken.join(', ') + ' so medtem že zasedene');
}

// ======================= spletne zahteve =======================

function createRequest_(q) {
  if (q.website) return { id: 'ok', status: 'pending' };          // honeypot: robot
  if (q.consent !== true) throw new Error('Manjka soglasje');
  const guests = Number(q.guests);
  if (!(guests >= 1 && guests <= VENUE.guestMaxParty)) throw new Error('Neveljavno število gostov');
  if (!q.name || !q.phone || !/^\d{4}-\d{2}-\d{2}$/.test(q.date || '')) throw new Error('Manjkajo podatki');
  const today = todayIso_();
  if (q.date < today || q.date > addDays_(today, VENUE.guestBookingDays)) throw new Error('Datum ni na voljo');

  // največ 3 zahteve na telefon v 24 urah
  const cache = CacheService.getScriptCache();
  const key = 'rl_' + String(q.phone).replace(/\D/g, '');
  const n = Number(cache.get(key) || 0);
  if (n >= 3) throw new Error('Preveč zahtev — pokličite nas');
  cache.put(key, String(n + 1), 86400);

  const reservations = readAll_('Reservations');
  const requests = readAll_('Requests');
  if (!isDateAvailable_(guests, q.date, reservations, requests, getSettings_())) throw new Error('Ta dan ni več prostih miz');

  const req = {
    id: Utilities.getUuid(), date: q.date, time: q.time || '', guests, name: clip_(q.name, 80), phone: clip_(q.phone, 30),
    email: clip_(q.email || '', 120), note: clip_(q.note || '', 500), lang: ['sl', 'en', 'de', 'it'].indexOf(q.lang) >= 0 ? q.lang : 'sl',
    consent: true, status: 'pending', createdAt: new Date().toISOString(), handledBy: '', handledAt: '', reservationId: '',
  };
  upsert_('Requests', req);
  notifyStaff_(req);
  return { id: req.id, date: req.date, time: req.time, guests: req.guests, status: req.status };
}

function confirmRequest_(id, tables, by) {
  const requests = readAll_('Requests');
  const q = requests.find((x) => x.id === id);
  if (!q) throw new Error('Zahteva ne obstaja');
  if (q.status !== 'pending') throw new Error('Zahteva je že obdelana');
  const now = new Date().toISOString();
  const reservation = saveReservation_({
    id: Utilities.getUuid(), date: q.date, time: q.time, guests: q.guests, name: q.name, phone: q.phone,
    note: [q.note, q.email].filter(String).join(' · '), tables: tables || [], wholeVenue: false,
    status: 'confirmed', source: 'web', requestId: q.id, createdBy: by || '', createdAt: now,
  });
  Object.assign(q, { status: 'confirmed', handledBy: by || '', handledAt: now, reservationId: reservation.id });
  upsert_('Requests', q);
  mailGuest_(q, true);
  return { request: q, reservation };
}

function rejectRequest_(id, by) {
  const q = readAll_('Requests').find((x) => x.id === id);
  if (!q) throw new Error('Zahteva ne obstaja');
  Object.assign(q, { status: 'rejected', handledBy: by || '', handledAt: new Date().toISOString() });
  upsert_('Requests', q);
  mailGuest_(q, false);
  return q;
}

function publicAvailability_(guests, from, days) {
  const reservations = readAll_('Reservations');
  const requests = readAll_('Requests');
  const settings = getSettings_();
  const start = from && from > todayIso_() ? from : todayIso_();
  const outDates = [];
  for (let i = 0; i < days; i++) {
    const iso = addDays_(start, i);
    if (isDateAvailable_(guests, iso, reservations, requests, settings)) outDates.push(iso);
  }
  return outDates;
}

// ======================= nastavitve =======================

function getSettings_() {
  const s = { terraceOpen: true };
  readAll_('Settings').forEach((r) => { s[r.key] = r.value === 'TRUE' || r.value === true ? true : r.value === 'FALSE' || r.value === false ? false : r.value; });
  return s;
}

function saveSettings_(patch) {
  Object.keys(patch).forEach((k) => upsert_('Settings', { key: k, value: typeof patch[k] === 'boolean' ? (patch[k] ? 'TRUE' : 'FALSE') : String(patch[k]) }, 'key'));
  return getSettings_();
}

// ======================= obvestila =======================

function notifyStaff_(q) {
  const text = 'Nova spletna zahteva — Deliz\n' + q.name + ', ' + q.guests + ' os.\n' + q.date + (q.time ? ' ob ' + q.time : '') +
    '\nTel: ' + q.phone + (q.email ? '\nE-pošta: ' + q.email : '') + (q.note ? '\nOpomba: ' + q.note : '') +
    '\n\nPotrdite v aplikaciji (Zahteve).';
  const p = PropertiesService.getScriptProperties();
  try {
    const to = p.getProperty('STAFF_EMAIL') || Session.getEffectiveUser().getEmail();
    if (to) MailApp.sendEmail(to, 'Deliz: nova zahteva — ' + q.name + ', ' + q.date, text);
  } catch (e) { console.warn('email', e); }
  const tok = p.getProperty('TELEGRAM_TOKEN'), chat = p.getProperty('TELEGRAM_CHAT');
  if (tok && chat) {
    try {
      UrlFetchApp.fetch('https://api.telegram.org/bot' + tok + '/sendMessage', {
        method: 'post', contentType: 'application/json', muteHttpExceptions: true,
        payload: JSON.stringify({ chat_id: chat, text }),
      });
    } catch (e) { console.warn('telegram', e); }
  }
}

const GUEST_MAIL = {
  sl: { ok: ['Rezervacija potrjena', 'Pozdravljeni {name},\n\nvaša rezervacija v vinoteki Deliz je potrjena: {date}{time}, {guests} os.\n\nVeselimo se vašega obiska!\nDeliz, Vodnikov trg 4, Maribor'],
        no: ['Rezervacija ni mogoča', 'Pozdravljeni {name},\n\nžal za {date} nimamo prostega mesta za {guests} os. Pokličite nas in poiskali bomo drug termin.\n\nDeliz, Vodnikov trg 4, Maribor'] },
  en: { ok: ['Booking confirmed', 'Hello {name},\n\nyour table at Deliz wine bar is confirmed: {date}{time}, {guests} guests.\n\nWe look forward to seeing you!\nDeliz, Vodnikov trg 4, Maribor'],
        no: ['Booking not possible', 'Hello {name},\n\nunfortunately we have no table for {guests} on {date}. Please call us and we will find another time.\n\nDeliz, Vodnikov trg 4, Maribor'] },
  de: { ok: ['Reservierung bestätigt', 'Hallo {name},\n\nIhre Reservierung in der Vinothek Deliz ist bestätigt: {date}{time}, {guests} Personen.\n\nWir freuen uns auf Ihren Besuch!\nDeliz, Vodnikov trg 4, Maribor'],
        no: ['Reservierung nicht möglich', 'Hallo {name},\n\nleider haben wir am {date} keinen Tisch für {guests} Personen frei. Rufen Sie uns an, wir finden einen anderen Termin.\n\nDeliz, Vodnikov trg 4, Maribor'] },
  it: { ok: ['Prenotazione confermata', 'Buongiorno {name},\n\nla sua prenotazione all\'enoteca Deliz è confermata: {date}{time}, {guests} persone.\n\nLa aspettiamo!\nDeliz, Vodnikov trg 4, Maribor'],
        no: ['Prenotazione non possibile', 'Buongiorno {name},\n\npurtroppo il {date} non abbiamo un tavolo libero per {guests} persone. Ci chiami e troveremo un\'altra data.\n\nDeliz, Vodnikov trg 4, Maribor'] },
};

function mailGuest_(q, ok) {
  if (!q.email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(q.email)) return;
  const t = (GUEST_MAIL[q.lang] || GUEST_MAIL.en)[ok ? 'ok' : 'no'];
  const d = q.date.split('-').reverse().join('.');
  const body = t[1].replace('{name}', q.name).replace('{date}', d).replace('{time}', q.time ? ', ' + q.time : '').replace('{guests}', q.guests);
  try { MailApp.sendEmail(q.email, 'Deliz — ' + t[0], body, { name: 'Deliz vinoteka' }); } catch (e) { console.warn('guest mail', e); }
}

// ======================= razpoložljivost (kot shared/availability.js) =======================

function isOpen_(iso) {
  if ((VENUE.closedDates || []).indexOf(iso) >= 0) return false;
  return !!VENUE.hours[weekday_(iso)];
}

function isBlocking_(r) { return r.status === 'confirmed' || r.status === 'arrived'; }

function occupancy_(iso, reservations, excludeId) {
  const byTable = {}; let wholeVenue = null;
  reservations.forEach((r) => {
    if (r.date !== iso || r.id === excludeId || !isBlocking_(r)) return;
    if (r.wholeVenue) wholeVenue = r;
    (r.tables || []).forEach((t) => { byTable[t] = r; });
  });
  return { byTable, wholeVenue };
}

function freeTables_(iso, reservations, settings) {
  if (!isOpen_(iso)) return [];
  const occ = occupancy_(iso, reservations);
  if (occ.wholeVenue) return [];
  const terraceOpen = settings.terraceOpen !== false;
  return VENUE.tables.filter((t) => (terraceOpen || t.area !== 'terrace') && !occ.byTable[t.id]);
}

function suggestTables_(guests, iso, reservations, settings) {
  const free = freeTables_(iso, reservations, settings);
  const freeIds = {}; free.forEach((t) => { freeIds[t.id] = true; });
  const opts = [];
  free.forEach((t) => { if (t.seats >= guests) opts.push({ tables: [t.id], seats: t.seats }); });
  (VENUE.combinations || []).forEach((c) => {
    if (c.seats >= guests && c.tables.every((id) => freeIds[id])) opts.push({ tables: c.tables.slice(), seats: c.seats });
  });
  opts.sort((a, b) => a.seats - b.seats || a.tables.length - b.tables.length);
  return opts[0] || null;
}

function isDateAvailable_(guests, iso, reservations, requests, settings) {
  if (guests > VENUE.guestMaxParty || !isOpen_(iso)) return false;
  const sim = reservations.filter((r) => r.date === iso);
  requests.filter((q) => q.date === iso && q.status === 'pending')
    .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))
    .forEach((q) => {
      const o = suggestTables_(q.guests, iso, sim, settings);
      if (o) sim.push({ id: 'pending:' + q.id, date: iso, tables: o.tables, status: 'confirmed' });
    });
  return !!suggestTables_(guests, iso, sim, settings);
}

// ======================= datumi =======================

function todayIso_() { return Utilities.formatDate(new Date(), VENUE.timezone, 'yyyy-MM-dd'); }
function parseIso_(iso) { const p = iso.split('-').map(Number); return new Date(Date.UTC(p[0], p[1] - 1, p[2], 12)); }
function addDays_(iso, n) { const d = parseIso_(iso); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
function weekday_(iso) { return parseIso_(iso).getUTCDay(); }
function clip_(s, n) { return String(s).trim().slice(0, n); }

// ======================= preglednica =======================

function sheet_(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet() || SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('SHEET_ID'));
  return ss.getSheetByName(name);
}

function readAll_(name) {
  const sh = sheet_(name);
  const values = sh.getDataRange().getDisplayValues();
  const head = SHEETS[name];
  return values.slice(1).filter((r) => r[0] !== '').map((row) => {
    const o = {};
    head.forEach((h, i) => {
      const v = row[i];
      o[h] = NUM[h] ? Number(v) : BOOL[h] ? v === 'TRUE' : LIST[h] ? (v ? String(v).split(',') : []) : v;
    });
    return o;
  });
}

function upsert_(name, obj, keyField) {
  const key = keyField || (name === 'Settings' ? 'key' : 'id');
  const sh = sheet_(name);
  const head = SHEETS[name];
  const row = head.map((h) => {
    const v = obj[h];
    if (v === undefined || v === null) return '';
    if (BOOL[h]) return v ? 'TRUE' : 'FALSE';
    if (LIST[h]) return (v || []).join(',');
    return String(v);
  });
  const keys = sh.getRange(1, head.indexOf(key) + 1, Math.max(sh.getLastRow(), 1), 1).getDisplayValues().map((r) => r[0]);
  const idx = keys.indexOf(String(obj[key]));
  if (idx >= 1) sh.getRange(idx + 1, 1, 1, head.length).setValues([row]);
  else sh.appendRow(row);
}

function withLock_(fn) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) throw new Error('Strežnik je zaseden, poskusite znova');
  try { return fn(); } finally { lock.releaseLock(); }
}

// ======================= namestitev =======================

function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const props = PropertiesService.getScriptProperties();
  props.setProperty('SHEET_ID', ss.getId());
  if (!props.getProperty('PIN_SALT')) props.setProperty('PIN_SALT', Utilities.getUuid());
  Object.keys(SHEETS).forEach((name) => {
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    const head = SHEETS[name];
    sh.getRange(1, 1, sh.getMaxRows(), Math.max(head.length, sh.getMaxColumns())).setNumberFormat('@'); // vse kot besedilo
    sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold');
    sh.setFrozenRows(1);
  });
  const first = ss.getSheetByName('Sheet1') || ss.getSheetByName('List1') || ss.getSheetByName('Лист1');
  if (first && ss.getSheets().length > 1) ss.deleteSheet(first);
  const staff = readAll_('Staff');
  [['gleb', 'Gleb'], ['franc', 'Franc']].forEach(([id, name]) => {
    if (!staff.find((s) => s.id === id)) upsert_('Staff', { id, name, pinHash: hash_('1234') });
  });
  if (!readAll_('Settings').length) upsert_('Settings', { key: 'terraceOpen', value: 'TRUE' });
  return 'Pripravljeno. PIN za oba je 1234 — spremenite ga s setPin().';
}
