// Tema: 'system' | 'light' | 'dark'. Začetno vrednost nastavi že vrstični skript v <head>
// (brez utripa); ta modul jo spreminja in sledi sistemski nastavitvi.

const html = document.documentElement;
const media = matchMedia('(prefers-color-scheme: light)');
const scope = location.pathname.includes('/staff') ? 'staff' : 'guest';
const KEY = `deliz.theme.${scope}`;
const META = { light: '#FAF8F0', dark: '#0D0D0D' };

export const THEMES = ['system', 'light', 'dark'];

export function getThemePref() {
  return html.dataset.themePref || 'system';
}

function apply() {
  const pref = getThemePref();
  const theme = pref === 'system' ? (media.matches ? 'light' : 'dark') : pref;
  html.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', META[theme]);
  return theme;
}

export function setThemePref(pref, { persist = true } = {}) {
  html.dataset.themePref = THEMES.includes(pref) ? pref : 'system';
  if (persist) try { localStorage.setItem(KEY, html.dataset.themePref); } catch { /* zasebno okno */ }
  return apply();
}

export const currentTheme = () => html.dataset.theme;

media.addEventListener?.('change', () => { if (getThemePref() === 'system') apply(); });
apply();
