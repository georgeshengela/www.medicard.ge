/**
 * The always-on Director: answers the owner on Telegram within seconds, with tools on the live
 * system. Reads are free; every change becomes a proposal the owner approves with ✅.
 * One conversation turn at a time (in-process queue); unanswered messages stay in the inbox for
 * the next attempt or the scheduled routine.
 */
import * as store from './store.js';
import * as actions from './actions.js';
import { buildDirectorSnapshot } from './snapshot.js';
import { buildDeepAnalytics } from './analytics.js';
import { BudgetError, llmConfigured, runAgent, usageToday } from './llm.js';
import { isWorkingHours, tbilisiLabel } from './hours.js';
import { notifyOwner, sendProposal } from './service.js';

const obj = (properties, required = []) => ({ type: 'object', properties, required, additionalProperties: false });
const str = (description) => ({ type: 'string', description });
const num = (description) => ({ type: 'number', description });

async function propose(kind, title, body, payload) {
  const p = await store.createProposal({ kind, title, body, payload });
  await sendProposal(p);
  await store.addJournal({ kind: 'note', summary: `შეთავაზება: ${title}`, data: { proposalId: p.id } });
  return { proposed: true, proposalId: p.id, note: 'The owner received it with ✅/❌ buttons. Tell them briefly; do not repeat the whole text.' };
}

export const LIVE_TOOLS = {
  get_metrics: {
    description: 'Aggregate business metrics: users, activity, AI usage, email, support queue, funnel, provider balances, feature flags.',
    parameters: obj({}),
    run: () => buildDirectorSnapshot(),
  },
  find_user: {
    description: 'Is someone registered? Look up by phone number (any Georgian format) or email. Returns masked fields, userId, dates, platform, coin balance.',
    parameters: obj({ query: str('phone number or email address') }, ['query']),
    run: ({ query }) => actions.findUser(query),
  },
  list_support_threads: {
    description: 'Support inbox threads (support@medicard.ge).',
    parameters: obj({ status: { type: 'string', enum: ['active', 'new', 'open', 'waiting', 'closed', 'all'] } }),
    run: ({ status }) => actions.listSupportThreads({ status: status || 'active' }),
  },
  read_support_thread: {
    description: 'Full recent messages of one support thread.',
    parameters: obj({ threadId: str('thread id') }, ['threadId']),
    run: ({ threadId }) => actions.readSupportThread(threadId),
  },
  propose_support_reply: {
    description: 'Draft an email reply to a support thread for the owner to approve; on ✅ it is sent from support@medicard.ge.',
    parameters: obj({ threadId: str('thread id'), body: str('the reply, Georgian unless the sender wrote in another language; plain text'), why: str('one line for the owner') }, ['threadId', 'body']),
    run: ({ threadId, body, why }) => propose('email', `პასუხი წერილზე${why ? ` — ${why}` : ''}`.slice(0, 200), body, { action: 'support_reply', threadId, body }),
  },
  propose_coins: {
    description: 'Give (or take back) Medi Coins on an account. Use find_user first to get userId.',
    parameters: obj({ userId: str('from find_user'), amount: num('integer, ±1…5000'), reason: str('why, shown in the ledger'), who: str('masked name/phone for the owner') }, ['userId', 'amount', 'reason']),
    run: ({ userId, amount, reason, who }) => propose('change', `${amount > 0 ? '+' : ''}${amount} Medi Coins — ${who || 'ანგარიში'}`, `მიზეზი: ${reason}`, { action: 'coins', userId, amount: Math.round(amount), reason }),
  },
  find_place: {
    description: 'Geocode an address or place name in Georgia to coordinates (up to 3 candidates).',
    parameters: obj({ address: str('address or place') }, ['address']),
    run: ({ address }) => actions.findPlace(address),
  },
  list_medirun_gifts: {
    description: 'Active MEDIRUN gifts on the map.',
    parameters: obj({}),
    run: () => actions.listActiveGifts(),
  },
  propose_medirun_gift: {
    description: 'Put a MEDIRUN gift on the map at coordinates (use find_place first and confirm the right candidate). Owner approves.',
    parameters: obj({
      latitude: num('latitude'), longitude: num('longitude'), placeLabel: str('human-readable place'),
      title: str('gift title shown to players'), description: str('what the gift is and how to get it'),
      stock: num('how many can claim it, default 1'), days: num('how many days it stays, default 7'),
      rewardKind: { type: 'string', enum: ['DIGITAL', 'PHYSICAL'] },
    }, ['latitude', 'longitude', 'title']),
    run: (a) => {
      actions.giftFromPayload(a); // validates location before bothering the owner
      const map = `https://www.openstreetmap.org/?mlat=${a.latitude}&mlon=${a.longitude}#map=17/${a.latitude}/${a.longitude}`;
      return propose('change', `MEDIRUN საჩუქარი: ${String(a.title).slice(0, 80)}`,
        `ადგილი: ${a.placeLabel || '—'}\nრუკა: ${map}\nრაოდენობა: ${a.stock || 1} · ვადა: ${a.days || 7} დღე · ${a.rewardKind === 'PHYSICAL' ? 'ფიზიკური' : 'ციფრული'}\n${a.description || ''}`.trim(),
        { action: 'medirun_gift', ...a });
    },
  },
  propose_decision: {
    description: 'Any other decision or task that needs the owner (strategy, content, product change).',
    parameters: obj({ kind: { type: 'string', enum: ['decision', 'post', 'task', 'team', 'change'] }, title: str('short'), body: str('what and why') }, ['kind', 'title', 'body']),
    run: ({ kind, title, body }) => propose(kind, title, body, null),
  },
  get_analytics: {
    description: 'Deep analytics: 30-day daily signups/DAU/AI, feature usage this week vs last, AI modes, app versions, weekly cohorts.',
    parameters: obj({}),
    run: () => buildDeepAnalytics(),
  },
  list_initiatives: {
    description: 'The growth plan: initiatives with status (idea/proposed/approved/active/done/dropped), metric, target, progress.',
    parameters: obj({}),
    run: async () => (await store.listInitiatives()).map((i) => ({ id: i.id, title: i.title, area: i.area, status: i.status, metric: i.metric, target: i.target, impact: i.impact, effort: i.effort, progress: i.progress, result: i.result })),
  },
  add_idea: {
    description: 'Put a new growth/marketing/product idea on the plan board (status idea). Free — no approval needed to record ideas.',
    parameters: obj({
      title: str('short'), area: { type: 'string', enum: ['growth', 'marketing', 'content', 'product', 'retention', 'partnerships', 'analytics', 'ops'] },
      hypothesis: str('what we believe and why'), plan: str('concrete steps'), metric: str('how we measure'), target: str('target value'),
      impact: num('1-5'), effort: num('1-5'),
    }, ['title', 'area']),
    run: async (a) => { const i = await store.createInitiative(a); await store.addJournal({ kind: 'note', summary: `ახალი იდეა: ${i.title}` }); return { ok: true, id: i.id }; },
  },
  propose_initiative: {
    description: 'Ask the owner to approve an initiative from the board (✅ → approved, the Director then executes it).',
    parameters: obj({ initiativeId: str('id from list_initiatives') }, ['initiativeId']),
    run: async ({ initiativeId }) => {
      const i = await store.getInitiative(initiativeId);
      if (!i) return { error: 'unknown initiative' };
      if (!['idea', 'proposed'].includes(i.status)) return { error: `already ${i.status}` };
      const body = [i.hypothesis && `ჰიპოთეზა: ${i.hypothesis}`, i.plan && `გეგმა: ${i.plan}`, (i.metric || i.target) && `საზომი: ${i.metric}${i.target ? ` → ${i.target}` : ''}`, `ეფექტი ${i.impact}/5 · ძალისხმევა ${i.effort}/5`].filter(Boolean).join('\n\n');
      const res = await propose('decision', `ინიციატივა: ${i.title}`, body, { action: 'initiative', initiativeId: i.id });
      await store.updateInitiative(i.id, { status: 'proposed', proposalId: res.proposalId });
      return res;
    },
  },
  recent_reports: {
    description: 'The Director\'s latest plans, reports and research (titles; pass id to read one).',
    parameters: obj({ id: str('optional report id to read in full') }),
    run: async ({ id }) => (id ? store.getReport(id) : store.listReports({ limit: 15, withBody: false })),
  },
  pending_proposals: {
    description: 'Proposals still waiting for the owner.',
    parameters: obj({}),
    run: async () => (await store.listProposals({ status: 'pending', limit: 20 })).map((p) => ({ id: p.id, kind: p.kind, title: p.title, createdAt: p.createdAt })),
  },
  remember: {
    description: 'Save a durable note (owner preferences, decisions, strategy). Empty value deletes.',
    parameters: obj({ key: str('[a-z0-9_.-], ≤64'), value: str('text') }, ['key', 'value']),
    run: async ({ key, value }) => { await store.writeMemory(key, value || null); return { ok: true }; },
  },
};

function systemPrompt({ memory, pending, usage }) {
  return `You are the Director of MEDICARD (medicard.ge) — the owner's stand-in and COO. The owner is George; you talk to him on Telegram.
MEDICARD: a FREE Georgian health app (Medi AI assistant, medications, nutrition, cycle, pets/Medi Vet, MEDI QUEST, MEDIRUN map game, Medi Coins). Pre-launch, small user numbers.

Now: ${tbilisiLabel()}. Support working hours: Mon–Fri 10:00–19:00 (${isWorkingHours() ? 'now inside' : 'now outside'}).

How you work:
- Answer in Georgian, address him as შენ. Short, concrete, like a sharp COO. No filler, no apologies, no lists of what you could do.
- Telegram shows plain text: no markdown (no **, #, backticks, tables). Use line breaks and at most a few emojis.
- Use tools for facts; never invent numbers, users or states. If a tool fails, say so plainly.
- Reads are free. Every change (email reply, coins, MEDIRUN gift, anything outward or on users) goes through a propose_* tool; the owner approves with ✅. His explicit instruction in chat is the request, the ✅ is the go.
- Privacy: you see masked data only. Never ask for or reveal health data. Share user details with the owner only as the tools return them.
- Never: move money, enable paid features (the app is free), give medical advice, contact anyone except via approved proposals.
- Product freeze notes: MEDIRUN gifts only on the owner's explicit request.
- You own growth, not just answers. When the owner asks what is happening or what to do, lead with a view and a recommendation backed by numbers (get_analytics), name the plan's current priorities (list_initiatives), and record every new idea you raise with add_idea. Ask for approval with propose_initiative when an idea is ready.
- Save lasting preferences/decisions with remember.
- AI calls today: ${usage.calls}/${usage.cap}.

Memory:
${memory || '(empty)'}

Waiting for the owner:
${pending || '(nothing)'}`;
}

let chain = Promise.resolve();

/** Answers every unanswered owner message. Safe to call repeatedly; runs one at a time. */
export function respondToOwner() {
  chain = chain.then(runTurn, runTurn);
  return chain;
}

async function runTurn() {
  if (!llmConfigured()) return { skipped: 'no-llm' };
  const inbox = await store.unhandledOwnerMessages();
  if (!inbox.length) return { skipped: 'empty' };
  const ids = new Set(inbox.map((m) => m.id));
  const [recent, memoryRows, pendingRows, usage] = await Promise.all([
    store.listMessages({ limit: 30 }),
    store.readMemory(),
    store.listProposals({ status: 'pending', limit: 10 }),
    usageToday(),
  ]);
  const history = [];
  for (const m of recent.filter((r) => !ids.has(r.id))) {
    const role = m.direction === 'owner' ? 'user' : 'assistant';
    const text = m.direction === 'system' ? `[system] ${m.text}` : m.text;
    const last = history[history.length - 1];
    if (last && last.role === role) last.content += `\n\n${text}`;
    else history.push({ role, content: text });
  }
  while (history.length && history[0].role !== 'user') history.shift();
  const newText = inbox.map((m) => m.text).join('\n\n');
  if (history.length && history[history.length - 1].role === 'user') history[history.length - 1].content += `\n\n${newText}`;
  else history.push({ role: 'user', content: newText });

  const system = systemPrompt({
    memory: memoryRows.map((m) => `- ${m.key}: ${m.value}`).join('\n').slice(0, 6000),
    pending: pendingRows.map((p) => `- ${p.title}`).join('\n'),
    usage,
  });
  try {
    const reply = await runAgent({ system, messages: history, tools: LIVE_TOOLS });
    await store.markMessagesHandled([...ids]);
    if (reply) await notifyOwner(reply);
    await store.touchState('lastBrainAt');
    return { ok: true };
  } catch (error) {
    if (error instanceof BudgetError) {
      await store.markMessagesHandled([...ids]);
      await notifyOwner('დღევანდელი AI ლიმიტი ამოიწურა — ხვალამდე მხოლოდ ღილაკები მუშაობს. ლიმიტი: DIRECTOR_MAX_AI_CALLS_PER_DAY.', { direction: 'system' });
      return { budget: true };
    }
    console.warn('[director] live turn failed', error?.message);
    await notifyOwner('ტექნიკური შეფერხება მაქვს — შენი მესიჯი შენახულია, მალე ვუპასუხებ.', { direction: 'system' }).catch(() => {});
    return { error: true };
  }
}
