// Demo podatkovni sloj: vse v localStorage tega brskalnika.
// Obrazec za goste in aplikacija za osebje si delita podatke samo na ISTI napravi.

import { VENUE } from '../config.js';
import { toISODate, availableDatesForGuests, suggestTables } from '../availability.js';
import { buildSeed } from './seed.js';

const KEY = 'deliz.demo.v1';
const EVENT = 'deliz:data';

export const uid = () =>
  globalThis.crypto?.randomUUID?.() ?? `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export class DemoAdapter {
  constructor(storage = globalThis.localStorage) {
    this.storage = storage;
    this.name = 'demo';
  }

  _read() {
    let db = null;
    try { db = JSON.parse(this.storage.getItem(KEY)); } catch { db = null; }
    if (!db || !db.reservations) {
      db = buildSeed(toISODate(new Date()));
      this._write(db, false);
    }
    return db;
  }

  _write(db, notify = true) {
    try { this.storage.setItem(KEY, JSON.stringify(db)); } catch (e) { console.warn('localStorage', e); }
    if (notify) globalThis.dispatchEvent?.(new CustomEvent(EVENT));
  }

  async reset() {
    this._write(buildSeed(toISODate(new Date())));
  }

  async listReservations(from, to) {
    return this._read().reservations.filter((r) => r.date >= from && r.date <= to);
  }

  async saveReservation(r) {
    const db = this._read();
    const now = new Date().toISOString();
    const i = db.reservations.findIndex((x) => x.id === r.id);
    const saved = { ...r, id: r.id || uid(), updatedAt: now, createdAt: r.createdAt || now };
    if (i >= 0) db.reservations[i] = saved; else db.reservations.push(saved);
    this._write(db);
    return saved;
  }

  async setStatus(id, status, by) {
    const db = this._read();
    const r = db.reservations.find((x) => x.id === id);
    if (!r) throw new Error('Rezervacija ne obstaja');
    Object.assign(r, { status, updatedAt: new Date().toISOString(), updatedBy: by });
    this._write(db);
    return r;
  }

  async listRequests() {
    return this._read().requests;
  }

  async createRequest(q) {
    const db = this._read();
    const req = { ...q, id: uid(), status: 'pending', createdAt: new Date().toISOString() };
    db.requests.push(req);
    this._write(db);
    return req;
  }

  async confirmRequest(id, tables, by) {
    const db = this._read();
    const q = db.requests.find((x) => x.id === id);
    if (!q) throw new Error('Zahteva ne obstaja');
    const now = new Date().toISOString();
    const reservation = {
      id: uid(), date: q.date, time: q.time, guests: q.guests, name: q.name, phone: q.phone,
      note: [q.note, q.email].filter(Boolean).join(' · '), tables, wholeVenue: false,
      status: 'confirmed', source: 'web', requestId: q.id, createdBy: by, createdAt: now, updatedAt: now,
    };
    db.reservations.push(reservation);
    Object.assign(q, { status: 'confirmed', handledBy: by, handledAt: now, reservationId: reservation.id });
    this._write(db);
    return { request: q, reservation };
  }

  async rejectRequest(id, by) {
    const db = this._read();
    const q = db.requests.find((x) => x.id === id);
    if (!q) throw new Error('Zahteva ne obstaja');
    Object.assign(q, { status: 'rejected', handledBy: by, handledAt: new Date().toISOString() });
    this._write(db);
    return q;
  }

  async getSettings() {
    return this._read().settings;
  }

  async saveSettings(s) {
    const db = this._read();
    db.settings = { ...db.settings, ...s };
    this._write(db);
    return db.settings;
  }

  async publicAvailability(guests, from, days) {
    const db = this._read();
    return availableDatesForGuests(guests, from, days, db.reservations, db.requests, VENUE, db.settings);
  }

  async suggest(guests, date) {
    const db = this._read();
    return suggestTables(guests, date, db.reservations, VENUE, db.settings);
  }

  subscribe(cb) {
    const onStorage = (e) => { if (e.key === KEY || e.key === null) cb(); };
    globalThis.addEventListener('storage', onStorage); // drugi zavihki
    globalThis.addEventListener(EVENT, cb);            // ta zavihek
    return () => {
      globalThis.removeEventListener('storage', onStorage);
      globalThis.removeEventListener(EVENT, cb);
    };
  }
}
