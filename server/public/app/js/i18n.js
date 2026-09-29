// MEDICARD web — language (ka / en).
// One choice for the whole site: localStorage "medicard.lang" is shared with the public pages
// (site-i18n.js), and ?lang=en|ka sets it. Georgian is the default. Changing it reloads the page,
// so every module can read `lang` once at import time.
const KEY = 'medicard.lang';

function parse(v) {
  const s = String(v || '').toLowerCase();
  if (s === 'en' || s.startsWith('en-')) return 'en';
  if (s === 'ka' || s.startsWith('ka-')) return 'ka';
  return '';
}

function stored() {
  try { return parse(localStorage.getItem(KEY)); } catch { return ''; }
}

let fromUrl = '';
try { fromUrl = parse(new URLSearchParams(location.search).get('lang')); } catch { fromUrl = ''; }
if (fromUrl) {
  try { localStorage.setItem(KEY, fromUrl); } catch { /* private mode */ }
}

/** Active language for this page load. */
export const lang = fromUrl || stored() || 'ka';
export const isEn = lang === 'en';
/** BCP-47 locale for Intl / toLocale*String. */
export const locale = isEn ? 'en-GB' : 'ka-GE';

document.documentElement.lang = lang;
// index.html ships the Georgian title; pages set their own once the shell is up.
if (isEn && /[ა-ჿ]/.test(document.title)) document.title = 'MEDICARD — My account';

/** Pick the copy for the active language: t('ქართული', 'English'). */
export function t(ka, en) {
  return isEn ? en : ka;
}

/** English plural helper: plural(3, 'day') → '3 days'; plural(1, 'entry', 'entries'). */
export function plural(n, one, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

/** Save the choice and reload in it. */
export function setLang(next) {
  const value = parse(next);
  if (!value) return;
  try { localStorage.setItem(KEY, value); } catch { /* private mode: this load only */ }
  if (value === lang) return;
  const url = new URL(location.href);
  url.searchParams.delete('lang');
  location.replace(url.toString());
}

/** Each language names itself. */
export const LANGUAGES = [
  { value: 'ka', badge: 'ქა', label: 'ქართული' },
  { value: 'en', badge: 'EN', label: 'English' },
];
