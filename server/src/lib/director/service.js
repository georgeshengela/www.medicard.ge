/**
 * Director ↔ owner over Telegram. Only the paired private chat is ever answered; everything else
 * is ignored silently. Approve/reject buttons are handled here deterministically (no AI involved);
 * approved system actions run immediately. On shift, owner messages go to the live Director.
 */
import * as store from './store.js';
import * as tg from './telegram.js';
import { wakeBrain } from './trigger.js';
import { executeProposal } from './actions.js';
import { llmConfigured } from './llm.js';
import { respondToOwner } from './live.js';

const KIND_LABELS = { decision: 'გადაწყვეტილება', post: 'სოც. მედიის პოსტი', email: 'მეილის პასუხი', task: 'დავალება', team: 'გუნდის წევრი', change: 'ცვლილება' };
export const kindLabel = (kind) => KIND_LABELS[kind] || kind;

const HELP = [
  'მე ვარ MEDICARD-ის დირექტორი. ცვლაზე ყოფნისას წამებში გპასუხობ: ციფრები, „ეს ნომერი გვყავს?“, support-ის წერილები, Medi Coins, MEDIRUN-ის საჩუქარი მისამართზე.',
  'სამუშაო დროს (ორშ–პარ 10–19) support-ის მარტივ კითხვებს თავად ვპასუხობ, დანარჩენს შენ გკითხავ. სამუშაო დროის გარეთ „მივიღეთ“-ს ვუგზავნი.',
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

/**
 * Records the owner's decision; an approved proposal with a system action (email reply, coins,
 * MEDIRUN gift) is executed right away and reported. Others are left for the Director to act on.
 */
async function decide(proposalId, approve, via, { note } = {}) {
  const p = await store.decideProposal(proposalId, { approve, via, note });
  if (!p) return null;
  await store.addJournal({ kind: 'note', summary: `${approve ? 'დადასტურდა' : 'უარყოფილია'}: ${p.title}`, data: { proposalId: p.id, via } });
  if (!approve) {
    await notifyOwner(`❌ გასაგებია, „${p.title}“ არ კეთდება.`, { direction: 'system' });
    return p;
  }
  try {
    const result = await executeProposal(p);
    if (result) {
      await store.completeProposal(p.id, { result });
      await store.addJournal({ kind: 'note', summary: `შესრულდა: ${p.title} — ${result}` });
      await notifyOwner(`✅ შესრულდა: „${p.title}“. ${result}`, { direction: 'system' });
    } else {
      await notifyOwner(`✅ მივიღე: „${p.title}“. შევასრულებ და მოგახსენებ.`, { direction: 'system' });
      await wakeBrain(`owner approved proposal ${p.id}`);
    }
  } catch (error) {
    console.warn('[director] execute failed', p.id, error?.message);
    await notifyOwner(`⚠️ „${p.title}“ ვერ შესრულდა: ${String(error?.message || error).slice(0, 200)}`, { direction: 'system' });
  }
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
  await tg.clearButtons(chatId, cb.message.message_id).catch(() => {});
  await tg.answerCallback(cb.id, m[2] === 'a' ? 'დადასტურდა ✅' : 'უარყოფილია ❌').catch(() => {});
  const p = await decide(m[1], m[2] === 'a', 'telegram');
  if (!p) await notifyOwner('ეს უკვე გადაწყვეტილია.', { direction: 'system' });
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
  if (current.active && llmConfigured()) {
    await tg.sendChatAction(chatId).catch(() => {});
    await respondToOwner();
  } else if (current.active) {
    const woke = await wakeBrain('owner sent a message');
    if (woke.ok) {
      await tg.sendChatAction(chatId).catch(() => {});
    } else if (!current.lastBrainAt) {
      await notifyOwner('მივიღე ✍️ ჩემი „ტვინი“ ჯერ არ არის გაშვებული (Claude Code-ის routine). როგორც კი გაიმართება, ამ მესიჯს პირველს ვუპასუხებ.', { direction: 'system' });
    } else {
      await notifyOwner('მივიღე ✍️ გიპასუხებ შემდეგ სამუშაო სესიაზე (საათში ერთხელ ვმუშაობ).', { direction: 'system' });
    }
  } else {
    await notifyOwner('ჩავიწერე. ცვლაზე არ ვარ — /on-ით ჩამაბარე და გიპასუხებ.', { direction: 'system' });
  }
}

/** The owner wrote from the admin page: same path as a Telegram message. */
export async function ownerWroteFromAdmin(text) {
  await store.addMessage({ direction: 'owner', text });
  const state = await store.getState();
  if (state.active && llmConfigured()) return respondToOwner();
  return wakeBrain('owner wrote from admin');
}

export async function handleTelegramUpdate(update) {
  const state = await store.getState();
  if (update.callback_query) return handleCallback(update.callback_query, state);
  if (update.message) return handleMessage(update.message, state);
  return undefined;
}
