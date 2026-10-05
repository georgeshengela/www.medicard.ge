// MEDICARD web — sign in / sign up / password reset. Same endpoints as the app.
import { h, mount, icon, button, busy, field, input } from './ui.js';
import { post } from './api.js';
import { signIn } from './session.js';
import { t, lang, isEn, setLang } from './i18n.js';
import { socialBlock, showSocialLink } from './social.js';

let onDoneCb = () => {};

const PRIVACY_URL = isEn ? '/privacy-en' : '/privacy';
const TERMS_URL = isEn ? '/terms-en' : '/terms';

/** ქა | EN before sign-in (page top-right: over the form on desktop, beside the brand on phones). */
function langSwitch() {
  const other = isEn ? 'ka' : 'en';
  return h('button', {
    type: 'button',
    class: 'lang-pill',
    lang: other,
    title: isEn ? 'ქართულად' : 'Switch to English',
    'aria-label': isEn ? 'ენის შეცვლა: ქართული' : 'Change language: English',
    style: { position: 'absolute', top: '20px', right: '20px', margin: 0, zIndex: 2 },
    onClick: () => setLang(other),
  }, h('span', { class: lang === 'ka' ? 'on' : '' }, 'ქა'), h('span', { class: lang === 'en' ? 'on' : '' }, 'EN'));
}

export function renderAuth(root, { query = {}, onDone }) {
  onDoneCb = onDone;
  const panel = h('div', { class: 'auth-box' });
  const layout = h('div', { class: 'auth', style: { position: 'relative' } },
    langSwitch(),
    h('div', { class: 'auth-art' },
      h('a', { class: 'brand', href: '/' }, h('img', { src: '/icon.png', alt: '' }), t('მედიქარდი', 'MEDICARD')),
      h('div', null,
        h('h2', null, t('შენი ჯანმრთელობა, ახლა ვებზეც.', 'Your health, now on the web too.')),
        h('p', null, t('იგივე ანგარიში, რაც აპში. მედიკამენტები, ანალიზები, კვება, ციკლი და Medi — დიდ ეკრანზე, სტატისტიკით და ჩარტებით.', 'The same account as in the app. Medications, lab results, nutrition, cycle and Medi — on a big screen, with stats and charts.')),
        h('div', { class: 'auth-points' },
          point('pill', t('მიღებების გრაფიკი', 'Dose schedule')),
          point('flask', t('ანალიზების დინამიკა', 'Lab result trends')),
          point('apple', t('კალორიები და მაკროები', 'Calories and macros')),
          point('sparkles', t('Medi — AI ასისტენტი', 'Medi — AI assistant')))),
      h('div', { class: 'auth-foot' },
        h('span', null, t('© მედიქარდი', '© MEDICARD')),
        h('a', { href: PRIVACY_URL }, t('კონფიდენციალურობა', 'Privacy')),
        h('a', { href: TERMS_URL }, t('წესები', 'Terms')),
        h('a', { href: '/' }, t('მთავარი საიტი', 'Main site')))),
    h('div', { class: 'auth-panel' }, panel));
  mount(root, layout);
  if (query.mode === 'register') showRegister(panel);
  else if (query.mode === 'email') showSignIn(panel, 'email');
  else if (query.mode === 'phone') showSignIn(panel, 'phone');
  else showSignIn(panel);
  // iPhone / iPad: the app first, the web as the alternative (/app-promo.js, at most every 14 days).
  window.MedicardAppPromo?.show({ mode: 'sheet' });
}

/* Phone or email — the same switch as the app's sign-in; the method used last on this browser opens
   first, otherwise phone in Georgian (only Georgian numbers get the SMS) and email in English. */
const METHOD_KEY = 'medicard.web.signInMethod';
function lastMethod() {
  try { const v = localStorage.getItem(METHOD_KEY); return v === 'phone' || v === 'email' ? v : null; } catch { return null; }
}
function rememberMethod(method) { try { localStorage.setItem(METHOD_KEY, method); } catch { /* private mode */ } }
function defaultMethod() { return lastMethod() || (lang === 'ka' ? 'phone' : 'email'); }

function point(ic, text) { return h('div', { class: 'auth-point' }, icon(ic, { size: 18 }), text); }

function done(res) {
  if (!res?.token) throw new Error(t('ავტორიზაცია ვერ შესრულდა.', 'Sign-in failed.'));
  signIn(res.token, res.user);
  history.replaceState({}, '', location.pathname);
  onDoneCb();
}

/** Apple / Google buttons; an address that already has a password account goes to the link step. */
function social(panel, back, divider) {
  return socialBlock({
    divider,
    onSignedIn: done,
    onLink: (link) => showSocialLink(panel, link, { onSignedIn: done, onBack: () => back(panel), onForgot: (email) => showForgot(panel, email) }),
  });
}

function errBox() { return h('div', { class: 'form-error', hidden: true, role: 'alert' }); }
function showErr(box, e) { box.textContent = e?.message || t('ვერ შესრულდა. სცადე ხელახლა.', 'Something went wrong. Please try again.'); box.hidden = false; }

function legal() {
  return isEn
    ? h('p', { class: 'legal-note' }, 'By continuing, you agree to the ', h('a', { href: TERMS_URL, target: '_blank' }, 'Terms'), ' and the ', h('a', { href: PRIVACY_URL, target: '_blank' }, 'Privacy Policy'), '.')
    : h('p', { class: 'legal-note' }, 'გაგრძელებით ეთანხმები ', h('a', { href: TERMS_URL, target: '_blank' }, 'წესებს'), ' და ', h('a', { href: PRIVACY_URL, target: '_blank' }, 'კონფიდენციალურობის პოლიტიკას'), '.');
}

function normPhone(v) {
  let d = String(v || '').replace(/\D/g, '');
  if (d.startsWith('995')) d = d.slice(3);
  return d;
}

/* ── Sign in: Apple / Google, then Phone | Email ─────── */
function showSignIn(panel, method = defaultMethod(), preset = '') {
  const pick = (m, label) => h('button', {
    type: 'button', role: 'radio', 'aria-checked': String(m === method), class: m === method ? 'on' : '',
    onClick: () => { if (m !== method) showSignIn(panel, m); },
  }, label);
  const { form, focus } = method === 'phone' ? phoneForm(panel, preset) : emailForm(panel);
  mount(panel,
    h('h1', null, t('შესვლა', 'Sign in')),
    h('p', { class: 'lead' }, t('ერთი ანგარიში ვებზეც და აპშიც — შედი იმ გზით, რითაც ანგარიში შექმენი.', 'One account on the web and in the app — sign in the way you created it.')),
    social(panel, (p) => showSignIn(p, method), 'after'),
    h('div', { class: 'auth-method', role: 'radiogroup', 'aria-label': t('შესვლის გზა', 'Sign-in method') },
      pick('phone', t('ტელეფონი', 'Phone')), pick('email', t('ელ-ფოსტა', 'Email'))),
    form,
    h('div', { class: 'auth-switch' }, t('ანგარიში არ გაქვს? ', 'Don’t have an account? '), h('button', { type: 'button', onClick: () => showRegister(panel) }, t('რეგისტრაცია', 'Sign up'))),
    legal());
  setTimeout(focus, 30);
}

function phoneForm(panel, preset = '') {
  const err = errBox();
  const phone = input({ type: 'tel', inputmode: 'numeric', autocomplete: 'tel-national', placeholder: '5XX XXX XXX', maxlength: 12, value: preset });
  const submit = button(t('კოდის მიღება', 'Get code'), { type: 'submit', size: 'lg', class: 'btn-block' });
  const form = h('form', { class: 'form', onSubmit: async (e) => {
    e.preventDefault();
    err.hidden = true;
    const p = normPhone(phone.value);
    if (!/^5\d{8}$/.test(p)) { showErr(err, { message: t('შეიყვანე ქართული მობილურის ნომერი: 5XX XXX XXX', 'Enter a Georgian mobile number: 5XX XXX XXX') }); return; }
    await busy(submit, async () => {
      try {
        const res = await post('/api/auth/phone/start', { phone: p });
        showOtp(panel, p, res);
      } catch (e2) { showErr(err, e2); }
    });
  } },
  field(t('ტელეფონის ნომერი', 'Phone number'), h('div', { class: 'phone-wrap' }, h('span', null, '+995'), phone)),
  h('p', { class: 'faint', style: { fontSize: '12.5px', marginTop: '-4px' } }, t('SMS-ით მიიღებ 4-ნიშნა კოდს. ახალ ნომერზე ანგარიში ავტომატურად შეიქმნება.', 'We’ll text you a 4-digit code. A new number gets an account automatically.')),
  err, submit);
  return { form, focus: () => phone.focus() };
}

/** One field for the 4-digit code: paste, SMS autofill and fast typing all just work. */
function otpInputs(onComplete) {
  const box = input({ class: 'input otp-input', inputmode: 'numeric', maxlength: 4, autocomplete: 'one-time-code', placeholder: '••••', 'aria-label': t('4-ნიშნა კოდი', '4-digit code') });
  box.addEventListener('input', () => {
    box.value = box.value.replace(/\D/g, '').slice(0, 4);
    if (box.value.length === 4) onComplete(box.value);
  });
  return { el: box, value: () => box.value, clear: () => { box.value = ''; box.focus(); }, focus: () => box.focus() };
}

function showOtp(panel, phone, startRes) {
  const err = errBox();
  let sending = false;
  const submit = button(t('შესვლა', 'Sign in'), { type: 'submit', size: 'lg', class: 'btn-block' });
  const verify = async (code) => {
    if (sending) return;
    sending = true;
    err.hidden = true;
    await busy(submit, async () => {
      try {
        const res = await post('/api/auth/phone/verify', { phone, code });
        rememberMethod('phone');
        done(res);
      } catch (e) { showErr(err, e); otp.clear(); }
    });
    sending = false;
  };
  const otp = otpInputs(verify);
  let cooldown = Number(startRes?.cooldownSec) || 60;
  const resend = h('button', { type: 'button', class: 'text-btn', disabled: true });
  const tick = () => {
    if (!resend.isConnected) return;
    if (cooldown > 0) { resend.textContent = t(`ხელახლა გაგზავნა ${cooldown} წამში`, `Resend in ${cooldown} s`); resend.disabled = true; cooldown -= 1; setTimeout(tick, 1000); }
    else { resend.textContent = t('კოდის ხელახლა გაგზავნა', 'Resend code'); resend.disabled = false; }
  };
  resend.addEventListener('click', async () => {
    resend.disabled = true;
    try { const r = await post('/api/auth/phone/start', { phone }); cooldown = Number(r?.cooldownSec) || 60; tick(); } catch (e) { showErr(err, e); resend.disabled = false; }
  });
  const form = h('form', { class: 'form', onSubmit: (e) => { e.preventDefault(); if (otp.value().length === 4) verify(otp.value()); } }, otp.el, err, submit);
  const pretty = phone.replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3');
  mount(panel,
    h('button', { class: 'back text-btn', type: 'button', onClick: () => showSignIn(panel, 'phone', phone) }, icon('chevronLeft', { size: 16 }), t('ნომრის შეცვლა', 'Change number')),
    h('h1', { style: { marginTop: '14px' } }, t('შეიყვანე კოდი', 'Enter the code')),
    h('p', { class: 'lead' }, t(`4-ნიშნა კოდი გაიგზავნა ნომერზე +995 ${pretty}.`, `We sent a 4-digit code to +995 ${pretty}.`)),
    startRes?.devCode ? h('p', { class: 'badge badge-warn', style: { marginBottom: '14px' } }, t(`სატესტო კოდი: ${startRes.devCode}`, `Test code: ${startRes.devCode}`)) : null,
    form,
    h('div', { class: 'auth-switch' }, resend));
  tick();
  setTimeout(() => otp.focus(), 30);
}

/* ── Email + password ─────────────────────────────── */
function emailForm(panel) {
  const err = errBox();
  const email = input({ type: 'email', autocomplete: 'email', placeholder: 'name@example.com', required: true });
  const pass = input({ type: 'password', autocomplete: 'current-password', placeholder: '••••••••', required: true });
  const submit = button(t('შესვლა', 'Sign in'), { type: 'submit', size: 'lg', class: 'btn-block' });
  const form = h('form', { class: 'form', onSubmit: async (e) => {
    e.preventDefault();
    err.hidden = true;
    await busy(submit, async () => {
      try {
        const res = await post('/api/auth/login', { email: email.value.trim(), password: pass.value });
        rememberMethod('email');
        done(res);
      } catch (e2) { showErr(err, e2); }
    });
  } },
  field(t('ელ-ფოსტა', 'Email'), email),
  field(t('პაროლი', 'Password'), passwordWrap(pass)),
  h('div', { style: { textAlign: 'right', marginTop: '-4px' } }, h('button', { type: 'button', class: 'text-btn', style: { fontSize: '13.5px' }, onClick: () => showForgot(panel, email.value) }, t('დაგავიწყდა პაროლი?', 'Forgot password?'))),
  err, submit);
  return { form, focus: () => email.focus() };
}

function passwordWrap(inp) {
  const eye = h('button', { type: 'button', class: 'icon-btn', title: t('პაროლის ჩვენება', 'Show password'), style: { position: 'absolute', right: '4px', top: '50%', transform: 'translateY(-50%)' }, onClick: () => {
    inp.type = inp.type === 'password' ? 'text' : 'password';
    mount(eye, icon(inp.type === 'password' ? 'eye' : 'eyeOff', { size: 18 }));
  } }, icon('eye', { size: 18 }));
  inp.style.paddingRight = '48px';
  return h('div', { style: { position: 'relative' } }, inp, eye);
}

/* ── Register (email) ─────────────────────────────── */
function showRegister(panel) {
  const err = errBox();
  const name = input({ autocomplete: 'name', placeholder: t('სახელი გვარი', 'First and last name'), required: true, minlength: 2 });
  const email = input({ type: 'email', autocomplete: 'email', placeholder: 'name@example.com', required: true });
  const pass = input({ type: 'password', autocomplete: 'new-password', placeholder: t('მინიმუმ 8 სიმბოლო', 'At least 8 characters'), required: true, minlength: 8 });
  const submit = button(t('ანგარიშის შექმნა', 'Create account'), { type: 'submit', size: 'lg', class: 'btn-block' });
  const form = h('form', { class: 'form', onSubmit: async (e) => {
    e.preventDefault();
    err.hidden = true;
    if (pass.value.length < 8) { showErr(err, { message: t('პაროლი უნდა შეიცავდეს მინიმუმ 8 სიმბოლოს', 'Your password needs at least 8 characters') }); return; }
    await busy(submit, async () => {
      try { done(await post('/api/auth/register', { fullName: name.value.trim(), email: email.value.trim(), password: pass.value })); } catch (e2) { showErr(err, e2); }
    });
  } },
  field(t('სახელი და გვარი', 'Full name'), name),
  field(t('ელ-ფოსტა', 'Email'), email),
  field(t('პაროლი', 'Password'), passwordWrap(pass)),
  err, submit);
  mount(panel,
    h('h1', null, t('რეგისტრაცია', 'Sign up')),
    h('p', { class: 'lead' }, t('MEDICARD სრულიად უფასოა. ანგარიში აპშიც და ვებზეც ერთია. სერვისი 18 წლიდანაა.', 'MEDICARD is completely free. One account works in the app and on the web. You must be 18 or older.')),
    form,
    social(panel, showRegister, 'before'),
    h('div', { class: 'auth-switch', style: { marginTop: '14px' } }, h('button', { type: 'button', onClick: () => showSignIn(panel, 'phone') }, t('ტელეფონის ნომრით რეგისტრაცია', 'Sign up with a phone number'))),
    h('div', { class: 'auth-switch' }, t('უკვე გაქვს ანგარიში? ', 'Already have an account? '), h('button', { type: 'button', onClick: () => showSignIn(panel) }, t('შესვლა', 'Sign in'))),
    legal());
  setTimeout(() => name.focus(), 30);
}

/* ── Forgot password ──────────────────────────────── */
function showForgot(panel, presetEmail = '') {
  const err = errBox();
  const email = input({ type: 'email', autocomplete: 'email', placeholder: 'name@example.com', required: true, value: presetEmail });
  const submit = button(t('კოდის გაგზავნა', 'Send code'), { type: 'submit', size: 'lg', class: 'btn-block' });
  const form = h('form', { class: 'form', onSubmit: async (e) => {
    e.preventDefault();
    err.hidden = true;
    await busy(submit, async () => {
      try {
        const r = await post('/api/auth/password/forgot', { email: email.value.trim() });
        showReset(panel, email.value.trim(), r);
      } catch (e2) { showErr(err, e2); }
    });
  } }, field(t('ელ-ფოსტა', 'Email'), email), err, submit);
  mount(panel,
    h('button', { class: 'back text-btn', type: 'button', onClick: () => showSignIn(panel, 'email') }, icon('chevronLeft', { size: 16 }), t('უკან', 'Back')),
    h('h1', { style: { marginTop: '14px' } }, t('პაროლის აღდგენა', 'Reset password')),
    h('p', { class: 'lead' }, t('ელ-ფოსტაზე გამოგიგზავნით 6-ნიშნა კოდს.', 'We’ll email you a 6-digit code.')),
    form,
    h('div', { class: 'auth-switch' }, t('ანგარიშში ტელეფონით შედიხარ? ', 'Do you sign in with your phone? '), h('button', { type: 'button', onClick: () => showSignIn(panel, 'phone') }, t('SMS კოდით შესვლა', 'Sign in with SMS code'))));
  setTimeout(() => email.focus(), 30);
}

function showReset(panel, email, res) {
  const err = errBox();
  const code = input({ inputmode: 'numeric', maxlength: 6, placeholder: '000000', autocomplete: 'one-time-code', required: true, value: res?.devCode || '' });
  const pass = input({ type: 'password', autocomplete: 'new-password', placeholder: t('მინიმუმ 8 სიმბოლო', 'At least 8 characters'), required: true });
  const pass2 = input({ type: 'password', autocomplete: 'new-password', placeholder: t('გაიმეორე პაროლი', 'Repeat password'), required: true });
  const submit = button(t('პაროლის შეცვლა', 'Change password'), { type: 'submit', size: 'lg', class: 'btn-block' });
  const form = h('form', { class: 'form', onSubmit: async (e) => {
    e.preventDefault();
    err.hidden = true;
    await busy(submit, async () => {
      try {
        await post('/api/auth/password/reset', { email, code: code.value.trim(), password: pass.value, confirmPassword: pass2.value });
        done(await post('/api/auth/login', { email, password: pass.value }));
      } catch (e2) { showErr(err, e2); }
    });
  } }, field(t('კოდი ელ-ფოსტიდან', 'Code from the email'), code), field(t('ახალი პაროლი', 'New password'), passwordWrap(pass)), field(t('გაიმეორე', 'Repeat'), pass2), err, submit);
  mount(panel,
    h('button', { class: 'back text-btn', type: 'button', onClick: () => showForgot(panel, email) }, icon('chevronLeft', { size: 16 }), t('უკან', 'Back')),
    h('h1', { style: { marginTop: '14px' } }, t('ახალი პაროლი', 'New password')),
    h('p', { class: 'lead' }, res?.message || t(`კოდი გაიგზავნა: ${email}`, `Code sent to ${email}`)),
    form);
  setTimeout(() => code.focus(), 30);
}
