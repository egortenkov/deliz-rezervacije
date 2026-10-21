import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addDays, weekday, isOpen, timeSlots, nextOpenDays,
  freeTables, suggestTables, tableOptions, canBookWholeVenue, validateTables,
  isDateAvailableForGuests, availableDatesForGuests, seatsOf,
} from '../shared/availability.js';
import { VENUE } from '../shared/config.js';

// Majhna, stabilna testna vinoteka (neodvisna od produkcijske konfiguracije).
const V = {
  hours: { 0: { open: 12, close: 20 }, 1: null, 2: { open: 16, close: 23 }, 3: { open: 16, close: 23 },
    4: { open: 16, close: 23 }, 5: { open: 16, close: 24 }, 6: { open: 12, close: 24 } },
  closedDates: ['2026-10-29'],
  guestMaxParty: 8,
  tables: [
    { id: 'A', area: 'inside', seats: 2 },
    { id: 'B', area: 'inside', seats: 4 },
    { id: 'C', area: 'inside', seats: 4 },
    { id: 'T', area: 'terrace', seats: 2 },
    { id: 'U', area: 'terrace', seats: 6 },
  ],
  combinations: [
    { tables: ['B', 'C'], seats: 8 },
    { tables: ['A', 'B', 'C'], seats: 10 },
  ],
};

const TUE = '2026-10-27';
const MON = '2026-10-26';
const r = (id, tables, extra = {}) => ({ id, date: TUE, tables, status: 'confirmed', guests: 2, ...extra });

test('datumi: dodajanje dni in dan v tednu (tudi čez prestop ure)', () => {
  assert.equal(addDays('2026-10-24', 2), '2026-10-26');
  assert.equal(weekday(MON), 1);
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
});

test('ponedeljek je zaprt, nima ur in nima prostih miz', () => {
  assert.equal(isOpen(MON, V), false);
  assert.deepEqual(timeSlots(MON, V), []);
  assert.deepEqual(freeTables(MON, [], V), []);
  assert.equal(suggestTables(2, MON, [], V), null);
  assert.equal(canBookWholeVenue(MON, [], V), false);
});

test('posamezen zaprt datum (praznik) je zaprt', () => {
  assert.equal(isOpen('2026-10-29', V), false);
  assert.equal(isDateAvailableForGuests(2, '2026-10-29', [], [], V), false);
});

test('ure prihoda po delovnem času; čez polnoč se prikaže 23:00 kot zadnja', () => {
  assert.deepEqual(timeSlots(TUE, V), ['16:00', '17:00', '18:00', '19:00', '20:00', '21:00', '22:00']);
  assert.equal(timeSlots('2026-10-31', V).at(-1), '23:00');
});

test('nextOpenDays preskoči ponedeljek in praznike', () => {
  const days = nextOpenDays('2026-10-25', 4, V);
  assert.deepEqual(days, ['2026-10-25', '2026-10-27', '2026-10-28', '2026-10-30']);
});

test('rezervacija zasede mizo za cel dan ne glede na uro', () => {
  const res = [r('1', ['A'], { time: '16:00' })];
  const free = freeTables(TUE, res, V).map((t) => t.id);
  assert.ok(!free.includes('A'));
  // drug dan je miza spet prosta
  assert.ok(freeTables('2026-10-28', res, V).some((t) => t.id === 'A'));
});

test('preklicane in «niso prišli» ne zasedajo mize', () => {
  const res = [r('1', ['A'], { status: 'cancelled' }), r('2', ['B'], { status: 'noshow' }), r('3', ['C'], { status: 'arrived' })];
  const free = freeTables(TUE, res, V).map((t) => t.id);
  assert.ok(free.includes('A'));
  assert.ok(free.includes('B'));
  assert.ok(!free.includes('C'));
});

test('samodejni izbor: najmanjša miza, ki zadošča', () => {
  assert.deepEqual(suggestTables(2, TUE, [], V).tables, ['A']);
  assert.deepEqual(suggestTables(3, TUE, [], V).tables, ['B']);
  assert.deepEqual(suggestTables(5, TUE, [], V).tables, ['U']);
});

test('pri enakem številu sedežev ima notranjost prednost pred teraso', () => {
  const opts = tableOptions(2, freeTables(TUE, [], V), V);
  assert.equal(opts[0].tables[0], 'A');
  assert.equal(opts[1].tables[0], 'T');
});

test('kombinacija miz za večjo družbo', () => {
  assert.deepEqual(suggestTables(7, TUE, [], V).tables, ['B', 'C']);
  assert.deepEqual(suggestTables(9, TUE, [], V).tables, ['A', 'B', 'C']);
  assert.equal(seatsOf(['B', 'C'], V), 8);
});

test('kombinacija ni možna, če je ena od miz zasedena', () => {
  const res = [r('1', ['C'])];
  assert.equal(suggestTables(7, TUE, res, V), null);
  assert.equal(suggestTables(9, TUE, res, V), null);
});

test('terasa izklopljena: terasne mize niso na voljo', () => {
  const s = { terraceOpen: false };
  const ids = freeTables(TUE, [], V, s).map((t) => t.id);
  assert.deepEqual(ids, ['A', 'B', 'C']);
  // 5 gostov: brez terase (U) mora vzeti kombinacijo B+C
  assert.deepEqual(suggestTables(5, TUE, [], V, s).tables, ['B', 'C']);
  // vse notranje zasedene → nič, čeprav je terasa prazna
  const res = [r('1', ['A']), r('2', ['B']), r('3', ['C'])];
  assert.equal(suggestTables(2, TUE, res, V, s), null);
  assert.deepEqual(suggestTables(2, TUE, res, V).tables, ['T']);
});

test('vsa vinoteka zasede vse mize', () => {
  const res = [r('W', [], { wholeVenue: true, guests: 40 })];
  assert.deepEqual(freeTables(TUE, res, V), []);
  assert.equal(suggestTables(1, TUE, res, V), null);
  assert.equal(canBookWholeVenue(TUE, res, V), false);
});

test('vse vinoteke ni mogoče rezervirati, če je že kakšna rezervacija', () => {
  assert.equal(canBookWholeVenue(TUE, [], V), true);
  assert.equal(canBookWholeVenue(TUE, [r('1', ['T'])], V), false);
  assert.equal(canBookWholeVenue(TUE, [r('1', ['T'], { status: 'cancelled' })], V), true);
});

test('pri urejanju rezervacija ne blokira same sebe', () => {
  const res = [r('1', ['A'])];
  assert.equal(validateTables(['A'], 2, TUE, res, V).ok, false);
  assert.equal(validateTables(['A'], 2, TUE, res, V, {}, { excludeId: '1' }).ok, true);
  assert.equal(canBookWholeVenue(TUE, res, V, { excludeId: '1' }), true);
});

test('ročni izbor: zasedena miza je napaka, premajhna je samo opozorilo', () => {
  const res = [r('1', ['B'])];
  assert.deepEqual(validateTables(['B'], 2, TUE, res, V), { ok: false, error: 'taken', tables: ['B'] });
  assert.deepEqual(validateTables(['A'], 4, TUE, res, V), { ok: true, warning: 'too-small' });
  assert.deepEqual(validateTables([], 4, TUE, res, V), { ok: false, error: 'no-table' });
});

test('gostje: datum ni na voljo, ko ni ustrezne mize', () => {
  const full = [r('1', ['A']), r('2', ['B']), r('3', ['C']), r('4', ['T']), r('5', ['U'])];
  assert.equal(isDateAvailableForGuests(2, TUE, full, [], V), false);
  assert.equal(isDateAvailableForGuests(2, TUE, full.slice(1), [], V), true);
  // prevelika skupina prek spleta nikoli
  assert.equal(isDateAvailableForGuests(9, TUE, [], [], V), false);
});

test('gostje: odprte zahteve začasno zasedejo mize', () => {
  const res = [r('1', ['A']), r('2', ['B']), r('3', ['C']), r('4', ['U'])]; // prosta samo T
  const pending = [{ id: 'q1', date: TUE, guests: 2, status: 'pending', createdAt: '1' }];
  assert.equal(isDateAvailableForGuests(2, TUE, res, [], V), true);
  assert.equal(isDateAvailableForGuests(2, TUE, res, pending, V), false);
  // zavrnjena zahteva ne zaseda
  assert.equal(isDateAvailableForGuests(2, TUE, res, [{ ...pending[0], status: 'rejected' }], V), true);
});

test('gostje: seznam datumov izpusti ponedeljke, praznike in polne dni', () => {
  const full = ['A', 'B', 'C', 'T', 'U'].map((t, i) => ({ id: `f${i}`, date: '2026-10-28', tables: [t], status: 'confirmed' }));
  const dates = availableDatesForGuests(2, '2026-10-25', 7, full, [], V);
  assert.deepEqual(dates, ['2026-10-25', '2026-10-27', '2026-10-30', '2026-10-31']);
});

test('produkcijska konfiguracija je skladna', () => {
  const ids = new Set(VENUE.tables.map((t) => t.id));
  assert.equal(ids.size, VENUE.tables.length, 'podvojen ID mize');
  for (const c of VENUE.combinations) {
    for (const id of c.tables) assert.ok(ids.has(id), `kombinacija vsebuje neznano mizo ${id}`);
    const sum = c.tables.reduce((s, id) => s + VENUE.tables.find((t) => t.id === id).seats, 0);
    assert.ok(c.seats <= sum + 2, `kombinacija ${c.tables} ima nerealno kapaciteto`);
  }
  assert.equal(VENUE.hours[1], null, 'ponedeljek mora biti zaprt');
});
