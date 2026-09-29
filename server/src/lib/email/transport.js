/**
 * Minimal Resend REST client (https://resend.com/docs/api-reference). Plain fetch so the
 * Idempotency-Key header, the batch endpoint and 429 back-off are explicit and testable.
 * Resend's default limit is ~2 requests/second per team; 429 answers carry Retry-After.
 */
const API = 'https://api.resend.com';
const MAX_ATTEMPTS = 4;

export class EmailTransportError extends Error {
  constructor(message, { status = 0, code = '' } = {}) {
    super(message);
    this.name = 'EmailTransportError';
    this.status = status;
    this.code = code;
  }
}

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function retryDelayMs(res, attempt) {
  const header = Number(res?.headers?.get?.('retry-after'));
  if (Number.isFinite(header) && header > 0) return Math.min(header * 1000, 30_000);
  return Math.min(1000 * 2 ** attempt, 16_000);
}

/** One camelCase message → Resend's wire format. */
export function toResendMessage(msg) {
  return {
    from: msg.from,
    to: Array.isArray(msg.to) ? msg.to : [msg.to],
    subject: msg.subject,
    html: msg.html,
    text: msg.text,
    ...(msg.replyTo ? { reply_to: msg.replyTo } : {}),
    ...(msg.headers && Object.keys(msg.headers).length ? { headers: msg.headers } : {}),
    ...(msg.tags?.length ? { tags: msg.tags } : {}),
  };
}

export function createResendTransport({ apiKey, fetchImpl = fetch, sleep = defaultSleep } = {}) {
  async function call(path, body, idempotencyKey) {
    if (!apiKey) throw new EmailTransportError('Resend is not configured', { code: 'NOT_CONFIGURED' });
    for (let attempt = 0; ; attempt += 1) {
      let res;
      try {
        res = await fetchImpl(`${API}${path}`, {
          method: 'POST',
          signal: AbortSignal.timeout(20_000),
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            ...(idempotencyKey ? { 'Idempotency-Key': String(idempotencyKey).slice(0, 256) } : {}),
          },
          body: JSON.stringify(body),
        });
      } catch (error) {
        if (attempt + 1 >= MAX_ATTEMPTS) throw new EmailTransportError(`network: ${error?.message || error}`, { code: 'NETWORK' });
        await sleep(retryDelayMs(null, attempt));
        continue;
      }
      if (res.status === 429 || res.status >= 500) {
        if (attempt + 1 >= MAX_ATTEMPTS) throw new EmailTransportError(`Resend ${res.status}`, { status: res.status, code: res.status === 429 ? 'RATE_LIMITED' : 'PROVIDER_ERROR' });
        await sleep(retryDelayMs(res, attempt));
        continue;
      }
      let data = {};
      try { data = await res.json(); } catch { data = {}; }
      if (!res.ok) {
        throw new EmailTransportError(String(data?.message || data?.name || `Resend ${res.status}`).slice(0, 300), { status: res.status, code: data?.name || 'PROVIDER_ERROR' });
      }
      return data;
    }
  }

  return {
    configured: Boolean(apiKey),
    /** @returns {Promise<{ id: string }>} */
    async send(msg, { idempotencyKey } = {}) {
      const data = await call('/emails', toResendMessage(msg), idempotencyKey);
      return { id: data?.id || null };
    },
    /** Up to 100 messages; ids come back in the same order. @returns {Promise<string[]>} */
    async sendBatch(messages, { idempotencyKey } = {}) {
      if (messages.length > 100) throw new EmailTransportError('batch over 100', { code: 'BATCH_TOO_LARGE' });
      const data = await call('/emails/batch', messages.map(toResendMessage), idempotencyKey);
      const rows = Array.isArray(data?.data) ? data.data : [];
      return messages.map((_m, i) => rows[i]?.id || null);
    },
  };
}
