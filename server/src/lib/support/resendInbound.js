/**
 * Resend Inbound (receiving) REST calls — https://resend.com/docs/dashboard/receiving/introduction
 *   GET /emails/receiving/{id}                        body (html, text), headers, attachments
 *   GET /emails/receiving/{email_id}/attachments/{id} attachment metadata + download_url (1 hour)
 * The `email.received` webhook carries metadata only. A "Sending access" API key "can only send
 * emails" (https://resend.com/docs/api-reference/api-keys/create-api-key), so reading needs a
 * "Full access" key: RESEND_INBOUND_API_KEY. 401/403 → code RESTRICTED (metadata-only mode).
 */
import { env } from '../../config/env.js';

const API = 'https://api.resend.com';
export const ATTACHMENT_MAX_BYTES = 25 * 1024 * 1024;

export class InboundError extends Error {
  constructor(message, { status = 0, code = 'PROVIDER_ERROR' } = {}) {
    super(message);
    this.name = 'InboundError';
    this.status = status;
    this.code = code;
  }
}

export function inboundApiKey() {
  return env.RESEND_INBOUND_API_KEY || env.RESEND_API_KEY || '';
}

/** Signed download URLs must be https on Resend's (or its storage's) hosts. */
export function isAllowedDownloadUrl(value) {
  let url;
  try { url = new URL(String(value)); } catch { return false; }
  if (url.protocol !== 'https:') return false;
  const host = url.hostname.toLowerCase();
  return ['resend.com', 'resend.app', 'resend.dev', 'amazonaws.com', 'cloudfront.net'].some((d) => host === d || host.endsWith(`.${d}`));
}

export function createInboundClient({ apiKey = inboundApiKey(), fetchImpl = fetch, timeoutMs = 15_000 } = {}) {
  async function get(path) {
    if (!apiKey) throw new InboundError('no Resend key', { code: 'NO_KEY' });
    let res;
    try {
      res = await fetchImpl(`${API}${path}`, {
        headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      throw new InboundError(`network: ${error?.message || error}`, { code: 'NETWORK' });
    }
    let data = {};
    try { data = await res.json(); } catch { data = {}; }
    if (res.status === 401 || res.status === 403) {
      throw new InboundError(String(data?.message || 'key cannot read received emails').slice(0, 200), { status: res.status, code: 'RESTRICTED' });
    }
    if (res.status === 404) throw new InboundError('not found', { status: 404, code: 'NOT_FOUND' });
    if (!res.ok) throw new InboundError(String(data?.message || `Resend ${res.status}`).slice(0, 200), { status: res.status, code: res.status === 429 ? 'RATE_LIMITED' : 'PROVIDER_ERROR' });
    return data;
  }
  return {
    configured: Boolean(apiKey),
    getReceived: (id) => get(`/emails/receiving/${encodeURIComponent(id)}`),
    getAttachment: (emailId, attachmentId) => get(`/emails/receiving/${encodeURIComponent(emailId)}/attachments/${encodeURIComponent(attachmentId)}`),
    /** Streams the file with a hard size cap; never written to disk. */
    async download(url, { maxBytes = ATTACHMENT_MAX_BYTES } = {}) {
      if (!isAllowedDownloadUrl(url)) throw new InboundError('unexpected download host', { code: 'BAD_URL' });
      let res;
      try {
        res = await fetchImpl(url, { redirect: 'error', signal: AbortSignal.timeout(60_000) });
      } catch (error) {
        throw new InboundError(`network: ${error?.message || error}`, { code: 'NETWORK' });
      }
      if (!res.ok) throw new InboundError(`download ${res.status}`, { status: res.status });
      const declared = Number(res.headers.get('content-length'));
      if (Number.isFinite(declared) && declared > maxBytes) throw new InboundError('attachment too large', { code: 'TOO_LARGE', status: 413 });
      const chunks = [];
      let total = 0;
      for await (const chunk of res.body) {
        total += chunk.length;
        if (total > maxBytes) throw new InboundError('attachment too large', { code: 'TOO_LARGE', status: 413 });
        chunks.push(Buffer.from(chunk));
      }
      return Buffer.concat(chunks);
    },
  };
}
