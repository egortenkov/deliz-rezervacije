// ZAČASNI OSNUTEK — ni še povezan s pravim Apps Script projektom.
// Pogodba (akcije, podatki) je opisana v docs/API.md.
//
// Apps Script spletna aplikacija ne podpira CORS preflight, zato pošiljamo
// POST s Content-Type: text/plain (preprost zahtevek) in JSON v telesu.

export class AppsScriptAdapter {
  constructor(url) {
    if (!url) throw new Error('AppsScriptAdapter: manjka APPS_SCRIPT_URL v shared/data/index.js');
    this.url = url;
    this.name = 'appsscript';
    this.token = null; // sejni žeton po prijavi s PIN-om (glej docs/API.md → login)
  }

  async _call(action, payload = {}) {
    const res = await fetch(this.url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, token: this.token, ...payload }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Napaka strežnika');
    return data.result;
  }

  async login(staffId, pin) {
    const { token } = await this._call('login', { staffId, pin });
    this.token = token;
    return token;
  }

  listReservations(from, to) { return this._call('listReservations', { from, to }); }
  saveReservation(reservation) { return this._call('saveReservation', { reservation }); }
  setStatus(id, status, by) { return this._call('setStatus', { id, status, by }); }
  listRequests() { return this._call('listRequests'); }
  createRequest(request) { return this._call('createRequest', { request }); }
  confirmRequest(id, tables, by) { return this._call('confirmRequest', { id, tables, by }); }
  rejectRequest(id, by) { return this._call('rejectRequest', { id, by }); }
  getSettings() { return this._call('getSettings'); }
  saveSettings(settings) { return this._call('saveSettings', { settings }); }
  publicAvailability(guests, from, days) { return this._call('publicAvailability', { guests, from, days }); }

  // Brez potisnih obvestil: osveževanje vsakih 20 s (spletne zahteve, spremembe drugih).
  subscribe(cb) {
    const t = setInterval(cb, 20000);
    return () => clearInterval(t);
  }
}
