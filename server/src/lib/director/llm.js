/**
 * The always-on Director's model: Claude via the existing OpenRouter account. Owner-approved
 * (2026-09-28) as the owner's own admin assistant; it never receives health data, and user
 * lookups return masked fields only. Provider routing denies training/retention. A daily call
 * cap protects the balance.
 */
import OpenAI from 'openai';
import { prisma } from '../prisma.js';
import { ensureDirectorTables } from './store.js';
import { tbilisiParts } from './hours.js';

export const DIRECTOR_MODEL = () => process.env.DIRECTOR_MODEL || 'anthropic/claude-sonnet-5';
const MAX_CALLS_PER_DAY = () => Number(process.env.DIRECTOR_MAX_AI_CALLS_PER_DAY) || 400;

export const llmConfigured = () => Boolean(process.env.OPENROUTER_API_KEY);

let client = null;
function getClient() {
  if (!client) {
    client = new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
      timeout: 90_000,
      maxRetries: 2,
      defaultHeaders: { 'HTTP-Referer': 'https://medicard.ge', 'X-Title': 'Medicard.GE Director' },
    });
  }
  return client;
}

let columnsReady = false;
async function ensureBudgetColumns(db = prisma) {
  if (columnsReady) return;
  await ensureDirectorTables(db);
  await db.$executeRawUnsafe('ALTER TABLE "DirectorState" ADD COLUMN IF NOT EXISTS "aiDay" TEXT');
  await db.$executeRawUnsafe('ALTER TABLE "DirectorState" ADD COLUMN IF NOT EXISTS "aiCalls" INTEGER NOT NULL DEFAULT 0');
  columnsReady = true;
}

/** Reserves one model call for today (Tbilisi). False when the daily cap is reached. */
export async function reserveCall(db = prisma) {
  await ensureBudgetColumns(db);
  const day = tbilisiParts().ymd;
  const rows = await db.$queryRaw`UPDATE "DirectorState" SET
      "aiCalls" = CASE WHEN "aiDay" = ${day} THEN "aiCalls" + 1 ELSE 1 END, "aiDay" = ${day}
    WHERE "id" = 1 AND ("aiDay" IS DISTINCT FROM ${day} OR "aiCalls" < ${MAX_CALLS_PER_DAY()})
    RETURNING "aiCalls"`;
  return rows.length > 0;
}

export async function usageToday(db = prisma) {
  await ensureBudgetColumns(db);
  const [row] = await db.$queryRaw`SELECT "aiDay", "aiCalls" FROM "DirectorState" WHERE "id" = 1`;
  return { calls: row?.aiDay === tbilisiParts().ymd ? row.aiCalls : 0, cap: MAX_CALLS_PER_DAY() };
}

export class BudgetError extends Error {
  constructor() { super('დღევანდელი AI ლიმიტი ამოიწურა.'); this.code = 'DIRECTOR_BUDGET'; }
}

async function complete(body) {
  if (!(await reserveCall())) throw new BudgetError();
  return getClient().chat.completions.create({
    model: DIRECTOR_MODEL(),
    provider: { data_collection: 'deny' },
    ...body,
  });
}

/**
 * Tool-calling loop. `tools` = { name: { description, parameters (JSON schema), run(args) } }.
 * Returns the final assistant text. Tool errors are fed back to the model, never thrown.
 */
export async function runAgent({ system, messages, tools, maxSteps = 8, maxTokens = 1500 }) {
  const toolDefs = Object.entries(tools).map(([name, t]) => ({ type: 'function', function: { name, description: t.description, parameters: t.parameters } }));
  const convo = [{ role: 'system', content: system }, ...messages];
  for (let step = 0; step < maxSteps; step += 1) {
    const res = await complete({ messages: convo, tools: toolDefs, max_tokens: maxTokens, temperature: 0.3 });
    const msg = res.choices?.[0]?.message;
    if (!msg) throw new Error('empty model response');
    const calls = msg.tool_calls || [];
    if (!calls.length) return String(msg.content || '').trim();
    convo.push({ role: 'assistant', content: msg.content || '', tool_calls: calls });
    for (const call of calls) {
      let out;
      try {
        const tool = tools[call.function?.name];
        if (!tool) throw new Error(`unknown tool ${call.function?.name}`);
        const args = call.function.arguments ? JSON.parse(call.function.arguments) : {};
        out = await tool.run(args);
      } catch (error) {
        out = { error: String(error?.message || error).slice(0, 300) };
      }
      convo.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(out ?? null).slice(0, 12000) });
    }
  }
  return 'ამ კითხვაზე ბევრი ნაბიჯი დამჭირდა და გავჩერდი. ცოტა დააზუსტე, გთხოვ.';
}

/** Single JSON answer (no tools) — used for support triage. */
export async function askJson({ system, user, maxTokens = 1200 }) {
  const res = await complete({
    messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
    max_tokens: maxTokens,
    temperature: 0.2,
  });
  const text = String(res.choices?.[0]?.message?.content || '');
  const json = /\{[\s\S]*\}/.exec(text)?.[0];
  if (!json) throw new Error('model did not return JSON');
  return JSON.parse(json);
}
