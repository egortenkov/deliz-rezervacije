// Izbira podatkovnega sloja — ENA nastavitev.
//   'demo'       → DemoAdapter (localStorage, vnaprej izpolnjene rezervacije)
//   'appsscript' → AppsScriptAdapter (Google Sheets prek Apps Script spletne aplikacije)
export const DATA_ADAPTER = 'demo';
export const APPS_SCRIPT_URL = ''; // https://script.google.com/macros/s/…/exec

import { DemoAdapter } from './demo-adapter.js';
import { AppsScriptAdapter } from './appsscript-adapter.js';

let instance = null;

export function getAdapter() {
  if (instance) return instance;
  instance = DATA_ADAPTER === 'appsscript'
    ? new AppsScriptAdapter(APPS_SCRIPT_URL)
    : new DemoAdapter();
  return instance;
}

/**
 * Pogodba, ki jo izpolnjujeta oba adapterja (vse metode so async).
 *
 * Reservation {
 *   id, date 'YYYY-MM-DD', time 'HH:MM' | '', guests, name, phone, note,
 *   tables: string[], wholeVenue: boolean,
 *   status: 'confirmed' | 'arrived' | 'noshow' | 'cancelled',
 *   source: 'staff' | 'web', createdBy, createdAt, updatedAt, requestId?
 * }
 * GuestRequest {
 *   id, date, time, guests, name, phone, email, note, lang: 'sl'|'en'|'de'|'it',
 *   consent: true, status: 'pending' | 'confirmed' | 'rejected',
 *   createdAt, handledBy?, handledAt?, reservationId?
 * }
 * Settings { terraceOpen: boolean }
 *
 *   listReservations(from, to)          → Reservation[]   (from/to vključno)
 *   saveReservation(r)                  → Reservation     (nova ali posodobljena; id določi klient)
 *   setStatus(id, status, by)           → Reservation
 *   listRequests()                      → GuestRequest[]
 *   createRequest(q)                    → GuestRequest    (javni obrazec)
 *   confirmRequest(id, tables, by)      → { request, reservation }
 *   rejectRequest(id, by)               → GuestRequest
 *   getSettings() / saveSettings(s)     → Settings
 *   publicAvailability(guests, from, days) → string[]  datumi, primerni za goste
 *   subscribe(cb)                       → unsubscribe     (obvestilo ob spremembi)
 */
