import { assertAiConsent, AI_DISCLOSURE, currentAiAccount, currentAiLanguage, hasAiLanguage, setAiLanguage } from './aiConsent.js';
import { aiLanguageDirective, getUserLanguage, parseLang, t } from './i18n.js';
import { withReasoningHeadroom } from './reasoningBudget.js';

const ORIGINS = { openrouter: 'https://openrouter.ai', evidencemd: 'https://evidencemd.ai' };
/**
 * Only the disclosed hosts, tried in manifest order (Gemini: Vertex standard, then Vertex priority when
 * standard errors). `route: 'priority'` puts the priority-tier host first — the same Google Vertex
 * recipient on its faster queue, used when the standard one stalls (aiEngine `askGeminiRaced`).
 */
export function approvedProviderRouting(model, route) {
  const only = AI_DISCLOSURE.routing[model];
  if (!only) throw Object.assign(new Error(t(currentAiLanguage(), 'არჩეული AI მოდელი ამ ვერსიაში ხელმისაწვდომი არ არის.', 'The selected AI model is not available in this version.')), { status: 503, code: 'AI_PROVIDER_NOT_APPROVED' });
  const isPriority = (slug) => slug.endsWith('/priority');
  const order = route === 'priority' ? [...only.filter(isPriority), ...only.filter((slug) => !isPriority(slug))] : only;
  return { only, order, allow_fallbacks: false, data_collection: 'deny', zdr: true };
}
/**
 * Reading language of the current AI request. Routers bind it from X-Medicard-Lang (bindAiLanguage /
 * withAiAccount); otherwise the account's stored language is looked up once and kept on the context.
 */
export async function resolveAiLanguage(userId = currentAiAccount()) {
  if (hasAiLanguage() || !userId) return currentAiLanguage();
  const lang = await getUserLanguage(userId).catch(() => 'ka');
  setAiLanguage(lang);
  return lang;
}

/** Per-call override header (stripped before sending): `off` skips the directive (pure data extraction), `ka|en` forces one. */
export const AI_LANGUAGE_HEADER = 'x-medicard-ai-language';
/** Per-call host preference (stripped before sending): `priority` = the approved priority-tier host first. */
export const AI_ROUTE_HEADER = 'x-medicard-ai-route';

const DIRECTIVE_MARK = 'RESPONSE LANGUAGE: English.';

/**
 * Appends the English response directive as the last system instruction (right after the last system
 * message, so the cached static prompt prefix stays identical). Georgian requests are untouched.
 */
export function injectLanguageDirective(payload, lang) {
  const directive = aiLanguageDirective(lang);
  if (!directive || !payload || !Array.isArray(payload.messages)) return payload;
  const messages = payload.messages;
  const text = (m) => (typeof m?.content === 'string' ? m.content : Array.isArray(m?.content) ? m.content.map((p) => p?.text || '').join('') : '');
  if (messages.some((m) => text(m).includes(DIRECTIVE_MARK))) return payload;
  let at = -1;
  messages.forEach((m, i) => { if (m?.role === 'system') at = i; });
  const next = [...messages];
  next.splice(at + 1, 0, { role: 'system', content: directive });
  return { ...payload, messages: next };
}

/** Runs for EACH SDK attempt/retry, including automatic fallback and streaming. */
export function consentedAiFetch(provider, { check = assertAiConsent, account = currentAiAccount, transport = (...args) => globalThis.fetch(...args), language } = {}) {
  const readLanguage = language ?? (account === currentAiAccount ? () => resolveAiLanguage() : () => currentAiLanguage());
  return async (input, init = {}) => {
    const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
    if (!ORIGINS[provider] || url.origin !== ORIGINS[provider] || url.pathname !== '/api/v1/chat/completions') {
      throw Object.assign(new Error(t(currentAiLanguage(), 'AI მიმღები დამტკიცებულ სიაში არ არის.', 'This AI recipient is not on the approved list.')), { status: 503, code: 'AI_PROVIDER_NOT_APPROVED' });
    }
    let body = init.body;
    if (body == null && typeof input?.clone === 'function') body = await input.clone().text();
    const headers = new Headers(init.headers ?? (typeof input === 'object' ? input.headers : undefined));
    const route = String(headers.get(AI_ROUTE_HEADER) || '').trim().toLowerCase();
    headers.delete(AI_ROUTE_HEADER);
    if (provider === 'openrouter') {
      const payload = JSON.parse(String(body || '{}'));
      body = JSON.stringify({ ...withReasoningHeadroom(payload), provider: approvedProviderRouting(payload.model, route) });
    }
    await check(account());
    headers.delete('content-length');
    const override = String(headers.get(AI_LANGUAGE_HEADER) || '').trim().toLowerCase();
    headers.delete(AI_LANGUAGE_HEADER);
    if (override !== 'off') {
      const lang = parseLang(override) ?? (await readLanguage());
      if (lang === 'en') {
        try {
          body = JSON.stringify(injectLanguageDirective(JSON.parse(String(body || '{}')), lang));
        } catch {
          /* not a JSON chat body — send unchanged */
        }
        if (provider === 'evidencemd') headers.set('accept-language', 'en-US');
      }
    }
    // Never follow a redirect carrying a medical request to an undisclosed destination.
    return transport(input, { ...init, headers, body, redirect: 'error' });
  };
}
