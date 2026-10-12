/**
 * Support on autopilot while the Director is on shift (owner-delegated, 2026-09-28).
 *   outside working hours → one fixed acknowledgement per thread, answered in the morning
 *   inside working hours  → the model classifies the latest inbound message against the support
 *     knowledge base; plain "how does the app work" questions it can answer from the knowledge are
 *     answered directly (max AUTO_REPLIES_PER_THREAD per thread, links only to medicard.ge);
 *     everything else (account, data, medical, money, complaints, business, unclear) goes to the
 *     owner as a ready draft with ✅.
 * The autopilot writes on its own only in the public support mailbox and never in a conversation
 * we started (`autopilotBlock`) — there the owner gets the notice / draft instead. Everything it
 * writes is in the sender's language: Georgian, or (for anyone who does not write Georgian) their
 * language with an English ACK, „MEDICARD team“ and English email chrome.
 * Each inbound message is decided once (table "DirectorSupportTriage").
 */
import { prisma } from '../prisma.js';
import { withJobLease } from '../jobLease.js';
import { isOwnDomain } from '../support/threading.js';
import { writesGeorgian } from '../support/language.js';
import { supportSender } from '../support/reply.js';
import * as store from './store.js';
import { askJson, BudgetError, llmConfigured } from './llm.js';
import { isWorkingHours } from './hours.js';
import { supportKnowledge } from './knowledge.js';
import { readSupportThread, sendDirectorSupportReply } from './actions.js';
import { notifyOwner, sendProposal } from './service.js';

export const AUTO_REPLIES_PER_THREAD = 3;
export const ACK_TEXT = `გამარჯობა!

მადლობა, რომ მოგვწერე — წერილი მივიღეთ. ახლა არასამუშაო დროა; გიპასუხებთ სამუშაო საათებში (ორშაბათი–პარასკევი, 10:00–19:00).

MEDICARD-ის გუნდი`;
export const ACK_TEXT_EN = `Hello,

Thank you for writing to us — we have received your message. It is outside our working hours right now; we will reply during working hours (Monday–Friday, 10:00–19:00 Tbilisi time, GMT+4).

MEDICARD team`;
const LEASE = 'director-support';
const INTERVAL_MS = 60 * 1000;

let ensured = false;
async function ensureTable(db = prisma) {
  if (ensured) return;
  await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "DirectorSupportTriage" (
    "messageId" TEXT PRIMARY KEY,
    "threadId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "category" TEXT,
    "acked" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  await db.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "DirectorSupportTriage_thread_idx" ON "DirectorSupportTriage"("threadId", "status")');
  ensured = true;
}

async function mark(messageId, threadId, status, { category = null, acked = false, note = null } = {}, db = prisma) {
  await db.$executeRaw`INSERT INTO "DirectorSupportTriage" ("messageId", "threadId", "status", "category", "acked", "note")
    VALUES (${messageId}, ${threadId}, ${status}, ${category}, ${acked}, ${note})
    ON CONFLICT ("messageId") DO UPDATE SET "status" = EXCLUDED."status", "category" = COALESCE(EXCLUDED."category", "DirectorSupportTriage"."category"),
      "acked" = "DirectorSupportTriage"."acked" OR EXCLUDED."acked", "note" = COALESCE(EXCLUDED."note", "DirectorSupportTriage"."note"), "updatedAt" = NOW()`;
}

/** Links in an automatic reply may only point to medicard.ge. */
export function linksAreSafe(text) {
  const urls = String(text).match(/https?:\/\/[^\s)>\]]+/gi) || [];
  return urls.every((u) => { try { return /(^|\.)medicard\.ge$/i.test(new URL(u).hostname); } catch { return false; } });
}

/** A Georgian reply to a Georgian sender, a reply without Georgian to anyone else. No `lang` → no check. */
export function replyLanguageMatches(reply, lang) {
  return !lang || writesGeorgian({ text: reply }) === (lang === 'ka');
}

export function canAutoSend(verdict, autoCount, lang = null) {
  return verdict?.category === 'help' && verdict.answerable === true && typeof verdict.reply === 'string'
    && verdict.reply.trim().length >= 20 && verdict.reply.length <= 3000 && linksAreSafe(verdict.reply)
    && replyLanguageMatches(verdict.reply, lang) && autoCount < AUTO_REPLIES_PER_THREAD;
}

/** 'ka' when the sender of this inbound message writes Georgian, else 'en'. */
export const senderLang = (msg) => (writesGeorgian({ subject: msg.messageSubject ?? msg.subject, text: msg.text }) ? 'ka' : 'en');

/**
 * Why the autopilot may not write to this sender on its own (null = it may). It writes only in the
 * public support mailbox, and never in a conversation we started: a partner answering the owner's
 * letter is not a support ticket (2026-10-09, Tasso got the Georgian ACK from ceo@).
 * `weStarted`: this sender's thread, or another recent one with them, opens with our letter —
 * replies do not always thread (the provider swaps our Message-ID, helpdesks rewrite subjects).
 */
export function autopilotBlock({ mailbox, weStarted }, publicMailbox = supportSender().email) {
  if (weStarted) return 'ours';
  if (String(mailbox || '').trim().toLowerCase() !== String(publicMailbox).toLowerCase()) return 'mailbox';
  return null;
}

/** The after-hours acknowledgement in the sender's language, or why none may go out. */
export function afterHoursAck(msg, publicMailbox = supportSender().email) {
  const reason = autopilotBlock(msg, publicMailbox);
  if (reason) return { send: false, reason };
  return senderLang(msg) === 'ka' ? { send: true, lang: 'ka', body: ACK_TEXT } : { send: true, lang: 'en', body: ACK_TEXT_EN };
}

const BLOCK_WHY = {
  ours: () => 'ეს საუბარი ჩვენ დავიწყეთ',
  mailbox: (msg) => `ყუთი: ${msg.mailbox || 'უცნობი'}`,
};

export const TRIAGE_SYSTEM = `You triage emails sent to support@medicard.ge for MEDICARD, a free Georgian health app.
Return ONLY JSON: {"category": "help|account|data_request|medical|billing|complaint|business|spam|other", "answerable": true|false, "reply": "...", "summary": "...", "reason": "..."}
- category help = a general question about how the app works / where something is.
- If the sender asks for a human / a person / not a bot, answerable=false (the owner answers).
- answerable = true ONLY if the knowledge below fully answers it. Never guess, never promise features, dates or actions on their account.
- account (login, deletion, bugs on their account), data_request, medical, billing/money, complaint, business (partnership, ads, investment, press) → answerable=false, but still write a helpful draft reply for the owner to approve (for business: a polite reply that the owner will get back to them).
- reply: plain text email in replyLanguage (given with the thread), warm and short. Always write the product name as MEDICARD (Latin letters). Sign exactly MEDICARD-ის გუნდი under a Georgian reply and MEDICARD team under a reply in any other language. No medical advice. Links only to https://medicard.ge pages from the knowledge.
- summary: one Georgian line for the owner. reason: why answerable or not.

KNOWLEDGE:
`;

async function handleThread(msg, thread, db) {
  const later = await db.supportMessage.findFirst({
    where: { threadId: msg.threadId, direction: 'outbound', createdAt: { gt: msg.createdAt }, authorAdminId: { not: null } },
    select: { id: true },
  });
  if (later) return mark(msg.id, msg.threadId, 'human', {}, db); // a person already answered

  if (!isWorkingHours()) {
    // One ACK (or one owner notice) per thread per quiet spell.
    const [handled] = await db.$queryRaw`SELECT 1 FROM "DirectorSupportTriage" WHERE "threadId" = ${msg.threadId}
      AND ("acked" OR "note" LIKE 'no-ack:%') AND "updatedAt" > NOW() - INTERVAL '12 hours' LIMIT 1`;
    if (handled) return mark(msg.id, msg.threadId, 'deferred', {}, db);
    const subject = thread.subject || 'უსათაურო';
    const ack = afterHoursAck(msg);
    if (!ack.send) {
      await notifyOwner(`📩 ახალი წერილი (არასამუშაო დრო): „${subject}“. ავტომატური „მივიღეთ“ არ გავუგზავნე (${BLOCK_WHY[ack.reason](msg)}), სამუშაო დროს გადავხედავ.`, { direction: 'system' });
      return mark(msg.id, msg.threadId, 'deferred', { note: `no-ack: ${ack.reason}` }, db);
    }
    await sendDirectorSupportReply({ threadId: msg.threadId, body: ack.body, status: 'open', lang: ack.lang });
    await notifyOwner(`📩 ახალი წერილი (არასამუშაო დრო): „${subject}“. „მივიღეთ“ გავუგზავნე${ack.lang === 'en' ? ' ინგლისურად' : ''}, სამუშაო დროს ვუპასუხებ.`, { direction: 'system' });
    return mark(msg.id, msg.threadId, 'deferred', { acked: true }, db);
  }

  const lang = senderLang(msg);
  const block = autopilotBlock(msg);
  const view = await readSupportThread(msg.threadId, { db });
  const replyLanguage = lang === 'ka' ? 'Georgian' : "the sender's language (they do not write Georgian; English when unsure)";
  const verdict = await askJson({ system: TRIAGE_SYSTEM + supportKnowledge(), user: JSON.stringify({ ...view, replyLanguage }) });
  const [{ n: autoCount }] = await db.$queryRaw`SELECT COUNT(*)::int AS n FROM "DirectorSupportTriage"
    WHERE "threadId" = ${msg.threadId} AND "status" = 'answered' AND "createdAt" > NOW() - INTERVAL '30 days'`;

  if (verdict.category === 'spam' && block !== 'ours') { // an answer to our own letter is never spam
    await store.addJournal({ kind: 'note', summary: `სპამი გამოვტოვე: ${String(thread.subject || '').slice(0, 80)}` });
    return mark(msg.id, msg.threadId, 'spam', { category: 'spam' }, db);
  }
  if (!block && canAutoSend(verdict, autoCount, lang)) {
    await sendDirectorSupportReply({ threadId: msg.threadId, body: verdict.reply.trim(), status: 'waiting', lang });
    await notifyOwner(`✉️ ვუპასუხე: „${thread.subject || 'უსათაურო'}“ — ${verdict.summary || ''}\n\nპასუხი:\n${verdict.reply.trim()}`, { direction: 'system' });
    await store.addJournal({ kind: 'note', summary: `support: ვუპასუხე — ${String(verdict.summary || thread.subject || '').slice(0, 120)}` });
    return mark(msg.id, msg.threadId, 'answered', { category: verdict.category }, db);
  }

  const why = block ? `${BLOCK_WHY[block](msg)} — ავტომატურად არ ვპასუხობ`
    : autoCount >= AUTO_REPLIES_PER_THREAD ? 'საუბარი გაიწელა — შენი ჩართვა სჭირდება'
      : verdict.reply && !replyLanguageMatches(verdict.reply, lang) ? 'პროექტი გამგზავნის ენაზე არ დაიწერა — შეამოწმე'
        : (verdict.reason || verdict.category);
  const body = `${verdict.summary || ''}\nრატომ შენ: ${why}\n\nპასუხის პროექტი:\n${verdict.reply || '(პროექტი ვერ შევადგინე — უპასუხე ადმინიდან)'}`;
  const p = await store.createProposal({
    kind: 'email',
    title: `წერილი: ${String(thread.subject || 'უსათაურო').slice(0, 120)}`,
    body,
    payload: verdict.reply ? { action: 'support_reply', threadId: msg.threadId, body: verdict.reply.trim() } : null,
  });
  await sendProposal(p);
  return mark(msg.id, msg.threadId, 'escalated', { category: verdict.category, note: p.id }, db);
}

export async function runSupportAgentTick({ db = prisma } = {}) {
  const state = await store.getState(db);
  if (!state.active || !llmConfigured()) return { skipped: 'off' };
  await ensureTable(db);
  const rows = await db.$queryRaw`
    SELECT m."id", m."threadId", m."createdAt", t."counterpartEmail", t."subject", t."mailbox", d."status" AS "triage",
      COALESCE(NULLIF(m."subject", ''), t."subject") AS "messageSubject", LEFT(m."textBody", 4000) AS "text",
      -- a letter of ours to this sender (a thread that opens outbound) within the thread-match window
      EXISTS (SELECT 1 FROM "SupportThread" lt
        WHERE lt."counterpartEmail" = t."counterpartEmail" AND lt."createdAt" <= m."createdAt" AND lt."createdAt" > m."createdAt" - INTERVAL '90 days'
          AND (SELECT f."direction" FROM "SupportMessage" f WHERE f."threadId" = lt."id" AND f."direction" <> 'note'
            ORDER BY f."createdAt" ASC, f."id" ASC LIMIT 1) = 'outbound') AS "weStarted"
    FROM "SupportMessage" m
    JOIN "SupportThread" t ON t."id" = m."threadId"
    LEFT JOIN "DirectorSupportTriage" d ON d."messageId" = m."id"
    WHERE m."direction" = 'inbound' AND m."bodyStatus" = 'ok' AND NOT m."isAuto"
      AND m."createdAt" > NOW() - INTERVAL '3 days'
      AND (d."messageId" IS NULL OR d."status" = 'deferred')
    ORDER BY m."createdAt" ASC LIMIT 30`;
  const latest = new Map(); // one decision per thread: its newest inbound message
  for (const r of rows) {
    if (r.triage === 'deferred' && !isWorkingHours()) continue;
    const prev = latest.get(r.threadId);
    if (prev) await mark(prev.id, prev.threadId, 'merged', {}, db);
    latest.set(r.threadId, r);
  }
  let done = 0;
  for (const r of latest.values()) {
    if (isOwnDomain(r.counterpartEmail)) { await mark(r.id, r.threadId, 'skipped', { note: 'own domain' }, db); continue; }
    try {
      await handleThread(r, { subject: r.subject }, db);
      done += 1;
    } catch (error) {
      if (error instanceof BudgetError) return { budget: true, done };
      console.warn('[director] support triage failed', r.id, error?.message);
      await mark(r.id, r.threadId, 'error', { note: String(error?.message || error).slice(0, 300) }, db);
      await notifyOwner(`⚠️ წერილი „${r.subject || 'უსათაურო'}“ ვერ დავამუშავე (${String(error?.message || '').slice(0, 120)}). ადმინში ნახე.`, { direction: 'system' }).catch(() => {});
    }
  }
  return { done };
}

const workersOff = () => process.env.NODE_ENV === 'test' || process.env.DIRECTOR_WORKERS_DISABLED === 'true' || process.env.SUPPORT_WORKERS_DISABLED === 'true';
let running = false;

export function startDirectorWorkers() {
  if (workersOff()) return;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await withJobLease(LEASE, INTERVAL_MS * 3, () => runSupportAgentTick());
    } catch (error) {
      if (!/Support(Thread|Message)|42P01|does not exist/.test(String(error?.message))) console.warn('[director] support tick failed', error?.message);
    } finally {
      running = false;
    }
  };
  setInterval(tick, INTERVAL_MS).unref();
  setTimeout(tick, 20_000).unref();
}
