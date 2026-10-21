// Čakalna vrsta za rezervacije, ki jih ni bilo mogoče poslati (brez povezave).
// Shranjene so lokalno, prikazane z oznako «ni poslano» in poslane ob ponovni povezavi.

const KEY = 'deliz.outbox.v1';
const SIM_KEY = 'deliz.simulateOffline';

export class Outbox {
  constructor(adapter, storage = globalThis.localStorage) {
    this.adapter = adapter;
    this.storage = storage;
    this.listeners = new Set();
    globalThis.addEventListener?.('online', () => this.flush());
  }

  get simulateOffline() { return this.storage.getItem(SIM_KEY) === '1'; }
  set simulateOffline(v) {
    this.storage.setItem(SIM_KEY, v ? '1' : '0');
    if (!v) this.flush(); else this._emit();
  }

  get online() {
    return !this.simulateOffline && globalThis.navigator?.onLine !== false;
  }

  items() {
    try { return JSON.parse(this.storage.getItem(KEY)) || []; } catch { return []; }
  }

  _save(items) {
    this.storage.setItem(KEY, JSON.stringify(items));
    this._emit();
  }

  onChange(cb) { this.listeners.add(cb); return () => this.listeners.delete(cb); }
  _emit() { this.listeners.forEach((cb) => cb()); }

  // Vrne { reservation, queued }.
  async saveReservation(r) {
    if (this.online) {
      try {
        return { reservation: await this.adapter.saveReservation(r), queued: false };
      } catch (e) {
        console.warn('Pošiljanje ni uspelo, shranjeno v vrsto', e);
      }
    }
    const items = this.items().filter((x) => x.id !== r.id);
    items.push({ ...r, _queuedAt: new Date().toISOString() });
    this._save(items);
    return { reservation: r, queued: true };
  }

  async flush() {
    if (!this.online) return 0;
    let sent = 0;
    for (const item of this.items()) {
      const { _queuedAt, ...r } = item;
      try {
        await this.adapter.saveReservation(r);
        this._save(this.items().filter((x) => x.id !== r.id));
        sent++;
      } catch {
        break;
      }
    }
    return sent;
  }
}
