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

  // x, y, w, h — položaj na shemi v odstotkih prostora (notri 16:9, terasa 4:1).
  // Razporeditev je potrdil Egor v urejevalniku sheme (21. 10. 2026): dve dolgi mizi po 8 mest (5, 6),
  // ob spodnji steni levo vrsta treh miz po 4 (1–3), mala miza za 2 desno spodaj (4), vhod spodaj na sredini,
  // šank z vitrino zgoraj desno; terasa 8 miz po 4 v dveh vrstah.
  tables: [
    { id: 'N1', label: '1', area: 'inside', seats: 4, x: 5.5, y: 73, w: 11.5, h: 20.5 },
    { id: 'N2', label: '2', area: 'inside', seats: 4, x: 19.5, y: 73.5, w: 11.5, h: 19 },
    { id: 'N3', label: '3', area: 'inside', seats: 4, x: 33.5, y: 74, w: 11, h: 17.5 },
    { id: 'N4', label: '4', area: 'inside', seats: 2, x: 76.5, y: 92, w: 17.5, h: 8 },
    { id: 'N5', label: '5', area: 'inside', seats: 8, x: 5, y: 37.5, w: 35, h: 15 },
    { id: 'N6', label: '6', area: 'inside', seats: 8, x: 56.5, y: 38.5, w: 38.5, h: 13.5 },
    { id: 'T1', label: 'T1', area: 'terrace', seats: 4, x: 5.5, y: 0.5, w: 10.5, h: 31.5 },
    { id: 'T2', label: 'T2', area: 'terrace', seats: 4, x: 20, y: 0, w: 10.5, h: 33 },
    { id: 'T3', label: 'T3', area: 'terrace', seats: 4, x: 34.5, y: 0, w: 10, h: 34.5 },
    { id: 'T4', label: 'T4', area: 'terrace', seats: 4, x: 79.5, y: 0, w: 11, h: 36 },
    { id: 'T5', label: 'T5', area: 'terrace', seats: 4, x: 79.5, y: 53, w: 11, h: 36 },
    { id: 'T6', label: 'T6', area: 'terrace', seats: 4, x: 35, y: 50.5, w: 10, h: 34.5 },
    { id: 'T7', label: 'T7', area: 'terrace', seats: 4, x: 20, y: 50.5, w: 10, h: 34.5 },
    { id: 'T8', label: 'T8', area: 'terrace', seats: 4, x: 5.5, y: 51, w: 10, h: 34.5 },
  ],

  // Oprema na shemi (ni za rezervacijo): kind 'bar' | 'door'. Pri 'door' se upošteva x/w (spodnja stena).
  fixtures: [
    { id: 'bar', kind: 'bar', area: 'inside', label: 'Šank · vitrina', x: 44, y: 0, w: 56, h: 15 },
    { id: 'door', kind: 'door', area: 'inside', label: 'Vhod', x: 53, w: 16 },
  ],

  // Mize, ki jih lahko združimo (sosednje). seats = skupna kapaciteta. PREDLOG — potrdita Gleb in Franc.
  combinations: [
    { tables: ['N1', 'N2'], seats: 8 },
    { tables: ['N2', 'N3'], seats: 8 },
    { tables: ['N1', 'N2', 'N3'], seats: 12 },
    { tables: ['T1', 'T2'], seats: 8 },
    { tables: ['T2', 'T3'], seats: 8 },
    { tables: ['T1', 'T2', 'T3'], seats: 12 },
    { tables: ['T8', 'T7'], seats: 8 },
    { tables: ['T7', 'T6'], seats: 8 },
    { tables: ['T6', 'T7', 'T8'], seats: 12 },
    { tables: ['T4', 'T5'], seats: 8 },
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
