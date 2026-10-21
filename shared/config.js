// Nastavitve vinoteke Deliz — vse, kar je specifično za lokal, je tukaj.
// Ko bo potrjen razdelek «0.1 Rešitve naročnika» iz PLAN-reservations.md,
// popravite samo to datoteko.

export const VENUE = {
  name: 'Deliz',
  tagline: 'vinoteka',
  phone: '+386 40 000 000',
  timezone: 'Europe/Ljubljana',

  // 0 = nedelja, 1 = ponedeljek … 6 = sobota. null = zaprto.
  hours: {
    0: { open: 12, close: 20 },
    1: null,
    2: { open: 16, close: 23 },
    3: { open: 16, close: 23 },
    4: { open: 16, close: 23 },
    5: { open: 16, close: 24 },
    6: { open: 12, close: 24 },
  },

  // Posamezni zaprti dnevi (prazniki, dopust) — 'YYYY-MM-DD'.
  closedDates: ['2026-12-25', '2026-12-26', '2027-01-01', '2027-01-02'],

  // Koliko dni vnaprej lahko gostje oddajo spletno zahtevo.
  guestBookingDays: 30,
  // Največ gostov prek spletnega obrazca; večje skupine pokličejo.
  guestMaxParty: 8,

  // x, y, w, h — položaj na shemi v odstotkih prostora.
  tables: [
    { id: 'N1', label: '1', area: 'inside', seats: 2, x: 5, y: 14, w: 20, h: 32 },
    { id: 'N2', label: '2', area: 'inside', seats: 2, x: 5, y: 56, w: 20, h: 32 },
    { id: 'N3', label: '3', area: 'inside', seats: 4, x: 31, y: 14, w: 24, h: 32 },
    { id: 'N4', label: '4', area: 'inside', seats: 4, x: 31, y: 56, w: 24, h: 32 },
    { id: 'N5', label: '5', area: 'inside', seats: 6, x: 61, y: 14, w: 34, h: 32 },
    { id: 'N6', label: '6', area: 'inside', seats: 8, x: 61, y: 56, w: 34, h: 32 },
    { id: 'T1', label: 'T1', area: 'terrace', seats: 2, x: 5, y: 20, w: 20, h: 62 },
    { id: 'T2', label: 'T2', area: 'terrace', seats: 2, x: 29, y: 20, w: 20, h: 62 },
    { id: 'T3', label: 'T3', area: 'terrace', seats: 4, x: 53, y: 20, w: 20, h: 62 },
    { id: 'T4', label: 'T4', area: 'terrace', seats: 4, x: 77, y: 20, w: 20, h: 62 },
  ],

  // Mize, ki jih lahko združimo (sosednje). seats = skupna kapaciteta.
  combinations: [
    { tables: ['N1', 'N2'], seats: 4 },
    { tables: ['N3', 'N4'], seats: 8 },
    { tables: ['N5', 'N6'], seats: 14 },
    { tables: ['N4', 'N6'], seats: 12 },
    { tables: ['N3', 'N4', 'N6'], seats: 16 },
    { tables: ['T1', 'T2'], seats: 4 },
    { tables: ['T3', 'T4'], seats: 8 },
    { tables: ['T2', 'T3', 'T4'], seats: 10 },
  ],

  areas: {
    inside: 'Notri',
    terrace: 'Terasa',
  },
};

export const STAFF = [
  { id: 'gleb', name: 'Gleb' },
  { id: 'franc', name: 'Franc' },
];

// Demo PIN — v produkciji ga preverja strežnik (Apps Script).
export const DEMO_PIN = '1234';
