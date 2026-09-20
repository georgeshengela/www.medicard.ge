import { assertAiConsent, AI_DISCLOSURE, currentAiAccount } from './aiConsent.js';

const ORIGINS = { openrouter: 'https://openrouter.ai', evidencemd: 'https://evidencemd.ai' };
export function approvedProviderRouting(model) {
  const only = AI_DISCLOSURE.routing[model];
  if (!only) throw Object.assign(new Error('არჩეული AI მოდელი ამ ვერსიაში ხელმისაწვდომი არ არის.'), { status: 503, code: 'AI_PROVIDER_NOT_APPROVED' });
  return { only, order: only, allow_fallbacks: false, data_collection: 'deny', zdr: true };
}
/** Runs for EACH SDK attempt/retry, including automatic fallback and streaming. */
export function consentedAiFetch(provider, { check = assertAiConsent, account = currentAiAccount, transport = (...args) => globalThis.fetch(...args) } = {}) {
  return async (input, init = {}) => {
    const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
    if (!ORIGINS[provider] || url.origin !== ORIGINS[provider] || url.pathname !== '/api/v1/chat/completions') {
      throw Object.assign(new Error('AI მიმღები დამტკიცებულ სიაში არ არის.'), { status: 503, code: 'AI_PROVIDER_NOT_APPROVED' });
    }
    let body = init.body;
    if (body == null && typeof input?.clone === 'function') body = await input.clone().text();
    if (provider === 'openrouter') {
      const payload = JSON.parse(String(body || '{}'));
      body = JSON.stringify({ ...payload, provider: approvedProviderRouting(payload.model) });
    }
    await check(account());
    const headers = new Headers(init.headers ?? (typeof input === 'object' ? input.headers : undefined));
    headers.delete('content-length');
    // Never follow a redirect carrying a medical request to an undisclosed destination.
    return transport(input, { ...init, headers, body, redirect: 'error' });
  };
}
