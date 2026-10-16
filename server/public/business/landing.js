// MEDIBOOK business landing (medicard.ge/business): the screenshot gallery, the two ways in, the sign-in box.
// The sign-in box is the panel's own (business/js/auth.js) — same accounts and tokens as the app and /app.
import { renderAuthPanel } from '/business/js/auth.js';
import { loadSession, session, signOut } from '/app/js/session.js';
import { getToken } from '/app/js/api.js';

const I18N = window.MedicardI18n || { lang: 'ka', isEn: false, t: (ka) => ka };
const T = I18N.t;
const PANEL = '/business/'; // the trailing slash is the panel shell; /business alone is this page

// The panel sends signed-out visitors here as /business?p=1 (a query string beats the 301 browsers cached for
// a bare /business before this page existed); the address bar does not need to show it.
if (/[?&]p=1/.test(location.search)) { try { history.replaceState(null, '', '/business' + location.hash); } catch { /* ignore */ } }

const year = document.getElementById('y');
if (year) year.textContent = String(new Date().getFullYear());

/* ───── The site bar's sign-in goes to the panel's box on this page ───── */
for (const a of document.querySelectorAll('.tb-login, .tb-sheet-login')) {
  a.setAttribute('href', '#signin');
  const label = a.querySelector('span');
  if (label) label.textContent = T('პანელში შესვლა', 'Sign in to the panel');
}

/* ───── The day in the hero reads today's date ───── */
const dayDate = document.getElementById('day-date');
if (dayDate) {
  // Georgian names by hand: a browser without Georgian locale data prints „M10 16, Fri“.
  const d = new Date();
  const KA_DAYS = ['კვირა', 'ორშაბათი', 'სამშაბათი', 'ოთხშაბათი', 'ხუთშაბათი', 'პარასკევი', 'შაბათი'];
  const KA_MONTHS = ['იანვარი', 'თებერვალი', 'მარტი', 'აპრილი', 'მაისი', 'ივნისი', 'ივლისი', 'აგვისტო', 'სექტემბერი', 'ოქტომბერი', 'ნოემბერი', 'დეკემბერი'];
  const EN_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const EN_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  dayDate.textContent = I18N.isEn
    ? `${EN_DAYS[d.getDay()]}, ${d.getDate()} ${EN_MONTHS[d.getMonth()]}`
    : `${KA_DAYS[d.getDay()]}, ${d.getDate()} ${KA_MONTHS[d.getMonth()]}`;
}

/* ───── Screenshots: one frame, the list (or the chips on a phone) picks the page ───── */
const frameImg = document.getElementById('frame-img');
const frameUrl = document.getElementById('frame-url');
const caption = document.getElementById('shot-caption');
const shots = Array.from(document.querySelectorAll('.shot'));
const chips = Array.from(document.querySelectorAll('.shot-chips button'));
const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
function showShot(key) {
  shots.forEach((b) => { const on = b.dataset.shot === key; b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', String(on)); });
  chips.forEach((b) => { const on = b.dataset.shot === key; b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', String(on)); });
  const src = shots.find((b) => b.dataset.shot === key);
  if (!src || !frameImg) return;
  if (frameImg.dataset.key !== key) {
    frameImg.style.opacity = '0';
    const next = new Image();
    next.onload = () => { frameImg.src = next.src; frameImg.style.opacity = '1'; };
    next.src = `/business/img/${key}.webp?v=1`;
    frameImg.dataset.key = key;
  }
  if (frameUrl) frameUrl.innerHTML = `medicard.ge/business/<b>${src.dataset.path || key}</b>`;
  if (caption) caption.textContent = src.querySelector('.shot-desc')?.textContent || '';
}
shots.forEach((b) => {
  b.addEventListener('click', () => showShot(b.dataset.shot));
  if (fine) b.addEventListener('pointerenter', () => showShot(b.dataset.shot));
});
chips.forEach((b) => b.addEventListener('click', () => showShot(b.dataset.shot)));
if (shots.length) showShot(shots.find((b) => b.classList.contains('is-on'))?.dataset.shot || shots[0].dataset.shot);

/* ───── Claim / register: remember the intent for /business/start, scroll to the box ───── */
const authBox = document.getElementById('auth');
for (const b of document.querySelectorAll('[data-intent]')) {
  b.addEventListener('click', (e) => {
    e.preventDefault();
    try { sessionStorage.setItem('medicard.business.intent', b.dataset.intent); } catch { /* private mode */ }
    if (getToken()) { location.assign(`${PANEL}start?mode=${b.dataset.intent}`); return; }
    document.getElementById('signin')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(() => authBox?.querySelector('input')?.focus({ preventScroll: true }), 600);
  });
}

/* ───── The box: sign in, or carry on into the panel when already signed in ───── */
function signedCard(user) {
  const name = String(user?.fullName || '').trim();
  const initial = (name || 'M').slice(0, 1).toUpperCase();
  authBox.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'signed';
  wrap.innerHTML =
    `<h1>${T('შენ უკვე შესული ხარ', 'You are signed in')}</h1>` +
    `<p class="lead">${T('იგივე MEDICARD ანგარიშით, რაც აპში. პანელი ერთ ნაბიჯზეა — ბიზნესი დაადასტურე ან დაარეგისტრირე.', 'With the same MEDICARD account as in the app. The panel is one step away — claim or register your business.')}</p>` +
    `<div class="signed-who"><i>${initial}</i><div><b>${name || T('MEDICARD ანგარიში', 'MEDICARD account')}</b><small>${user?.phone || user?.email?.replace(/@(phone|apple)\.medicard\.ge$/, '') || ''}</small></div></div>` +
    `<a class="btn btn-primary btn-block" href="${PANEL}">${T('პანელში გადასვლა', 'Open the panel')}</a>` +
    `<div class="auth-switch">${T('სხვა ანგარიშით? ', 'A different account? ')}<button type="button" id="auth-out">${T('გასვლა', 'Sign out')}</button></div>`;
  authBox.appendChild(wrap);
  wrap.querySelector('#auth-out').addEventListener('click', () => { signOut(); mountAuth(); });
}
function mountAuth() {
  if (!authBox) return;
  authBox.innerHTML = '';
  // The box focuses its first field right after mounting, which would scroll the page down to it on load.
  // Mounted hidden, the focus is a no-op; the box shows a moment later where it is.
  authBox.style.visibility = 'hidden';
  renderAuthPanel(authBox, { onDone: () => location.assign(PANEL) });
  setTimeout(() => { authBox.style.visibility = ''; }, 160);
}
if (authBox) {
  if (getToken()) {
    loadSession().then((me) => signedCard(me.user)).catch((e) => {
      if (e?.status === 401) signOut();
      mountAuth();
    });
  } else {
    mountAuth();
  }
}
