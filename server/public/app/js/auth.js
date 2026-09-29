// MEDICARD web — sign in / sign up / password reset. Same endpoints as the app.
import { h, mount, icon, button, busy, field, input } from './ui.js';
import { post } from './api.js';
import { signIn } from './session.js';

let onDoneCb = () => {};

export function renderAuth(root, { query = {}, onDone }) {
  onDoneCb = onDone;
  const panel = h('div', { class: 'auth-box' });
  const layout = h('div', { class: 'auth' },
    h('div', { class: 'auth-art' },
      h('a', { class: 'brand', href: '/' }, h('img', { src: '/icon.png', alt: '' }), 'მედიქარდი'),
      h('div', null,
        h('h2', null, 'შენი ჯანმრთელობა, ახლა ვებზეც.'),
        h('p', null, 'იგივე ანგარიში, რაც აპში. მედიკამენტები, ანალიზები, კვება, ციკლი და Medi — დიდ ეკრანზე, სტატისტიკით და ჩარტებით.'),
        h('div', { class: 'auth-points' },
          point('pill', 'მიღებების გრაფიკი'),
          point('flask', 'ანალიზების დინამიკა'),
          point('apple', 'კალორიები და მაკროები'),
          point('sparkles', 'Medi — AI ასისტენტი'))),
      h('div', { class: 'auth-foot' },
        h('span', null, '© მედიქარდი'),
        h('a', { href: '/privacy' }, 'კონფიდენციალურობა'),
        h('a', { href: '/terms' }, 'წესები'),
        h('a', { href: '/' }, 'მთავარი საიტი'))),
    h('div', { class: 'auth-panel' }, panel));
  mount(root, layout);
  if (query.mode === 'register') showRegister(panel);
  else if (query.mode === 'email') showEmail(panel);
  else showPhone(panel);
}

function point(ic, text) { return h('div', { class: 'auth-point' }, icon(ic, { size: 18 }), text); }

function done(res) {
  if (!res?.token) throw new Error('ავტორიზაცია ვერ შესრულდა.');
  signIn(res.token, res.user);
  history.replaceState({}, '', location.pathname);
  onDoneCb();
}

function errBox() { return h('div', { class: 'form-error', hidden: true, role: 'alert' }); }
function showErr(box, e) { box.textContent = e?.message || 'ვერ შესრულდა. სცადე ხელახლა.'; box.hidden = false; }

function legal() {
  return h('p', { class: 'legal-note' }, 'გაგრძელებით ეთანხმები ', h('a', { href: '/terms', target: '_blank' }, 'წესებს'), ' და ', h('a', { href: '/privacy', target: '_blank' }, 'კონფიდენციალურობის პოლიტიკას'), '.');
}

function normPhone(v) {
  let d = String(v || '').replace(/\D/g, '');
  if (d.startsWith('995')) d = d.slice(3);
  return d;
}

/* ── Phone (SMS code) ─────────────────────────────── */
function showPhone(panel, preset = '') {
  const err = errBox();
  const phone = input({ type: 'tel', inputmode: 'numeric', autocomplete: 'tel-national', placeholder: '5XX XXX XXX', maxlength: 12, value: preset });
  const submit = button('კოდის მიღება', { type: 'submit', size: 'lg', class: 'btn-block' });
  const form = h('form', { class: 'form', onSubmit: async (e) => {
    e.preventDefault();
    err.hidden = true;
    const p = normPhone(phone.value);
    if (!/^5\d{8}$/.test(p)) { showErr(err, { message: 'შეიყვანე ქართული მობილურის ნომერი: 5XX XXX XXX' }); return; }
    await busy(submit, async () => {
      try {
        const res = await post('/api/auth/phone/start', { phone: p });
        showOtp(panel, p, res);
      } catch (e2) { showErr(err, e2); }
    });
  } },
  field('ტელეფონის ნომერი', h('div', { class: 'phone-wrap' }, h('span', null, '+995'), phone)),
  err, submit);

  mount(panel,
    h('h1', null, 'შესვლა'),
    h('p', { class: 'lead' }, 'შეიყვანე ნომერი — SMS-ით მიიღებ 4-ნიშნა კოდს. ახალ ნომერზე ანგარიში ავტომატურად შეიქმნება.'),
    form,
    h('div', { class: 'divider' }, 'ან'),
    button('ელ-ფოსტით შესვლა', { variant: 'ghost', size: 'lg', class: 'btn-block', icon: 'mail', onClick: () => showEmail(panel) }),
    h('div', { class: 'auth-switch' }, 'ანგარიში ელ-ფოსტით გინდა? ', h('button', { type: 'button', onClick: () => showRegister(panel) }, 'რეგისტრაცია')),
    legal());
  setTimeout(() => phone.focus(), 30);
}

/** One field for the 4-digit code: paste, SMS autofill and fast typing all just work. */
function otpInputs(onComplete) {
  const box = input({ class: 'input otp-input', inputmode: 'numeric', maxlength: 4, autocomplete: 'one-time-code', placeholder: '••••', 'aria-label': '4-ნიშნა კოდი' });
  box.addEventListener('input', () => {
    box.value = box.value.replace(/\D/g, '').slice(0, 4);
    if (box.value.length === 4) onComplete(box.value);
  });
  return { el: box, value: () => box.value, clear: () => { box.value = ''; box.focus(); }, focus: () => box.focus() };
}

function showOtp(panel, phone, startRes) {
  const err = errBox();
  let sending = false;
  const submit = button('შესვლა', { type: 'submit', size: 'lg', class: 'btn-block' });
  const verify = async (code) => {
    if (sending) return;
    sending = true;
    err.hidden = true;
    await busy(submit, async () => {
      try { done(await post('/api/auth/phone/verify', { phone, code })); } catch (e) { showErr(err, e); otp.clear(); }
    });
    sending = false;
  };
  const otp = otpInputs(verify);
  let cooldown = Number(startRes?.cooldownSec) || 60;
  const resend = h('button', { type: 'button', class: 'text-btn', disabled: true });
  const tick = () => {
    if (!resend.isConnected) return;
    if (cooldown > 0) { resend.textContent = `ხელახლა გაგზავნა ${cooldown} წამში`; resend.disabled = true; cooldown -= 1; setTimeout(tick, 1000); }
    else { resend.textContent = 'კოდის ხელახლა გაგზავნა'; resend.disabled = false; }
  };
  resend.addEventListener('click', async () => {
    resend.disabled = true;
    try { const r = await post('/api/auth/phone/start', { phone }); cooldown = Number(r?.cooldownSec) || 60; tick(); } catch (e) { showErr(err, e); resend.disabled = false; }
  });
  const form = h('form', { class: 'form', onSubmit: (e) => { e.preventDefault(); if (otp.value().length === 4) verify(otp.value()); } }, otp.el, err, submit);
  mount(panel,
    h('button', { class: 'back text-btn', type: 'button', onClick: () => showPhone(panel, phone) }, icon('chevronLeft', { size: 16 }), 'ნომრის შეცვლა'),
    h('h1', { style: { marginTop: '14px' } }, 'შეიყვანე კოდი'),
    h('p', { class: 'lead' }, `4-ნიშნა კოდი გაიგზავნა ნომერზე +995 ${phone.replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3')}.`),
    startRes?.devCode ? h('p', { class: 'badge badge-warn', style: { marginBottom: '14px' } }, `სატესტო კოდი: ${startRes.devCode}`) : null,
    form,
    h('div', { class: 'auth-switch' }, resend));
  tick();
  setTimeout(() => otp.focus(), 30);
}

/* ── Email + password ─────────────────────────────── */
function showEmail(panel) {
  const err = errBox();
  const email = input({ type: 'email', autocomplete: 'email', placeholder: 'name@example.com', required: true });
  const pass = input({ type: 'password', autocomplete: 'current-password', placeholder: '••••••••', required: true });
  const submit = button('შესვლა', { type: 'submit', size: 'lg', class: 'btn-block' });
  const form = h('form', { class: 'form', onSubmit: async (e) => {
    e.preventDefault();
    err.hidden = true;
    await busy(submit, async () => {
      try { done(await post('/api/auth/login', { email: email.value.trim(), password: pass.value })); } catch (e2) { showErr(err, e2); }
    });
  } },
  field('ელ-ფოსტა', email),
  field('პაროლი', passwordWrap(pass)),
  h('div', { style: { textAlign: 'right', marginTop: '-4px' } }, h('button', { type: 'button', class: 'text-btn', style: { fontSize: '13.5px' }, onClick: () => showForgot(panel, email.value) }, 'დაგავიწყდა პაროლი?')),
  err, submit);
  mount(panel,
    h('h1', null, 'ელ-ფოსტით შესვლა'),
    h('p', { class: 'lead' }, 'იგივე ელ-ფოსტა და პაროლი, რითაც აპში შედიხარ.'),
    form,
    h('div', { class: 'divider' }, 'ან'),
    button('SMS კოდით შესვლა', { variant: 'ghost', size: 'lg', class: 'btn-block', icon: 'smartphone', onClick: () => showPhone(panel) }),
    h('div', { class: 'auth-switch' }, 'ანგარიში არ გაქვს? ', h('button', { type: 'button', onClick: () => showRegister(panel) }, 'რეგისტრაცია')),
    legal());
  setTimeout(() => email.focus(), 30);
}

function passwordWrap(inp) {
  const eye = h('button', { type: 'button', class: 'icon-btn', title: 'პაროლის ჩვენება', style: { position: 'absolute', right: '4px', top: '50%', transform: 'translateY(-50%)' }, onClick: () => {
    inp.type = inp.type === 'password' ? 'text' : 'password';
    mount(eye, icon(inp.type === 'password' ? 'eye' : 'eyeOff', { size: 18 }));
  } }, icon('eye', { size: 18 }));
  inp.style.paddingRight = '48px';
  return h('div', { style: { position: 'relative' } }, inp, eye);
}

/* ── Register (email) ─────────────────────────────── */
function showRegister(panel) {
  const err = errBox();
  const name = input({ autocomplete: 'name', placeholder: 'სახელი გვარი', required: true, minlength: 2 });
  const email = input({ type: 'email', autocomplete: 'email', placeholder: 'name@example.com', required: true });
  const pass = input({ type: 'password', autocomplete: 'new-password', placeholder: 'მინიმუმ 8 სიმბოლო', required: true, minlength: 8 });
  const submit = button('ანგარიშის შექმნა', { type: 'submit', size: 'lg', class: 'btn-block' });
  const form = h('form', { class: 'form', onSubmit: async (e) => {
    e.preventDefault();
    err.hidden = true;
    if (pass.value.length < 8) { showErr(err, { message: 'პაროლი უნდა შეიცავდეს მინიმუმ 8 სიმბოლოს' }); return; }
    await busy(submit, async () => {
      try { done(await post('/api/auth/register', { fullName: name.value.trim(), email: email.value.trim(), password: pass.value })); } catch (e2) { showErr(err, e2); }
    });
  } },
  field('სახელი და გვარი', name),
  field('ელ-ფოსტა', email),
  field('პაროლი', passwordWrap(pass)),
  err, submit);
  mount(panel,
    h('h1', null, 'რეგისტრაცია'),
    h('p', { class: 'lead' }, 'MEDICARD სრულიად უფასოა. ანგარიში აპშიც და ვებზეც ერთია. სერვისი 18 წლიდანაა.'),
    form,
    h('div', { class: 'auth-switch' }, 'უკვე გაქვს ანგარიში? ', h('button', { type: 'button', onClick: () => showPhone(panel) }, 'შესვლა')),
    legal());
  setTimeout(() => name.focus(), 30);
}

/* ── Forgot password ──────────────────────────────── */
function showForgot(panel, presetEmail = '') {
  const err = errBox();
  const email = input({ type: 'email', autocomplete: 'email', placeholder: 'name@example.com', required: true, value: presetEmail });
  const submit = button('კოდის გაგზავნა', { type: 'submit', size: 'lg', class: 'btn-block' });
  const form = h('form', { class: 'form', onSubmit: async (e) => {
    e.preventDefault();
    err.hidden = true;
    await busy(submit, async () => {
      try {
        const r = await post('/api/auth/password/forgot', { email: email.value.trim() });
        showReset(panel, email.value.trim(), r);
      } catch (e2) { showErr(err, e2); }
    });
  } }, field('ელ-ფოსტა', email), err, submit);
  mount(panel,
    h('button', { class: 'back text-btn', type: 'button', onClick: () => showEmail(panel) }, icon('chevronLeft', { size: 16 }), 'უკან'),
    h('h1', { style: { marginTop: '14px' } }, 'პაროლის აღდგენა'),
    h('p', { class: 'lead' }, 'ელ-ფოსტაზე გამოგიგზავნით 6-ნიშნა კოდს.'),
    form,
    h('div', { class: 'auth-switch' }, 'ანგარიშში ტელეფონით შედიხარ? ', h('button', { type: 'button', onClick: () => showPhone(panel) }, 'SMS კოდით შესვლა')));
  setTimeout(() => email.focus(), 30);
}

function showReset(panel, email, res) {
  const err = errBox();
  const code = input({ inputmode: 'numeric', maxlength: 6, placeholder: '000000', autocomplete: 'one-time-code', required: true, value: res?.devCode || '' });
  const pass = input({ type: 'password', autocomplete: 'new-password', placeholder: 'მინიმუმ 8 სიმბოლო', required: true });
  const pass2 = input({ type: 'password', autocomplete: 'new-password', placeholder: 'გაიმეორე პაროლი', required: true });
  const submit = button('პაროლის შეცვლა', { type: 'submit', size: 'lg', class: 'btn-block' });
  const form = h('form', { class: 'form', onSubmit: async (e) => {
    e.preventDefault();
    err.hidden = true;
    await busy(submit, async () => {
      try {
        await post('/api/auth/password/reset', { email, code: code.value.trim(), password: pass.value, confirmPassword: pass2.value });
        done(await post('/api/auth/login', { email, password: pass.value }));
      } catch (e2) { showErr(err, e2); }
    });
  } }, field('კოდი ელ-ფოსტიდან', code), field('ახალი პაროლი', passwordWrap(pass)), field('გაიმეორე', pass2), err, submit);
  mount(panel,
    h('button', { class: 'back text-btn', type: 'button', onClick: () => showForgot(panel, email) }, icon('chevronLeft', { size: 16 }), 'უკან'),
    h('h1', { style: { marginTop: '14px' } }, 'ახალი პაროლი'),
    h('p', { class: 'lead' }, res?.message || `კოდი გაიგზავნა: ${email}`),
    form);
  setTimeout(() => code.focus(), 30);
}
