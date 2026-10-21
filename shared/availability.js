// Čiste funkcije za razpoložljivost miz. Brez DOM-a, brez shrambe —
// enake se uporabljajo v aplikaciji za osebje, v obrazcu za goste in v testih.
//
// Osnovno pravilo: rezervacija zasede mizo za CEL dan (ura prihoda je samo
// informativna). «Vsa vinoteka» zasede vse mize tistega dne.

export const BLOCKING_STATUSES = ['confirmed', 'arrived'];

// ---------- datumi (lokalni, brez časovnih pasov) ----------

export function toISODate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseISODate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d, 12); // poldne — varno pred premikom ure
}

export function addDays(iso, n) {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

export function weekday(iso) {
  return parseISODate(iso).getDay();
}

// ---------- delovni čas ----------

export function openingHours(iso, venue) {
  if (venue.closedDates?.includes(iso)) return null;
  return venue.hours[weekday(iso)] ?? null;
}

export function isOpen(iso, venue) {
  return openingHours(iso, venue) !== null;
}

// Ure prihoda po polnih urah; zadnji prihod uro pred zaprtjem.
export function timeSlots(iso, venue) {
  const h = openingHours(iso, venue);
  if (!h) return [];
  const slots = [];
  for (let hour = h.open; hour < h.close; hour++) {
    slots.push(`${String(hour % 24).padStart(2, '0')}:00`);
  }
  return slots;
}

// Naslednjih n odprtih dni od (vključno) datuma from.
export function nextOpenDays(from, n, venue, maxLookahead = 60) {
  const out = [];
  for (let i = 0; i < maxLookahead && out.length < n; i++) {
    const iso = addDays(from, i);
    if (isOpen(iso, venue)) out.push(iso);
  }
  return out;
}

// ---------- zasedenost ----------

export function isBlocking(r) {
  return BLOCKING_STATUSES.includes(r.status);
}

export function activeTables(venue, settings = {}) {
  const terraceOpen = settings.terraceOpen !== false;
  return venue.tables.filter((t) => terraceOpen || t.area !== 'terrace');
}

// Kdo zaseda kaj na izbrani dan.
export function occupancy(iso, reservations, { excludeId } = {}) {
  const byTable = {};
  let wholeVenue = null;
  for (const r of reservations) {
    if (r.date !== iso || r.id === excludeId || !isBlocking(r)) continue;
    if (r.wholeVenue) wholeVenue = r;
    for (const t of r.tables || []) byTable[t] = r;
  }
  return { byTable, wholeVenue };
}

export function freeTables(iso, reservations, venue, settings = {}, opts = {}) {
  if (!isOpen(iso, venue)) return [];
  const occ = occupancy(iso, reservations, opts);
  if (occ.wholeVenue) return [];
  return activeTables(venue, settings).filter((t) => !occ.byTable[t.id]);
}

// Vse možnosti (posamezna miza ali dovoljena kombinacija) za n gostov,
// razvrščene od najboljše: najmanj odvečnih sedežev, nato manj miz,
// nato notranjost pred teraso.
export function tableOptions(guests, free, venue) {
  const freeIds = new Set(free.map((t) => t.id));
  const byId = Object.fromEntries(venue.tables.map((t) => [t.id, t]));
  const options = [];

  for (const t of free) {
    if (t.seats >= guests) options.push({ tables: [t.id], seats: t.seats, area: t.area });
  }
  for (const c of venue.combinations || []) {
    if (c.seats < guests) continue;
    if (!c.tables.every((id) => freeIds.has(id))) continue;
    const areas = new Set(c.tables.map((id) => byId[id].area));
    options.push({ tables: [...c.tables], seats: c.seats, area: areas.size === 1 ? [...areas][0] : 'mixed' });
  }

  const areaRank = { inside: 0, terrace: 1, mixed: 2 };
  options.sort(
    (a, b) =>
      a.seats - b.seats ||
      a.tables.length - b.tables.length ||
      areaRank[a.area] - areaRank[b.area] ||
      a.tables.join().localeCompare(b.tables.join())
  );
  return options;
}

// Najmanjša prosta miza/kombinacija za n gostov ali null.
export function suggestTables(guests, iso, reservations, venue, settings = {}, opts = {}) {
  const free = freeTables(iso, reservations, venue, settings, opts);
  return tableOptions(guests, free, venue)[0] ?? null;
}

// Celotno vinoteko lahko rezerviramo le, če je odprto in je ta dan še nič ne zaseda.
export function canBookWholeVenue(iso, reservations, venue, opts = {}) {
  if (!isOpen(iso, venue)) return false;
  const occ = occupancy(iso, reservations, opts);
  return !occ.wholeVenue && Object.keys(occ.byTable).length === 0;
}

export function seatsOf(tableIds, venue) {
  const combo = (venue.combinations || []).find(
    (c) => c.tables.length === tableIds.length && c.tables.every((id) => tableIds.includes(id))
  );
  if (combo) return combo.seats;
  return tableIds.reduce((sum, id) => sum + (venue.tables.find((t) => t.id === id)?.seats ?? 0), 0);
}

// Preveri ročno izbrane mize. Vrne { ok, error?, warning? }.
export function validateTables(tableIds, guests, iso, reservations, venue, settings = {}, opts = {}) {
  if (!isOpen(iso, venue)) return { ok: false, error: 'closed' };
  if (!tableIds.length) return { ok: false, error: 'no-table' };
  const free = new Set(freeTables(iso, reservations, venue, settings, opts).map((t) => t.id));
  const taken = tableIds.filter((id) => !free.has(id));
  if (taken.length) return { ok: false, error: 'taken', tables: taken };
  if (seatsOf(tableIds, venue) < guests) return { ok: true, warning: 'too-small' };
  return { ok: true };
}

// ---------- spletne zahteve gostov ----------

// Odprte (še nepotrjene) zahteve začasno «zasedejo» mize — sicer bi več gostov
// dobilo isto zadnjo mizo. Simuliramo dodelitev po vrstnem redu prispetja.
export function reservationsWithPending(iso, reservations, requests, venue, settings = {}) {
  const sim = reservations.filter((r) => r.date === iso);
  const pending = (requests || [])
    .filter((q) => q.date === iso && q.status === 'pending')
    .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
  for (const q of pending) {
    const opt = suggestTables(q.guests, iso, sim, venue, settings);
    if (opt) sim.push({ id: `pending:${q.id}`, date: iso, tables: opt.tables, status: 'confirmed' });
  }
  return sim;
}

export function isDateAvailableForGuests(guests, iso, reservations, requests, venue, settings = {}) {
  if (guests > venue.guestMaxParty) return false;
  const sim = reservationsWithPending(iso, reservations, requests, venue, settings);
  return suggestTables(guests, iso, sim, venue, settings) !== null;
}

export function availableDatesForGuests(guests, fromIso, days, reservations, requests, venue, settings = {}) {
  const out = [];
  for (let i = 0; i < days; i++) {
    const iso = addDays(fromIso, i);
    if (isDateAvailableForGuests(guests, iso, reservations, requests, venue, settings)) out.push(iso);
  }
  return out;
}
