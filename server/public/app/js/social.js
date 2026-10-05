// MEDICARD web — Sign in with Apple / Google. Same server endpoints as the app
// (POST /api/auth/apple, /api/auth/google, /api/auth/social/link); the server says which
// providers are configured (GET /api/auth/social/config) and holds the linking rule.
import { h, mount, icon, button, busy, field, input } from './ui.js';
import { get, post, ApiError } from './api.js';
import { t, lang } from './i18n.js';

const GOOGLE_SRC = 'https://accounts.google.com/gsi/client';
const APPLE_SRC = 'https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js';
const NONCE_MAX_AGE_MS = 8 * 60 * 1000; // server nonces live 10 minutes

const APPLE_PATH = 'M16.365 1.43c0 1.14-.493 2.27-1.177 3.08-.744.9-1.99 1.57-2.987 1.57-.12 0-.23-.02-.3-.03-.01-.06-.04-.22-.04-.39 0-1.15.572-2.27 1.206-2.98.804-.94 2.142-1.64 3.248-1.68.03.13.05.28.05.43zm4.565 15.71c-.03.07-.463 1.58-1.518 3.12-.945 1.34-1.94 2.71-3.43 2.71-1.517 0-1.9-.88-3.63-.88-1.698 0-2.302.91-3.67.91-1.377 0-2.332-1.26-3.428-2.8-1.287-1.82-2.323-4.63-2.323-7.28 0-4.28 2.797-6.55 5.552-6.55 1.448 0 2.675.95 3.6.95.865 0 2.222-1.01 3.902-1.01.613 0 2.886.06 4.374 2.19-.13.09-2.383 1.37-2.383 4.19 0 3.26 2.854 4.42 2.955 4.45z';

let configPromise = null;
const scripts = new Map();

function loadConfig() {
  if (!configPromise) {
    configPromise = get('/api/auth/social/config').catch(() => {
      configPromise = null; // try again on the next screen
      return { google: null, apple: null };
    });
  }
  return configPromise;
}

function loadScript(src) {
  if (!scripts.has(src)) {
    scripts.set(src, new Promise((resolve, reject) => {
      const el = document.createElement('script');
      el.src = src;
      el.async = true;
      el.onload = resolve;
      el.onerror = () => { scripts.delete(src); el.remove(); reject(new Error('script')); };
      document.head.appendChild(el);
    }));
  }
  return scripts.get(src);
}

/** Apple accepts only the registered return URL, so the button exists only on that origin. */
function appleUsable(cfg) {
  try { return Boolean(cfg?.clientId) && new URL(cfg.redirectUri).origin === location.origin; } catch { return false; }
}

/**
 * "Continue with Apple / Google" block. Renders nothing until the server says a provider is on;
 * a failed script load hides that button. onSignedIn(res) gets the normal {token, user} answer;
 * onLink({ provider, email, linkToken }) runs when the address belongs to a password account.
 */
export function socialBlock({ onSignedIn, onLink, divider = 'after' }) {
  const err = h('div', { class: 'form-error', hidden: true, role: 'alert' });
  const list = h('div', { class: 'social-buttons' });
  const sep = h('div', { class: 'divider' }, t('ან', 'or'));
  const box = h('div', { class: 'social-block', hidden: true }, divider === 'before' ? sep : null, list, err, divider === 'after' ? sep : null);
  let running = false;

  const fail = (e) => {
    err.textContent = e?.message || t('შესვლა ვერ დადასტურდა. სცადე თავიდან.', 'We could not confirm this sign-in. Please try again.');
    err.hidden = false;
  };

  const finish = async (path, body) => {
    try {
      onSignedIn(await post(path, body));
    } catch (e) {
      if (e instanceof ApiError && e.code === 'SOCIAL_LINK_REQUIRED' && e.body?.linkToken) {
        onLink({ provider: e.body.provider, email: e.body.email, linkToken: e.body.linkToken });
        return;
      }
      fail(e);
    }
  };

  loadConfig().then(async (cfg) => {
    const [apple, google] = await Promise.all([
      appleUsable(cfg.apple) ? appleButton(cfg.apple).catch(() => null) : null,
      cfg.google?.clientId ? googleButton(cfg.google).catch(() => null) : null,
    ]);
    if (!box.isConnected || (!apple && !google)) return; // screen already changed, or nothing to offer
    if (apple) list.appendChild(apple);
    box.hidden = false;
    if (google) {
      // Google draws its button only for an authorized JavaScript origin (Cloud console → the Web
      // client). Until its iframe has a size the slot is laid out but invisible (and so is the whole
      // block when there is no Apple button), so a missing origin never shows a dead button.
      google.el.classList.add('is-pending');
      if (!apple) box.classList.add('is-waiting');
      list.appendChild(google.el);
      const started = Date.now();
      const check = () => {
        if (!box.isConnected) return;
        if (google.el.querySelector('iframe')?.offsetWidth > 0) {
          google.el.classList.remove('is-pending');
          box.classList.remove('is-waiting');
        } else if (Date.now() - started < 10_000) setTimeout(check, 250);
        else {
          google.el.remove();
          if (!apple) box.hidden = true;
        }
      };
      setTimeout(check, 250);
    }
    // GIS draws its iframe at a fixed pixel width: draw it again whenever the column width changes.
    if (google) {
      let drawn = 0;
      const redraw = () => {
        const width = Math.max(200, Math.min(400, Math.floor(list.clientWidth)));
        if (!list.isConnected || Math.abs(width - drawn) < 4) return;
        drawn = width;
        google.render(width);
      };
      redraw();
      if (typeof ResizeObserver === 'function') new ResizeObserver(redraw).observe(list);
    }
  });

  async function appleButton(cfg) {
    await loadScript(APPLE_SRC);
    if (!window.AppleID?.auth) throw new Error('apple');
    let nonce = null;
    let nonceAt = 0;
    const freshNonce = async () => {
      const r = await get('/api/auth/apple/nonce');
      nonce = r.nonce;
      nonceAt = Date.now();
      window.AppleID.auth.init({
        clientId: cfg.clientId,
        scope: 'name email',
        redirectURI: cfg.redirectUri,
        state: crypto.getRandomValues(new Uint32Array(2)).join('-'),
        nonce,
        usePopup: true,
      });
    };
    await freshNonce();

    const btn = h('button', { type: 'button', class: 'social-btn social-apple', 'aria-label': t('Apple-ით გაგრძელება', 'Continue with Apple') },
      h('span', { class: 'social-logo', html: `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="${APPLE_PATH}"/></svg>` }),
      h('span', null, t('Apple-ით გაგრძელება', 'Continue with Apple')));
    btn.addEventListener('click', async () => {
      if (running) return;
      running = true;
      err.hidden = true;
      await busy(btn, async () => {
        try {
          // The popup must open inside the click: only an expiring nonce is re-fetched first.
          if (!nonce || Date.now() - nonceAt > NONCE_MAX_AGE_MS) await freshNonce();
          const used = nonce;
          let res;
          try {
            res = await window.AppleID.auth.signIn();
          } catch (e) {
            const code = String(e?.error || '');
            if (code === 'popup_closed_by_user' || code === 'user_cancelled_authorize' || code === 'user_trigger_new_signin_flow') return;
            throw new ApiError(t('Apple-ით შესვლა ვერ მოხერხდა. სცადე ხელახლა.', 'Sign in with Apple did not work. Please try again.'), 0);
          } finally {
            // Every attempt spends its nonce.
            freshNonce().catch(() => { nonce = null; });
          }
          const auth = res?.authorization;
          if (!auth?.id_token) return;
          const name = res.user?.name ? [res.user.name.firstName, res.user.name.lastName].filter(Boolean).join(' ').trim() : '';
          await finish('/api/auth/apple', {
            identityToken: auth.id_token,
            authorizationCode: auth.code || undefined,
            nonce: used,
            fullName: name || undefined,
          });
        } catch (e) {
          fail(e);
        }
      });
      running = false;
    });
    return btn;
  }

  async function googleButton(cfg) {
    await loadScript(GOOGLE_SRC);
    const gid = window.google?.accounts?.id;
    if (!gid) throw new Error('google');
    gid.initialize({
      client_id: cfg.clientId,
      ux_mode: 'popup',
      auto_select: false,
      cancel_on_tap_outside: true,
      use_fedcm_for_button: true,
      callback: async (resp) => {
        if (running || !resp?.credential) return;
        running = true;
        err.hidden = true;
        el.classList.add('is-busy');
        try { await finish('/api/auth/google', { idToken: resp.credential }); } finally {
          running = false;
          el.classList.remove('is-busy');
        }
      },
    });
    const el = h('div', { class: 'social-google' });
    const render = (width) => {
      mount(el);
      gid.renderButton(el, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        text: 'continue_with',
        shape: 'pill',
        logo_alignment: 'center',
        width,
        locale: lang === 'en' ? 'en' : 'ka',
      });
    };
    return { el, render };
  }

  return box;
}

/**
 * The provider's address already has a password account: prove it once with that password,
 * then the Apple / Google identity is attached (same rule and endpoint as the app).
 */
export function showSocialLink(panel, { provider, email, linkToken }, { onSignedIn, onBack, onForgot }) {
  const err = h('div', { class: 'form-error', hidden: true, role: 'alert' });
  const pass = input({ type: 'password', autocomplete: 'current-password', placeholder: '••••••••', required: true });
  const submit = button(t('დაკავშირება და შესვლა', 'Link and sign in'), { type: 'submit', size: 'lg', class: 'btn-block' });
  const name = provider === 'apple' ? 'Apple' : 'Google';
  const form = h('form', { class: 'form', onSubmit: async (e) => {
    e.preventDefault();
    err.hidden = true;
    await busy(submit, async () => {
      try { onSignedIn(await post('/api/auth/social/link', { linkToken, password: pass.value })); } catch (e2) {
        err.textContent = e2?.message || t('ვერ შესრულდა. სცადე ხელახლა.', 'Something went wrong. Please try again.');
        err.hidden = false;
      }
    });
  } },
  field(t('ელ-ფოსტა', 'Email'), input({ type: 'email', value: email || '', readonly: true, tabindex: -1 })),
  field(t('პაროლი', 'Password'), pass),
  h('div', { style: { textAlign: 'right', marginTop: '-4px' } }, h('button', { type: 'button', class: 'text-btn', style: { fontSize: '13.5px' }, onClick: () => onForgot(email) }, t('დაგავიწყდა პაროლი?', 'Forgot password?'))),
  err, submit);
  mount(panel,
    h('button', { class: 'back text-btn', type: 'button', onClick: onBack }, icon('chevronLeft', { size: 16 }), t('უკან', 'Back')),
    h('h1', { style: { marginTop: '14px' } }, t('ანგარიში უკვე გაქვს', 'You already have an account')),
    h('p', { class: 'lead' }, t(
      `ამ ელ-ფოსტით MEDICARD-ის ანგარიში უკვე არსებობს. შეიყვანე მისი პაროლი ერთხელ — შემდეგ ${name}-ით ერთი დაჭერით შეხვალ.`,
      `A MEDICARD account with this email already exists. Enter its password once — after that you can sign in with ${name} in one click.`,
    )),
    form);
  setTimeout(() => pass.focus(), 30);
}
