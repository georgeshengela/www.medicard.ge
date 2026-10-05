// MEDICARD web — sign-in methods on one account (same rules as the app's Profile → „შესვლის გზები“):
// phone, email + password, Apple, Google. A method that belongs to another of the person's
// accounts opens the conflict modal: bring it here (the other account is empty and goes) or
// switch to the other account (this one goes only while it is empty). Health data never moves.
import { h, mount, button, busy, field, input, openModal, row, card, badge, toast, fmtDate } from './ui.js';
import { get, post, invalidate } from './api.js';
import { setUser, signIn } from './session.js';
import { socialBlock } from './social.js';
import { t } from './i18n.js';

const WHAT = {
  phone: () => t('ეს ნომერი', 'This number'),
  email: () => t('ეს ელ-ფოსტა', 'This email'),
  apple: () => t('ეს Apple ID', 'This Apple ID'),
  google: () => t('ეს Google ანგარიში', 'This Google account'),
};

const APPLE_SVG = '<svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true"><path fill="currentColor" d="M16.365 1.43c0 1.14-.493 2.27-1.177 3.08-.744.9-1.99 1.57-2.987 1.57-.12 0-.23-.02-.3-.03-.01-.06-.04-.22-.04-.39 0-1.15.572-2.27 1.206-2.98.804-.94 2.142-1.64 3.248-1.68.03.13.05.28.05.43zm4.565 15.71c-.03.07-.463 1.58-1.518 3.12-.945 1.34-1.94 2.71-3.43 2.71-1.517 0-1.9-.88-3.63-.88-1.698 0-2.302.91-3.67.91-1.377 0-2.332-1.26-3.428-2.8-1.287-1.82-2.323-4.63-2.323-7.28 0-4.28 2.797-6.55 5.552-6.55 1.448 0 2.675.95 3.6.95.865 0 2.222-1.01 3.902-1.01.613 0 2.886.06 4.374 2.19-.13.09-2.383 1.37-2.383 4.19 0 3.26 2.854 4.42 2.955 4.45z"/></svg>';
const GOOGLE_SVG = '<svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>';

/** A row with a brand mark instead of a line icon (Apple / Google). */
function brandRow(svg, title, sub, trailing) {
  return h('div', { class: 'row' },
    h('span', { class: 'tile ink-neutral', style: { width: '38px', height: '38px' }, html: svg }),
    h('div', { class: 'row-main' }, h('div', { class: 'row-title' }, title), h('div', { class: 'row-sub' }, sub)),
    h('div', { class: 'row-trail' }, trailing));
}

const maskPhone = (p) => String(p || '').replace(/^(\+995)(\d{3})\d{3}(\d{3})$/, '$1 $2 *** $3');

/** Conflict modal. onMoved(res) after „აქ გადმოტანა“; a switch signs in to the other account and reloads /app. */
export function openConflictModal(conflict, { onMoved } = {}) {
  if (!conflict?.token) return;
  const created = conflict.otherCreatedAt ? fmtDate(conflict.otherCreatedAt, { year: true }) : '';
  openModal({
    title: t('ეს უკვე შენს სხვა ანგარიშზეა', 'This is on another of your accounts'),
    size: 'sm',
    body: (close) => {
      const err = h('div', { class: 'form-error', hidden: true, role: 'alert' });
      const resolve = async (btn, action) => busy(btn, async () => {
        err.hidden = true;
        try {
          const res = await post('/api/auth/account-conflict/resolve', { token: conflict.token, action });
          if (action === 'move_here') {
            if (res.user) setUser(res.user);
            invalidate('/api/auth/methods');
            close();
            toast(t('გადმოტანილია — ახლა ყველა გზით ამ ანგარიშში შეხვალ', 'Moved — every method now signs you in here'));
            onMoved?.(res);
          } else {
            signIn(res.token, res.user);
            location.href = '/app';
          }
        } catch (e) {
          err.textContent = e?.message || t('ვერ შესრულდა. სცადე ხელახლა.', 'Something went wrong. Please try again.');
          err.hidden = false;
        }
      });
      const choice = (action, title, hint, primary) => {
        const b = h('button', { type: 'button', class: `conflict-choice ${primary ? 'primary' : ''}` },
          h('span', { class: 'conflict-title' }, title), h('span', { class: 'conflict-hint' }, hint));
        b.addEventListener('click', () => resolve(b, action));
        return b;
      };
      const move = conflict.canMoveHere
        ? choice('move_here', t('აქ გადმოტანა', 'Bring it here'),
          t('ის ანგარიში ცარიელია: მისი შესვლის გზები ამ ანგარიშზე გადმოვა, ის კი წაიშლება.', 'That account is empty: its sign-in methods move to this account and it is deleted.'),
          true)
        : null;
      const sw = conflict.canSwitch
        ? choice('switch', t('იმ ანგარიშზე გადასვლა', 'Switch to that account'),
          conflict.switchDeletesCurrent
            ? t('ეს ანგარიში ცარიელია: მისი შესვლის გზები იქ გადავა, ის კი წაიშლება.', 'This account is empty: its sign-in methods move there and it is deleted.')
            : t('ეს ანგარიში თავისი მონაცემებით დარჩება — მასში მოგვიანებითაც შეგიძლია შესვლა.', 'This account stays with its data — you can still sign in to it later.'),
          !conflict.canMoveHere)
        : null;
      return h('div', { class: 'stack' },
        h('p', { class: 'muted' }, created
          ? t(`${WHAT[conflict.kind]()} MEDICARD-ის სხვა ანგარიშზეა მიბმული (შექმნილი ${created}). აირჩიე, რომელით გააგრძელებ.`, `${WHAT[conflict.kind]()} is on another MEDICARD account (created ${created}). Choose which one to keep using.`)
          : t(`${WHAT[conflict.kind]()} MEDICARD-ის სხვა ანგარიშზეა მიბმული. აირჩიე, რომელით გააგრძელებ.`, `${WHAT[conflict.kind]()} is on another MEDICARD account. Choose which one to keep using.`)),
        h('div', { class: 'stack', style: { gap: '10px' } }, conflict.canMoveHere ? [move, sw] : [sw, move]),
        conflict.otherHasData && conflict.currentHasData
          ? h('p', { class: 'faint', style: { fontSize: '12.5px' } }, t('ორივე ანგარიშზე შენი მონაცემებია. მათ გასაერთიანებლად მოგვწერე: support@medicard.ge', 'Both accounts hold your data. To merge them, write to us: support@medicard.ge'))
          : null,
        err);
    },
    footer: (close) => [button(t('გაუქმება', 'Cancel'), { variant: 'ghost', onClick: () => close() })],
  });
}

/** Two steps: the address (6-digit code by email), then the code + a new password. */
export function openAddEmailModal({ onDone } = {}) {
  openModal({
    title: t('ელ-ფოსტის დამატება', 'Add an email'),
    size: 'sm',
    body: (close) => {
      const box = h('div');
      const err = h('div', { class: 'form-error', hidden: true, role: 'alert' });
      const fail = (e) => {
        if (e?.body?.conflict?.token) { close(); openConflictModal(e.body.conflict, { onMoved: onDone }); return; }
        err.textContent = e?.message || t('ვერ შესრულდა. სცადე ხელახლა.', 'Something went wrong. Please try again.');
        err.hidden = false;
      };
      const step1 = (preset = '') => {
        const email = input({ type: 'email', autocomplete: 'email', placeholder: 'name@example.com', value: preset });
        const go = button(t('კოდის გაგზავნა', 'Send code'), { type: 'submit', class: 'btn-block' });
        const form = h('form', { class: 'form', onSubmit: (e) => {
          e.preventDefault();
          busy(go, async () => {
            err.hidden = true;
            const address = email.value.trim().toLowerCase();
            if (!/^\S+@\S+\.\S+$/.test(address)) { fail({ message: t('შეიყვანე სწორი ელ-ფოსტა.', 'Enter a valid email.') }); return; }
            try { const r = await post('/api/auth/email/add/start', { email: address }); step2(address, r); } catch (e2) { fail(e2); }
          });
        } },
        h('p', { class: 'muted' }, t('დაამატე ელ-ფოსტა და პაროლი — მერე ამ ანგარიშში ელ-ფოსტითაც შეხვალ, ვებზეც და აპშიც.', 'Add an email and a password — then you can sign in to this account with email too, on the web and in the app.')),
        field(t('ელ-ფოსტა', 'Email'), email), err, go);
        mount(box, form);
        setTimeout(() => email.focus(), 30);
      };
      const step2 = (address, r) => {
        const code = input({ inputmode: 'numeric', maxlength: 6, placeholder: '000000', autocomplete: 'one-time-code', value: r?.devCode || '' });
        const pass = input({ type: 'password', autocomplete: 'new-password', placeholder: t('მინიმუმ 8 სიმბოლო', 'At least 8 characters') });
        const go = button(t('დამატება', 'Add email'), { type: 'submit', class: 'btn-block' });
        const form = h('form', { class: 'form', onSubmit: (e) => {
          e.preventDefault();
          busy(go, async () => {
            err.hidden = true;
            if (pass.value.length < 8) { fail({ message: t('პაროლი უნდა შეიცავდეს მინიმუმ 8 სიმბოლოს.', 'Your password needs at least 8 characters.') }); return; }
            try {
              const res = await post('/api/auth/email/add/verify', { email: address, code: code.value.trim(), password: pass.value });
              if (res.user) setUser(res.user);
              invalidate('/api/auth/methods');
              close();
              toast(t('ელ-ფოსტა დაემატა', 'Email added'));
              onDone?.(res);
            } catch (e2) { fail(e2); }
          });
        } },
        h('p', { class: 'muted' }, t(`6-ნიშნა კოდი გავაგზავნეთ მისამართზე ${address}.`, `We sent a 6-digit code to ${address}.`)),
        field(t('კოდი ელ-ფოსტიდან', 'Code from the email'), code),
        field(t('ახალი პაროლი', 'New password'), pass),
        h('button', { type: 'button', class: 'text-btn', style: { fontSize: '13.5px', justifySelf: 'start' }, onClick: () => { err.hidden = true; step1(address); } }, t('სხვა მისამართი', 'Use another address')),
        err, go);
        mount(box, form);
        setTimeout(() => code.focus(), 30);
      };
      step1();
      return box;
    },
  });
}

/**
 * Card for Profile: every way into this account, with „დამატება“ for the missing ones.
 * onAddPhone opens the page's own phone modal; onChange re-renders after a change.
 */
export function signInMethodsCard({ onAddPhone, onChange }) {
  const holder = card(h('div', { class: 'faint' }, t('იტვირთება…', 'Loading…')));
  const refresh = async () => {
    invalidate('/api/auth/methods');
    let methods;
    try { ({ methods } = await get('/api/auth/methods')); } catch (e) {
      mount(holder, h('div', { class: 'form-error' }, e?.message || t('ვერ ჩაიტვირთა.', 'Could not load.')));
      return;
    }
    const linked = (on, text) => (on ? badge(text || t('მიბმულია', 'Linked'), 'ok') : null);
    const changed = () => { onChange?.(); };
    const social = socialBlock({
      mode: 'link',
      divider: 'none',
      only: ['apple', 'google'].filter((p) => !methods[p]),
      onLinked: () => { toast(t('მიბმულია', 'Linked')); refresh(); changed(); },
      onConflict: (conflict) => openConflictModal(conflict, { onMoved: () => { refresh(); changed(); } }),
    });
    mount(holder,
      h('p', { class: 'muted', style: { marginBottom: '12px' } }, t(
        'ყველა გზა ამ ერთ ანგარიშში შეგიყვანს — ვებზეც და აპშიც. დაამატე ის გზები, რომლითაც შეიძლება შეხვიდე, რომ მეორე ანგარიში შემთხვევით არ შეიქმნას.',
        'Every method signs you in to this one account — on the web and in the app. Add the ones you might use, so a second account is never created by accident.',
      )),
      h('div', { class: 'list' },
        row({ icon: 'phone', ink: 'teal', title: t('ტელეფონის ნომერი', 'Phone number'), sub: methods.phone ? maskPhone(methods.phone) : t('არ არის დამატებული', 'Not added'),
          trailing: methods.phone ? linked(true, t('დადასტურებული', 'Verified')) : button(t('დამატება', 'Add'), { size: 'sm', variant: 'secondary', onClick: onAddPhone }) }),
        row({ icon: 'mail', ink: 'sky', title: t('ელ-ფოსტა და პაროლი', 'Email and password'), sub: methods.email || t('არ არის დამატებული', 'Not added'),
          trailing: methods.email ? linked(true) : button(t('დამატება', 'Add'), { size: 'sm', variant: 'secondary', onClick: () => openAddEmailModal({ onDone: () => { refresh(); changed(); } }) }) }),
        methods.apple ? brandRow(APPLE_SVG, 'Apple', t('ამ ანგარიშზეა მიბმული', 'Linked to this account'), linked(true)) : null,
        methods.google ? brandRow(GOOGLE_SVG, 'Google', t('ამ ანგარიშზეა მიბმული', 'Linked to this account'), linked(true)) : null),
      methods.apple && methods.google ? null : h('div', { style: { marginTop: '12px' } }, social));
  };
  refresh();
  return { el: holder, refresh };
}
