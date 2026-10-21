import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DemoAdapter } from '../shared/data/demo-adapter.js';
import { Outbox } from '../shared/data/outbox.js';
import { buildSeed } from '../shared/data/seed.js';
import { VENUE } from '../shared/config.js';
import { addDays, freeTables, isOpen, toISODate } from '../shared/availability.js';

class MemStorage {
  constructor() { this.m = new Map(); }
  getItem(k) { return this.m.has(k) ? this.m.get(k) : null; }
  setItem(k, v) { this.m.set(k, String(v)); }
  removeItem(k) { this.m.delete(k); }
}

const today = toISODate(new Date());

test('seed: rezervacije samo na odprte dni, brez dvojno zasedenih miz', () => {
  const { reservations, requests } = buildSeed('2026-10-21');
  assert.ok(reservations.length > 30);
  assert.equal(requests.filter((q) => q.status === 'pending').length, 2);
  const byDay = {};
  for (const r of reservations) {
    assert.ok(isOpen(r.date, VENUE), `rezervacija na zaprt dan ${r.date}`);
    (byDay[r.date] ??= []).push(r);
  }
  for (const [day, list] of Object.entries(byDay)) {
    const used = list.flatMap((r) => r.tables);
    assert.equal(new Set(used).size, used.length, `podvojena miza ${day}`);
  }
  assert.ok(reservations.some((r) => r.wholeVenue), 'manjka primer «vsa vinoteka»');
  assert.ok(reservations.some((r) => r.tables.length > 1), 'manjka primer kombinacije miz');
});

test('DemoAdapter: shrani, spremeni status, filtrira po datumih', async () => {
  const a = new DemoAdapter(new MemStorage());
  const date = addDays(today, 1);
  const r = await a.saveReservation({ id: 'x1', date, time: '18:00', guests: 2, name: 'Test', tables: ['T1'], status: 'confirmed' });
  assert.ok(r.createdAt);
  await a.setStatus('x1', 'arrived', 'gleb');
  const list = await a.listReservations(date, date);
  assert.equal(list.find((x) => x.id === 'x1').status, 'arrived');
  assert.equal((await a.listReservations('2000-01-01', '2000-01-02')).length, 0);
});

test('DemoAdapter: spletna zahteva → potrditev ustvari rezervacijo', async () => {
  const a = new DemoAdapter(new MemStorage());
  const date = addDays(today, 2);
  const q = await a.createRequest({ date, time: '19:00', guests: 3, name: 'Gost', phone: '+386', email: 'g@x.si', lang: 'en', consent: true });
  assert.equal(q.status, 'pending');
  const { reservation, request } = await a.confirmRequest(q.id, ['N3'], 'franc');
  assert.equal(request.status, 'confirmed');
  assert.equal(reservation.source, 'web');
  assert.deepEqual(reservation.tables, ['N3']);
  const q2 = await a.createRequest({ date, guests: 2, name: 'B' });
  assert.equal((await a.rejectRequest(q2.id, 'gleb')).status, 'rejected');
});

test('DemoAdapter: terasa izklopljena vpliva na razpoložljivost za goste', async () => {
  const a = new DemoAdapter(new MemStorage());
  await a.saveSettings({ terraceOpen: false });
  assert.equal((await a.getSettings()).terraceOpen, false);
  const db = JSON.parse([...a.storage.m.values()][0]);
  assert.ok(freeTables(addDays(today, 1), db.reservations, VENUE, db.settings).every((t) => t.area !== 'terrace'));
});

test('Outbox: brez povezave shrani v vrsto, ob povezavi pošlje', async () => {
  const storage = new MemStorage();
  const a = new DemoAdapter(storage);
  const box = new Outbox(a, storage);
  box.simulateOffline = true;
  const res = await box.saveReservation({ id: 'off1', date: addDays(today, 3), guests: 2, tables: ['N1'], status: 'confirmed' });
  assert.equal(res.queued, true);
  assert.equal(box.items().length, 1);
  assert.equal((await a.listReservations('2000-01-01', '2100-01-01')).some((r) => r.id === 'off1'), false);
  box.simulateOffline = false;
  await box.flush();
  assert.equal(box.items().length, 0);
  assert.equal((await a.listReservations('2000-01-01', '2100-01-01')).some((r) => r.id === 'off1'), true);
});
