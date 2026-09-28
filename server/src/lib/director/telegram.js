/**
 * Minimal Telegram Bot API client for the Director (plain fetch, plain text — no parse_mode, so
 * nothing the brain writes can break formatting). The bot talks only to the paired owner chat.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

const API = 'https://api.telegram.org';
const MAX_MESSAGE = 4000; // Telegram hard limit is 4096

export const telegramConfigured = () => Boolean(process.env.TELEGRAM_BOT_TOKEN);

/**
 * Secret Telegram echoes in X-Telegram-Bot-Api-Secret-Token. Derived from the bot token and
 * JWT_SECRET unless DIRECTOR_TELEGRAM_SECRET is set, so no extra env var is required.
 */
export function webhookSecret() {
  if (process.env.DIRECTOR_TELEGRAM_SECRET) return process.env.DIRECTOR_TELEGRAM_SECRET;
  const token = process.env.TELEGRAM_BOT_TOKEN || '';
  if (!token) return '';
  return createHmac('sha256', process.env.JWT_SECRET || 'medicard-director').update(`tg-webhook:${token}`).digest('hex').slice(0, 64);
}

export function isValidWebhookSecret(received) {
  const expected = webhookSecret();
  if (!expected || typeof received !== 'string') return false;
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function call(method, body, { fetchImpl = fetch } = {}) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw Object.assign(new Error('TELEGRAM_BOT_TOKEN is not set'), { status: 503, code: 'TELEGRAM_NOT_CONFIGURED' });
  const res = await fetchImpl(`${API}/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body || {}),
    signal: AbortSignal.timeout(15000),
  });
  const json = await res.json().catch(() => ({}));
  if (!json.ok) {
    // Never echo the URL: it contains the bot token.
    throw Object.assign(new Error(`Telegram ${method} failed: ${json.description || res.status}`), { status: 502 });
  }
  return json.result;
}

/** Splits long text on paragraph/line boundaries so every chunk fits one Telegram message. */
export function chunkText(text, max = MAX_MESSAGE) {
  const out = [];
  let rest = String(text ?? '').trim();
  while (rest.length > max) {
    let cut = rest.lastIndexOf('\n\n', max);
    if (cut < max * 0.5) cut = rest.lastIndexOf('\n', max);
    if (cut < max * 0.5) cut = rest.lastIndexOf(' ', max);
    if (cut <= 0) cut = max;
    out.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) out.push(rest);
  return out;
}

/** Sends text (chunked). Buttons (rows of {text, data}) go on the last chunk. Returns the last message. */
export async function sendMessage(chatId, text, { buttons = null, replyTo = null } = {}, opts) {
  const chunks = chunkText(text);
  let last = null;
  for (let i = 0; i < chunks.length; i += 1) {
    const isLast = i === chunks.length - 1;
    last = await call('sendMessage', {
      chat_id: chatId,
      text: chunks[i],
      disable_web_page_preview: true,
      ...(i === 0 && replyTo ? { reply_parameters: { message_id: Number(replyTo), allow_sending_without_reply: true } } : {}),
      ...(isLast && buttons ? { reply_markup: { inline_keyboard: buttons.map((row) => row.map((b) => ({ text: b.text, callback_data: b.data }))) } } : {}),
    }, opts);
  }
  return last;
}

export const answerCallback = (callbackQueryId, text, opts) =>
  call('answerCallbackQuery', { callback_query_id: callbackQueryId, text: String(text || '').slice(0, 190) }, opts);

export const clearButtons = (chatId, messageId, opts) =>
  call('editMessageReplyMarkup', { chat_id: chatId, message_id: Number(messageId), reply_markup: { inline_keyboard: [] } }, opts);

export const sendChatAction = (chatId, action = 'typing', opts) => call('sendChatAction', { chat_id: chatId, action }, opts);

export const getMe = (opts) => call('getMe', {}, opts);

export const getWebhookInfo = (opts) => call('getWebhookInfo', {}, opts);

export const setWebhook = (url, opts) => call('setWebhook', {
  url,
  secret_token: webhookSecret(),
  allowed_updates: ['message', 'callback_query'],
  drop_pending_updates: true,
}, opts);
