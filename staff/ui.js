// Pomožne funkcije za prikaz: oblikovanje, ikone, tlorisi.

import { VENUE } from '../shared/config.js';
import { parseISODate, toISODate, addDays, isOpen, occupancy, seatsOf } from '../shared/availability.js';

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export const todayISO = () => toISODate(new Date());

const WD_SHORT = ['ned', 'pon', 'tor', 'sre', 'čet', 'pet', 'sob'];
const WD_LONG = ['nedelja', 'ponedeljek', 'torek', 'sreda', 'četrtek', 'petek', 'sobota'];
const MONTHS = ['januar', 'februar', 'marec', 'april', 'maj', 'junij', 'julij', 'avgust', 'september', 'oktober', 'november', 'december'];
export const MONTHS_SHORT = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'avg', 'sep', 'okt', 'nov', 'dec'];

export const wdShort = (iso) => WD_SHORT[parseISODate(iso).getDay()];

export function dayLabel(iso) {
  const t = todayISO();
  if (iso === t) return 'Danes';
  if (iso === addDays(t, 1)) return 'Jutri';
  return WD_LONG[parseISODate(iso).getDay()].replace(/^./, (c) => c.toUpperCase());
}

export function longDate(iso) {
  const d = parseISODate(iso);
  return `${WD_LONG[d.getDay()]}, ${d.getDate()}. ${MONTHS[d.getMonth()]}`;
}

export function shortDate(iso) {
  const d = parseISODate(iso);
  return `${WD_SHORT[d.getDay()]} ${d.getDate()}. ${d.getMonth() + 1}.`;
}

// Slovenska množina: ena / dve / tri-štiri / pet+
export function plural(n, [one, two, few, many]) {
  const m = n % 100;
  if (m === 1) return one;
  if (m === 2) return two;
  if (m === 3 || m === 4) return few;
  return many;
}
export const guestsWord = (n) => `${n} ${plural(n, ['gost', 'gosta', 'gostje', 'gostov'])}`;
export const resWord = (n) => `${n} ${plural(n, ['rezervacija', 'rezervaciji', 'rezervacije', 'rezervacij'])}`;

export function tablesLabel(ids) {
  if (!ids?.length) return '—';
  const labels = ids.map((id) => VENUE.tables.find((t) => t.id === id)?.label ?? id);
  return (ids.length > 1 ? 'Mize ' : 'Miza ') + labels.join(' + ');
}

export function tablesArea(ids) {
  const areas = new Set(ids.map((id) => VENUE.tables.find((t) => t.id === id)?.area));
  return [...areas].map((a) => VENUE.areas[a]).join(' + ');
}

export function timeAgo(isoTs) {
  const min = Math.round((Date.now() - new Date(isoTs).getTime()) / 60000);
  if (min < 1) return 'pravkar';
  if (min < 60) return `pred ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `pred ${h} h`;
  return shortDate(toISODate(new Date(isoTs)));
}

// ---------- ikone (črtne, 24×24) ----------

const P = {
  plus: '<path d="M12 5v14M5 12h14"/>',
  list: '<path d="M8 6h12M8 12h12M8 18h12"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>',
  inbox: '<path d="M3 13l3-8h12l3 8v6H3z"/><path d="M3 13h5l1 3h6l1-3h5"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/>',
  cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
  note: '<path d="M4 4h16v12l-4 4H4z"/><path d="M16 20v-4h4"/>',
  table: '<rect x="3" y="8" width="18" height="5" rx="1.5"/><path d="M6 13v6M18 13v6"/>',
  glass: '<path d="M7 3h10l-.5 6a4.5 4.5 0 0 1-9 0z"/><path d="M12 13.5V20M8 21h8"/>',
  wifiOff: '<path d="M2 8.5a16 16 0 0 1 4.5-2.8M10 5.1A16 16 0 0 1 22 8.5M5 12a11 11 0 0 1 3.4-2M13 9.6A11 11 0 0 1 19 12M8.5 15.5a6 6 0 0 1 7 0"/><circle cx="12" cy="19" r="1"/><path d="M3 3l18 18"/>',
  chevL: '<path d="M15 5l-7 7 7 7"/>',
  chevR: '<path d="M9 5l7 7-7 7"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  logout: '<path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"/>',
  moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
  half: '<circle cx="12" cy="12" r="9"/><path d="M12 3v18"/><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" stroke="none"/>',
};

export const icon = (name, size = 24) =>
  `<svg class="ico" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ''}</svg>`;

// ---------- trak datumov ----------

export function dateStrip(selected, act, { counts } = {}) {
  const t = todayISO();
  const chips = [];
  for (let i = 0; i < 7; i++) {
    const iso = addDays(t, i);
    const d = parseISODate(iso);
    const open = isOpen(iso, VENUE);
    const sub = !open ? 'zaprto' : counts ? counts(iso) : '';
    chips.push(`
      <button class="date-chip ${iso === selected ? 'is-on' : ''}" ${open ? '' : 'disabled'}
        data-act="${act}" data-date="${iso}" aria-pressed="${iso === selected}">
        <span class="dc-wd">${i === 0 ? 'danes' : i === 1 ? 'jutri' : WD_SHORT[d.getDay()]}</span>
        <span class="dc-day">${d.getDate()}</span>
        <span class="dc-sub">${sub}</span>
      </button>`);
  }
  const inStrip = selected >= t && selected <= addDays(t, 6);
  const d = parseISODate(selected);
  chips.push(`
    <button class="date-chip date-chip--cal ${inStrip ? '' : 'is-on'}" data-act="open-calendar" data-target="${act}" aria-label="Koledar">
      ${icon('cal', 26)}
      <span class="dc-sub">${inStrip ? 'koledar' : `${d.getDate()}. ${MONTHS_SHORT[d.getMonth()]}`}</span>
    </button>`);
  return `<div class="date-strip">${chips.join('')}</div>`;
}

// ---------- koledar (mesec) ----------

export function calendarGrid(monthIso, selected, act, { minIso } = {}) {
  const first = parseISODate(monthIso.slice(0, 8) + '01');
  const y = first.getFullYear();
  const m = first.getMonth();
  const offset = (first.getDay() + 6) % 7; // ponedeljek prvi
  const days = new Date(y, m + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < offset; i++) cells.push('<span></span>');
  for (let day = 1; day <= days; day++) {
    const iso = toISODate(new Date(y, m, day, 12));
    const ok = isOpen(iso, VENUE) && (!minIso || iso >= minIso);
    cells.push(`<button class="cal-day ${iso === selected ? 'is-on' : ''} ${iso === todayISO() ? 'is-today' : ''}"
      ${ok ? '' : 'disabled'} data-act="${act}" data-date="${iso}">${day}</button>`);
  }
  const prev = toISODate(new Date(y, m - 1, 1, 12));
  const next = toISODate(new Date(y, m + 1, 1, 12));
  const canPrev = !minIso || prev.slice(0, 7) >= minIso.slice(0, 7);
  return `
    <div class="cal">
      <div class="cal-head">
        <button class="icon-btn" data-act="cal-month" data-month="${prev}" ${canPrev ? '' : 'disabled'} aria-label="Prejšnji mesec">${icon('chevL')}</button>
        <div class="cal-title">${MONTHS[m]} ${y}</div>
        <button class="icon-btn" data-act="cal-month" data-month="${next}" aria-label="Naslednji mesec">${icon('chevR')}</button>
      </div>
      <div class="cal-wd">${['pon', 'tor', 'sre', 'čet', 'pet', 'sob', 'ned'].map((w) => `<span>${w}</span>`).join('')}</div>
      <div class="cal-grid">${cells.join('')}</div>
    </div>`;
}

// ---------- tloris ----------
// mode: 'view' (dan) | 'pick' (izbira miz). selected: string[]

export function floorPlan(iso, reservations, settings, { mode = 'view', selected = [], excludeId, highlight } = {}) {
  const occ = occupancy(iso, reservations, { excludeId });
  const terraceOpen = settings.terraceOpen !== false;

  const tableEl = (t) => {
    const r = occ.byTable[t.id];
    const closed = t.area === 'terrace' && !terraceOpen;
    const busy = !!r || !!occ.wholeVenue;
    const sel = selected.includes(t.id);
    const disabled = mode === 'pick' && (busy || closed);
    const cls = ['tbl', t.shape ? `tbl--${t.shape}` : '', busy ? 'is-busy' : 'is-free', sel ? 'is-sel' : '',
      closed ? 'is-closed' : '', r && highlight === r.id ? 'is-hl' : '', r?._unsent ? 'is-unsent' : ''].join(' ');
    const who = r ? `<span class="tbl-who">${esc(r.name.split(' ').slice(-1)[0])}</span><span class="tbl-meta">${r.guests} os.${r.time ? ` · ${esc(r.time)}` : ''}</span>`
      : `<span class="tbl-meta">${t.seats} ${plural(t.seats, ['mesto', 'mesti', 'mesta', 'mest'])}</span>`;
    const act = mode === 'pick' ? 'pick-table' : r ? 'focus-res' : busy || closed ? '' : 'new-at-table';
    return `<button class="${cls}" style="left:${t.x}%;top:${t.y}%;width:${t.w}%;height:${t.h}%"
      ${act ? `data-act="${act}"` : ''} data-table="${t.id}" ${r ? `data-id="${r.id}"` : ''} ${disabled ? 'disabled' : ''}
      aria-label="Miza ${t.label}, ${busy ? 'zasedeno' : 'prosto'}">
      <span class="tbl-num">${t.label}</span>${who}
    </button>`;
  };

  const area = (key, cls) => {
    const tables = VENUE.tables.filter((t) => t.area === key);
    const closed = key === 'terrace' && !terraceOpen;
    return `
      <div class="room ${cls} ${closed ? 'is-closed' : ''}">
        <div class="room-label">${VENUE.areas[key]}${closed ? ' · zaprta' : ''}</div>
        ${tables.map(tableEl).join('')}
      </div>`;
  };

  const whole = occ.wholeVenue
    ? `<div class="whole-banner">${icon('glass', 20)} Vsa vinoteka — <b>${esc(occ.wholeVenue.name)}</b>, ${occ.wholeVenue.guests} os.</div>`
    : '';

  return `<div class="floor ${mode === 'pick' ? 'floor--pick' : ''}">${whole}${area('inside', 'room--inside')}${area('terrace', 'room--terrace')}</div>`;
}

export function seatsLabel(ids) {
  const s = seatsOf(ids, VENUE);
  return `${s} ${plural(s, ['mesto', 'mesti', 'mesta', 'mest'])}`;
}
