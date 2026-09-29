// MEDICARD web — voluntary AI data-sharing consent (App Review 2026-09-22 rules apply on the web too).
// Before ANY request that sends data to an AI provider, call `await ensureAiConsent()`.
// It shows the named recipients / data categories and returns true only after an explicit "allow".
// Declining or closing blocks the request quietly — it is not an error.
import { h, icon, button, openModal, busy } from './ui.js';
import { get, put, ApiError } from './api.js';

let status = null;

export async function readAiConsent(force = false) {
  if (!status || force) status = await get('/api/ai-consent');
  return status;
}

export async function ensureAiConsent() {
  const st = await readAiConsent(true);
  if (st?.accepted) return true;
  return askAiConsent(st);
}

/** Shows the disclosure. Resolves true (accepted) / false (declined or closed). */
export function askAiConsent(st, { settings = false } = {}) {
  return new Promise((resolve) => {
    let result = false;
    const m = st?.manifest || {};
    const err = h('div', { class: 'form-error', hidden: true });
    const decide = async (allow, btn, close) => {
      err.hidden = true;
      await busy(btn, async () => {
        try {
          const decision = allow ? 'accepted' : st?.accepted ? 'revoked' : 'declined';
          status = await put('/api/ai-consent', { decision, version: st.version });
          result = allow && Boolean(status.accepted);
          close();
        } catch (e) {
          if (e instanceof ApiError && e.code === 'AI_CONSENT_VERSION_CHANGED') {
            status = await get('/api/ai-consent').catch(() => st);
            close();
            askAiConsent(status, { settings }).then(resolve);
            return;
          }
          err.textContent = e?.message || 'არჩევანი ვერ შეინახა. სცადე ხელახლა.';
          err.hidden = false;
        }
      });
    };
    openModal({
      title: m.title || 'მონაცემების გაზიარება AI-სთან',
      size: 'md',
      body: h('div', { class: 'stack', style: { gap: '14px' } },
        h('p', { class: 'muted' }, m.purpose || 'Medi-ს პასუხის მოსამზადებლად შენი შეკითხვა და საჭირო ჯანმრთელობის მონაცემები გადაეცემა ქვემოთ ჩამოთვლილ მიმღებებს.'),
        m.categories?.length ? h('div', null,
          h('div', { class: 'field-label', style: { marginBottom: '8px' } }, 'რა მონაცემები'),
          h('ul', { style: { margin: 0, paddingLeft: '20px', color: 'var(--text2)', fontSize: '14px' } }, m.categories.map((c) => h('li', null, c)))) : null,
        m.recipients?.length ? h('div', null,
          h('div', { class: 'field-label', style: { marginBottom: '8px' } }, 'ვის გადაეცემა'),
          h('div', { class: 'list' }, m.recipients.map((r) => h('div', { class: 'row' },
            h('span', { class: 'tile ink-violet', style: { width: '34px', height: '34px' } }, icon('shield', { size: 16 })),
            h('div', { class: 'row-main' }, h('div', { class: 'row-title' }, r.name), h('div', { class: 'row-sub' }, r.role)),
            r.url ? h('a', { href: r.url, target: '_blank', rel: 'noopener', class: 'link' }, 'პოლიტიკა') : null)))) : null,
        m.retention ? h('p', { class: 'faint', style: { fontSize: '13px' } }, m.retention) : null,
        h('p', { class: 'faint', style: { fontSize: '13px' } }, m.choice || 'თანხმობა ნებაყოფლობითია. უარის შემთხვევაში AI ფუნქციები არ იმუშავებს, დანარჩენი აპი — კი. გადაწყვეტილებას ნებისმიერ დროს შეცვლი პროფილში.'),
        m.privacyUrl ? h('a', { href: m.privacyUrl, target: '_blank', class: 'link' }, 'კონფიდენციალურობის პოლიტიკა', icon('externalLink', { size: 14 })) : null,
        err),
      footer: (close) => {
        const no = button(st?.accepted ? 'თანხმობის გაუქმება' : 'არ ვეთანხმები', { variant: 'ghost' });
        const yes = button('ვეთანხმები', { variant: 'primary' });
        no.addEventListener('click', () => decide(false, no, close));
        yes.addEventListener('click', () => decide(true, yes, close));
        return settings && st?.accepted ? [no] : [no, yes];
      },
      onClose: () => resolve(result),
    });
  });
}

/** Wraps an AI call: asks for consent first; if the server still says consent is missing, asks again once. */
export async function withAiConsent(fn) {
  if (!(await ensureAiConsent())) return { declined: true };
  try {
    return await fn();
  } catch (e) {
    if (e instanceof ApiError && (e.code === 'AI_CONSENT_REQUIRED' || e.code === 'AI_CONSENT_VERSION_CHANGED')) {
      status = null;
      if (!(await ensureAiConsent())) return { declined: true };
      return fn();
    }
    throw e;
  }
}
