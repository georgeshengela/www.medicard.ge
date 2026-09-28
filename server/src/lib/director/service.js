/**
 * Director ↔ owner over Telegram. Only the paired private chat is ever answered; everything else
 * is ignored silently. Approve/reject buttons are handled here deterministically (no AI involved),
 * then the brain is woken to act on the decision.
 */
import * as store from './store.js';
import * as tg from './telegram.js';
import { wakeBrain } from './trigger.js';

const KIND_LABELS = { decision: 'გადაწყვეტილება', post: 'სოც. მედიის პოსტი', email: 'მეილის პასუხი', task: 'დავალება', team: 'გუნდის წევრი', change: 'ცვლილება' };
export const kindLabel = (kind) => KIND_LABELS[kind] || kind;

const HELP = [
  'მე ვარ MEDICARD-ის დირექტორი. აქ მომწერე ნებისმიერ დროს — ცვლაზე ყოფნისას ვპასუხობ.',
  '',
  '/status — ცვლა, რიგში მყოფი შეთავაზებები',
  '/on — ცვლის ჩაბარება (მე ვმართავ)',
  '/off — ცვლის დაბრუნება (ვჩერდები)',
  '',
  'შეთავაზებაზე: ✅ თანხმობა, ❌ უარი, ან უპასუხე (reply) ტექსტით — შენიშვნად ჩავიწერ.',
].join('\n');

/** Sends a message to the owner and logs it. Returns false when Telegram isn't paired. */
export async function notifyOwner(text, { buttons = null, direction = 'director', replyTo = null } = {}) {
  const state = await store.getState();
  if (!state.ownerChatId || !tg.telegramConfigured()) {
    await store.addMessage({ direction, text });
    return { delivered: false };
  }
  const sent = await tg.sendMessage(state.ownerChatId, text, { buttons, replyTo });
  await store.addMessage({ direction, text, telegramMessageId: sent?.message_id });
  return { delivered: true, messageId: sent?.message_id };
}

export function proposalText(p) {
  return `📌 ${kindLabel(p.kind)}: ${p.title}\n\n${p.body}`;
}

export async function sendProposal(p) {
  const res = await notifyOwner(proposalText(p), {
    buttons: [[{ text: '✅ თანხმობა', data: `p:${p.id}:a` }, { text: '❌ უარი', data: `p:${p.id}:r` }]],
  });
  if (res.messageId) await store.setProposalTelegramId(p.id, res.messageId);
  return res;
}

async function statusText() {
  const [state, pending] = await Promise.all([store.getState(), store.listProposals({ status: 'pending', limit: 20 })]);
  const lines = [
    state.active ? '🟢 ცვლაზე ვარ.' : '⚪ ცვლაზე არ ვარ. /on — ჩასაბარებლად.',
    state.lastBrainAt ? `ბოლოს ვიმუშავე: ${new Date(state.lastBrainAt).toLocaleString('ka-GE', { timeZone: 'Asia/Tbilisi' })}` : 'ჯერ არ მიმუშავია.',
    pending.length ? `\nშენს თანხმობას ელოდება (${pending.length}):\n${pending.map((p) => `• ${p.title}`).join('\n')}` : '\nშენს თანხმობას არაფერი ელოდება.',
  ];
  return lines.join('\n');
}

async function decide(proposalId, approve, via, { note } = {}) {
  const p = await store.decideProposal(proposalId, { approve, via, note });
  if (!p) return null;
  await store.addJournal({ kind: 'note', summary: `${approve ? 'დადასტურდა' : 'უარყოფილია'}: ${p.title}`, data: { proposalId: p.id, via } });
  await wakeBrain(`owner ${approve ? 'approved' : 'rejected'} proposal ${p.id}`);
  return p;
}

/** Owner decision from the admin panel (same path as the Telegram buttons). */
export async function decideFromAdmin(proposalId, approve, adminEmail, note) {
  const p = await decide(proposalId, approve, 'admin', { note });
  if (p?.telegramMessageId) {
    const state = await store.getState();
    if (state.ownerChatId && tg.telegramConfigured()) await tg.clearButtons(state.ownerChatId, p.telegramMessageId).catch(() => {});
  }
  return p;
}

async function handleCallback(cb, state) {
  const chatId = String(cb.message?.chat?.id ?? '');
  if (!state.ownerChatId || chatId !== state.ownerChatId) return;
  const m = /^p:([0-9a-f-]{36}):(a|r)$/.exec(cb.data || '');
  if (!m) return tg.answerCallback(cb.id, 'უცნობი ღილაკი');
  const p = await decide(m[1], m[2] === 'a', 'telegram');
  await tg.clearButtons(chatId, cb.message.message_id).catch(() => {});
  if (!p) return tg.answerCallback(cb.id, 'ეს უკვე გადაწყვეტილია.');
  await tg.answerCallback(cb.id, m[2] === 'a' ? 'დადასტურდა ✅' : 'უარყოფილია ❌');
  await notifyOwner(m[2] === 'a' ? `✅ მივიღე: „${p.title}“. შევასრულებ და მოგახსენებ.` : `❌ გასაგებია, „${p.title}“ არ კეთდება.`, { direction: 'system' });
}

async function handleMessage(msg, state) {
  const chatId = String(msg.chat?.id ?? '');
  const text = String(msg.text || msg.caption || '').trim();

  // Pairing: `/start CODE` from a private chat while nobody is paired yet.
  if (!state.ownerChatId) {
    const code = /^\/start\s+(\d{6})$/.exec(text)?.[1];
    if (msg.chat?.type === 'private' && code && (await store.consumePairingCode(code, chatId))) {
      await tg.sendMessage(chatId, `დაკავშირებულია ✅\n\n${HELP}`);
      await store.addJournal({ kind: 'note', summary: 'ტელეგრამი დაუკავშირდა მფლობელს' });
    }
    return;
  }
  if (chatId !== state.ownerChatId) return; // strangers get nothing

  if (/^\/(start|help)\b/.test(text)) return notifyOwner(HELP, { direction: 'system' });
  if (/^\/status\b/.test(text)) return notifyOwner(await statusText(), { direction: 'system' });
  if (/^\/(on|off)\b/.test(text)) {
    const on = text.startsWith('/on');
    await store.setActive(on, 'telegram');
    await notifyOwner(on ? '🟢 ცვლა ჩავიბარე. ვიწყებ მიმოხილვას და მალე მოგწერ.' : '⚪ ცვლა დაგიბრუნე. აღარაფერს ვაკეთებ, სანამ ისევ არ ჩამაბარებ.', { direction: 'system' });
    if (on) await wakeBrain('shift started from Telegram', { immediate: true });
    return;
  }

  let body = text;
  if (!body && msg.voice) body = '[ხმოვანი შეტყობინება — ჯერ ტექსტს ვკითხულობ]';
  if (!body && msg.photo) body = '[ფოტო ტექსტის გარეშე]';
  if (!body) return;

  // A reply to a proposal message is a note on that proposal.
  const replyTo = msg.reply_to_message?.message_id;
  const proposal = replyTo ? await store.findProposalByTelegramId(replyTo) : null;
  if (proposal) await store.addProposalNote(proposal.id, body);

  await store.addMessage({
    direction: 'owner',
    text: proposal ? `[შენიშვნა შეთავაზებაზე „${proposal.title}“ (${proposal.id})] ${body}` : body,
    telegramMessageId: msg.message_id,
    replyToTelegramId: replyTo,
  });
  if (msg.voice) await notifyOwner('ხმოვანს ჯერ ვერ ვისმენ — ტექსტად მომწერე, გთხოვ.', { direction: 'system' });

  const current = await store.getState();
  if (current.active) {
    await tg.sendChatAction(chatId).catch(() => {});
    await wakeBrain('owner sent a message');
  } else {
    await notifyOwner('ჩავიწერე. ცვლაზე არ ვარ — /on-ით ჩამაბარე და გიპასუხებ.', { direction: 'system' });
  }
}

export async function handleTelegramUpdate(update) {
  const state = await store.getState();
  if (update.callback_query) return handleCallback(update.callback_query, state);
  if (update.message) return handleMessage(update.message, state);
  return undefined;
}
