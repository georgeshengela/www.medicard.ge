// MEDIBOOK business panel — sign in with the MEDICARD account (same endpoints as the app and /app).
import { h, mount, icon, button, busy, field, input } from '/app/js/ui.js';
import { post } from '/app/js/api.js';
import { signIn } from '/app/js/session.js';
import { t, lang, isEn } from '/app/js/i18n.js';
import { socialBlock, showSocialLink } from '/app/js/social.js';

const PRIVACY_URL = isEn ? '/privacy-en' : '/privacy';
const TERMS_URL = isEn ? '/terms-en' : '/terms';
const METHOD_KEY = 'medicard.web.signInMethod';
function lastMethod() { try { const v = localStorage.getItem(METHOD_KEY); return v === 'phone' || v === 'email' ? v : null; } catch { return null; } }
function rememberMethod(m) { try { localStorage.setItem(METHOD_KEY, m); } catch { /* private mode */ } }
function defaultMethod() { return lastMethod() || (lang === 'ka' ? 'phone' : 'email'); }

function errBox() { return h('div', { class: 'form-error', hidden: true, role: 'alert' }); }
function showErr(box, e) { box.textContent = e?.message || t('ვერ შესრულდა. სცადე ხელახლა.', 'Something went wrong. Please try again.'); box.hidden = false; }
function normPhone(v) { let d = String(v || '').replace(/\D/g, ''); if (d.startsWith('995')) d = d.slice(3); return d; }
function legal() {
  return isEn
    ? h('p', { class: 'legal-note' }, 'By continuing, you agree to the ', h('a', { href: TERMS_URL, target: '_blank' }, 'Terms'), ' and the ', h('a', { href: PRIVACY_URL, target: '_blank' }, 'Privacy Policy'), '.')
    : h('p', { class: 'legal-note' }, 'გაგრძელებით ეთანხმები ', h('a', { href: TERMS_URL, target: '_blank' }, 'წესებს'), ' და ', h('a', { href: PRIVACY_URL, target: '_blank' }, 'კონფიდენციალურობის პოლიტიკას'), '.');
}

/**
 * Renders the sign-in box into `panel`. `onDone()` runs once a token is saved.
 * Phone (SMS code) | Email, Apple / Google, sign-up by email. A new number gets an account on the spot.
 */
export function renderAuthPanel(panel, { onDone, intro } = {}) {
  const done = (res) => {
    if (!res?.token) throw new Error(t('ავტორიზაცია ვერ შესრულდა.', 'Sign-in failed.'));
    signIn(res.token, res.user);
    onDone?.();
  };
  const social = (back, divider) => socialBlock({
    divider,
    onSignedIn: done,
    onLink: (link) => showSocialLink(panel, link, { onSignedIn: done, onBack: () => back(), onForgot: (email) => showForgot(email) }),
  });

  function showSignIn(method = defaultMethod(), preset = '') {
    const pick = (m, label) => h('button', { type: 'button', role: 'radio', 'aria-checked': String(m === method), class: m === method ? 'on' : '', onClick: () => { if (m !== method) showSignIn(m); } }, label);
    const { form, focus } = method === 'phone' ? phoneForm(preset) : emailForm();
    mount(panel,
      h('h1', null, t('შესვლა ბიზნესის პანელში', 'Sign in to the business panel')),
      h('p', { class: 'lead' }, intro || t('იგივე MEDICARD ანგარიში, რითაც აპში შედიხარ. ანგარიში არ გაქვს? ტელეფონის ნომერზე ახლავე შეიქმნება.', 'The same MEDICARD account you use in the app. No account yet? Your phone number creates one right now.')),
      social(() => showSignIn(method), 'after'),
      h('div', { class: 'auth-method', role: 'radiogroup', 'aria-label': t('შესვლის გზა', 'Sign-in method') }, pick('phone', t('ტელეფონი', 'Phone')), pick('email', t('ელ-ფოსტა', 'Email'))),
      form,
      h('div', { class: 'auth-switch' }, t('ელ-ფოსტით რეგისტრაცია? ', 'Sign up with email? '), h('button', { type: 'button', onClick: showRegister }, t('ანგარიშის შექმნა', 'Create an account'))),
      legal());
    setTimeout(focus, 30);
  }

  function phoneForm(preset = '') {
    const err = errBox();
    const phone = input({ type: 'tel', inputmode: 'numeric', autocomplete: 'tel-national', placeholder: '5XX XXX XXX', maxlength: 12, value: preset });
    const submit = button(t('კოდის მიღება', 'Get code'), { type: 'submit', size: 'lg', class: 'btn-block' });
    const form = h('form', { class: 'form', onSubmit: async (e) => {
      e.preventDefault();
      err.hidden = true;
      const p = normPhone(phone.value);
      if (!/^5\d{8}$/.test(p)) { showErr(err, { message: t('შეიყვანე ქართული მობილურის ნომერი: 5XX XXX XXX', 'Enter a Georgian mobile number: 5XX XXX XXX') }); return; }
      await busy(submit, async () => {
        try { showOtp(p, await post('/api/auth/phone/start', { phone: p })); } catch (e2) { showErr(err, e2); }
      });
    } },
    field(t('ტელეფონის ნომერი', 'Phone number'), h('div', { class: 'phone-wrap' }, h('span', null, '+995'), phone)),
    h('p', { class: 'faint', style: { fontSize: '12.5px', marginTop: '-4px' } }, t('SMS-ით მიიღებ 4-ნიშნა კოდს.', 'We will text you a 4-digit code.')),
    err, submit);
    return { form, focus: () => phone.focus() };
  }

  function showOtp(phone, startRes) {
    const err = errBox();
    let sending = false;
    const submit = button(t('შესვლა', 'Sign in'), { type: 'submit', size: 'lg', class: 'btn-block' });
    const box = input({ class: 'input otp-input', inputmode: 'numeric', maxlength: 4, autocomplete: 'one-time-code', placeholder: '••••' });
    const verify = async (code) => {
      if (sending) return;
      sending = true;
      err.hidden = true;
      await busy(submit, async () => {
        try { const res = await post('/api/auth/phone/verify', { phone, code }); rememberMethod('phone'); done(res); } catch (e) { showErr(err, e); box.value = ''; box.focus(); }
      });
      sending = false;
    };
    box.addEventListener('input', () => { box.value = box.value.replace(/\D/g, '').slice(0, 4); if (box.value.length === 4) verify(box.value); });
    let cooldown = Number(startRes?.cooldownSec) || 60;
    const resend = h('button', { type: 'button', class: 'text-btn', disabled: true });
    const tick = () => {
      if (!resend.isConnected) return;
      if (cooldown > 0) { resend.textContent = t(`ხელახლა გაგზავნა ${cooldown} წამში`, `Resend in ${cooldown} s`); resend.disabled = true; cooldown -= 1; setTimeout(tick, 1000); }
      else { resend.textContent = t('კოდის ხელახლა გაგზავნა', 'Resend code'); resend.disabled = false; }
    };
    resend.addEventListener('click', async () => { resend.disabled = true; try { const r = await post('/api/auth/phone/start', { phone }); cooldown = Number(r?.cooldownSec) || 60; tick(); } catch (e) { showErr(err, e); resend.disabled = false; } });
    const pretty = phone.replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3');
    mount(panel,
      h('button', { class: 'back text-btn', type: 'button', onClick: () => showSignIn('phone', phone) }, icon('chevronLeft', { size: 16 }), t('ნომრის შეცვლა', 'Change number')),
      h('h1', { style: { marginTop: '14px' } }, t('შეიყვანე კოდი', 'Enter the code')),
      h('p', { class: 'lead' }, t(`4-ნიშნა კოდი გაიგზავნა ნომერზე +995 ${pretty}.`, `We sent a 4-digit code to +995 ${pretty}.`)),
      startRes?.devCode ? h('p', { class: 'badge badge-warn', style: { marginBottom: '14px' } }, t(`სატესტო კოდი: ${startRes.devCode}`, `Test code: ${startRes.devCode}`)) : null,
      h('form', { class: 'form', onSubmit: (e) => { e.preventDefault(); if (box.value.length === 4) verify(box.value); } }, box, err, submit),
      h('div', { class: 'auth-switch' }, resend));
    tick();
    setTimeout(() => box.focus(), 30);
  }

  function emailForm() {
    const err = errBox();
    const email = input({ type: 'email', autocomplete: 'email', placeholder: 'name@example.com', required: true });
    const pass = input({ type: 'password', autocomplete: 'current-password', placeholder: '••••••••', required: true });
    const submit = button(t('შესვლა', 'Sign in'), { type: 'submit', size: 'lg', class: 'btn-block' });
    const form = h('form', { class: 'form', onSubmit: async (e) => {
      e.preventDefault();
      err.hidden = true;
      await busy(submit, async () => {
        try { const res = await post('/api/auth/login', { email: email.value.trim(), password: pass.value }); rememberMethod('email'); done(res); } catch (e2) { showErr(err, e2); }
      });
    } },
    field(t('ელ-ფოსტა', 'Email'), email),
    field(t('პაროლი', 'Password'), pass),
    h('div', { style: { textAlign: 'right', marginTop: '-4px' } }, h('button', { type: 'button', class: 'text-btn', style: { fontSize: '13.5px' }, onClick: () => showForgot(email.value) }, t('დაგავიწყდა პაროლი?', 'Forgot password?'))),
    err, submit);
    return { form, focus: () => email.focus() };
  }

  function showRegister() {
    const err = errBox();
    const name = input({ autocomplete: 'name', placeholder: t('სახელი გვარი', 'First and last name'), required: true, minlength: 2 });
    const email = input({ type: 'email', autocomplete: 'email', placeholder: 'name@example.com', required: true });
    const pass = input({ type: 'password', autocomplete: 'new-password', placeholder: t('მინიმუმ 8 სიმბოლო', 'At least 8 characters'), required: true, minlength: 8 });
    const submit = button(t('ანგარიშის შექმნა', 'Create account'), { type: 'submit', size: 'lg', class: 'btn-block' });
    const form = h('form', { class: 'form', onSubmit: async (e) => {
      e.preventDefault();
      err.hidden = true;
      if (pass.value.length < 8) { showErr(err, { message: t('პაროლი უნდა შეიცავდეს მინიმუმ 8 სიმბოლოს', 'Your password needs at least 8 characters') }); return; }
      await busy(submit, async () => { try { done(await post('/api/auth/register', { fullName: name.value.trim(), email: email.value.trim(), password: pass.value })); } catch (e2) { showErr(err, e2); } });
    } }, field(t('სახელი და გვარი', 'Full name'), name), field(t('ელ-ფოსტა', 'Email'), email), field(t('პაროლი', 'Password'), pass), err, submit);
    mount(panel,
      h('h1', null, t('ანგარიშის შექმნა', 'Create an account')),
      h('p', { class: 'lead' }, t('MEDICARD ანგარიში პირადია — ბიზნესს მასზე დაამატებ შემდეგ ნაბიჯზე. სერვისი 18 წლიდანაა.', 'A MEDICARD account is personal — you add the business in the next step. You must be 18 or older.')),
      form,
      social(showRegister, 'before'),
      h('div', { class: 'auth-switch', style: { marginTop: '14px' } }, h('button', { type: 'button', onClick: () => showSignIn('phone') }, t('ტელეფონის ნომრით შესვლა', 'Sign in with a phone number'))),
      h('div', { class: 'auth-switch' }, t('უკვე გაქვს ანგარიში? ', 'Already have an account? '), h('button', { type: 'button', onClick: () => showSignIn() }, t('შესვლა', 'Sign in'))),
      legal());
    setTimeout(() => name.focus(), 30);
  }

  function showForgot(presetEmail = '') {
    const err = errBox();
    const email = input({ type: 'email', autocomplete: 'email', placeholder: 'name@example.com', required: true, value: presetEmail });
    const submit = button(t('კოდის გაგზავნა', 'Send code'), { type: 'submit', size: 'lg', class: 'btn-block' });
    const form = h('form', { class: 'form', onSubmit: async (e) => {
      e.preventDefault();
      err.hidden = true;
      await busy(submit, async () => { try { await post('/api/auth/password/forgot', { email: email.value.trim() }); showReset(email.value.trim()); } catch (e2) { showErr(err, e2); } });
    } }, field(t('ელ-ფოსტა', 'Email'), email), err, submit);
    mount(panel,
      h('button', { class: 'back text-btn', type: 'button', onClick: () => showSignIn('email') }, icon('chevronLeft', { size: 16 }), t('უკან', 'Back')),
      h('h1', { style: { marginTop: '14px' } }, t('პაროლის აღდგენა', 'Reset your password')),
      h('p', { class: 'lead' }, t('ელ-ფოსტაზე 6-ნიშნა კოდი მოგივა.', 'We will email you a 6-digit code.')),
      form);
    setTimeout(() => email.focus(), 30);
  }

  function showReset(email) {
    const err = errBox();
    const code = input({ inputmode: 'numeric', maxlength: 6, placeholder: '••••••', autocomplete: 'one-time-code', required: true });
    const pass = input({ type: 'password', autocomplete: 'new-password', placeholder: t('ახალი პაროლი', 'New password'), required: true, minlength: 8 });
    const pass2 = input({ type: 'password', autocomplete: 'new-password', placeholder: t('გაიმეორე', 'Repeat'), required: true, minlength: 8 });
    const submit = button(t('პაროლის შეცვლა', 'Change password'), { type: 'submit', size: 'lg', class: 'btn-block' });
    const form = h('form', { class: 'form', onSubmit: async (e) => {
      e.preventDefault();
      err.hidden = true;
      if (pass.value !== pass2.value) { showErr(err, { message: t('პაროლები არ ემთხვევა.', 'The passwords do not match.') }); return; }
      await busy(submit, async () => { try { done(await post('/api/auth/password/reset', { email, code: code.value.trim(), password: pass.value, confirmPassword: pass2.value })); } catch (e2) { showErr(err, e2); } });
    } }, field(t('კოდი', 'Code'), code), field(t('ახალი პაროლი', 'New password'), pass), field(t('გაიმეორე პაროლი', 'Repeat the password'), pass2), err, submit);
    mount(panel, h('h1', null, t('ახალი პაროლი', 'New password')), h('p', { class: 'lead' }, t(`კოდი გაიგზავნა: ${email}`, `Code sent to ${email}`)), form);
    setTimeout(() => code.focus(), 30);
  }

  showSignIn();
}
