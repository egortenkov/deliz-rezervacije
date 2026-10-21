// Demo podatki: realistične rezervacije za naslednja 2 tedna od danes.

import { VENUE } from '../config.js';
import { addDays, isOpen, timeSlots, suggestTables, weekday } from '../availability.js';

const NAMES = [
  'Novak', 'Horvat', 'Kovačič', 'Krajnc', 'Zupančič', 'Potočnik', 'Kovač', 'Mlakar', 'Kos', 'Vidmar',
  'Golob', 'Turk', 'Božič', 'Kralj', 'Korošec', 'Zupan', 'Bizjak', 'Hribar', 'Kotnik', 'Rozman',
  'Petek', 'Kastelic', 'Kolar', 'Žagar', 'Košir', 'Koren', 'Furlan', 'Rupnik', 'Müller', 'Rossi',
];
const FIRST = ['Ana', 'Marko', 'Nina', 'Luka', 'Maja', 'Jure', 'Eva', 'Tadej', 'Petra', 'Rok', 'Tina', 'Matej', 'Sara', 'Gregor', 'Urška'];
const NOTES = ['', '', '', '', 'Rojstni dan', 'Degustacija', 'Želi teraso', 'Alergija na oreščke', 'Vegetarijanci', 'Redni gost', 'Pride s psom'];

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = (rand, arr) => arr[Math.floor(rand() * arr.length)];
const phone = (rand) => `+386 ${pick(rand, ['31', '40', '41', '51', '70'])} ${String(100 + Math.floor(rand() * 900))} ${String(100 + Math.floor(rand() * 900))}`;

export function buildSeed(today) {
  const rand = rng(20261021);
  const reservations = [];
  let n = 0;
  const now = new Date().toISOString();

  for (let i = 0; i < 14; i++) {
    const date = addDays(today, i);
    if (!isOpen(date, VENUE)) continue;
    const slots = timeSlots(date, VENUE);
    const dow = weekday(date);

    // Druga nedelja: zaključena družba — vsa vinoteka.
    if (dow === 0 && i >= 7) {
      reservations.push({
        id: `seed-${n++}`, date, time: slots[2], guests: 32, name: 'Podjetje Vinarstvo d.o.o.',
        phone: '+386 1 555 0123', note: 'Zaključena družba, degustacijski meni', tables: [], wholeVenue: true,
        status: 'confirmed', source: 'staff', createdBy: 'franc', createdAt: now, updatedAt: now,
      });
      continue;
    }

    const busy = dow === 5 || dow === 6;
    const count = busy ? 6 + Math.floor(rand() * 3) : 2 + Math.floor(rand() * 3);
    const dayRes = [];
    for (let k = 0; k < count; k++) {
      const big = k === 0 && busy;
      const guests = big ? 7 + Math.floor(rand() * 4) : pick(rand, [2, 2, 2, 3, 4, 4, 5, 6]);
      const opt = suggestTables(guests, date, dayRes, VENUE, { terraceOpen: true });
      if (!opt) continue;
      const r = {
        id: `seed-${n++}`, date, time: pick(rand, slots.slice(0, -1)), guests,
        name: `${pick(rand, FIRST)} ${pick(rand, NAMES)}`, phone: phone(rand),
        note: big ? 'Praznovanje, aperitiv ob prihodu' : pick(rand, NOTES),
        tables: opt.tables, wholeVenue: false, status: 'confirmed',
        source: rand() < 0.25 ? 'web' : 'staff', createdBy: pick(rand, ['gleb', 'franc']),
        createdAt: now, updatedAt: now,
      };
      dayRes.push(r);
    }
    dayRes.sort((a, b) => a.time.localeCompare(b.time));
    reservations.push(...dayRes);
  }

  const firstOpen = [0, 1, 2, 3, 4].map((d) => addDays(today, d)).filter((d) => isOpen(d, VENUE));
  const created = (minAgo) => new Date(Date.now() - minAgo * 60000).toISOString();
  const requests = [
    { id: 'seed-q1', date: firstOpen[1] ?? today, time: '19:00', guests: 4, name: 'Laura Bianchi', phone: '+39 333 123 4567',
      email: 'laura.b@example.com', note: 'Prima volta da voi!', lang: 'it', consent: true, status: 'pending', createdAt: created(42) },
    { id: 'seed-q2', date: firstOpen[2] ?? today, time: '18:00', guests: 2, name: 'Thomas Weber', phone: '+49 151 2345 6789',
      email: 'tweber@example.com', note: '', lang: 'de', consent: true, status: 'pending', createdAt: created(15) },
  ];

  return { reservations, requests, settings: { terraceOpen: true } };
}
