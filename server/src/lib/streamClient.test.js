import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import express from 'express';
import { watchStreamClient } from './streamClient.js';

// Medi chat F1 (2026-10-08): POST /api/ai/query listened for req 'close' only after awaiting the session
// and patient context. express.json() had already read the body, so that event had fired: a person who
// left (closed Medi, lost the connection, 180 s timeout) never aborted the AI call, and the unseen answer
// was stored as a separate consultation. The response is what tells us the person is gone.

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** A stream handler shaped like /api/ai/query: reads first, then streams until done or the person leaves. */
async function harness(t) {
  const runs = [];
  const app = express();
  app.use(express.json());
  app.post('/stream', async (req, res) => {
    const run = { aborted: false, stored: false, skippedBeforeStart: false };
    run.done = new Promise((resolve) => { run.finish = resolve; });
    runs.push(run);
    await sleep(Number(req.body.readMs) || 0); // the session lookup + patient context reads
    const client = watchStreamClient(res);
    if (client.gone()) {
      run.skippedBeforeStart = true;
      client.dispose();
      run.finish();
      return;
    }
    client.signal.addEventListener('abort', () => { run.aborted = true; });
    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream');
    res.flushHeaders();
    try {
      for (let i = 0; i < Number(req.body.chunks || 0); i++) {
        if (client.signal.aborted) break;
        res.write(`data: ${JSON.stringify({ type: 'delta', text: String(i) })}\n\n`);
        await sleep(20);
      }
      if (client.gone()) return;
      run.stored = true; // persistChatTurn
      res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
      res.end();
    } finally {
      client.dispose();
      run.finish();
    }
  });
  const server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const send = async (body, abortAfterMs) => {
    const controller = new AbortController();
    if (abortAfterMs != null) setTimeout(() => controller.abort(), abortAfterMs);
    try {
      const response = await fetch(`${origin}/stream`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: controller.signal,
      });
      return await response.text();
    } catch (error) {
      return error.name;
    }
  };
  return { runs, send };
}

test('a person who leaves mid-answer aborts the AI call and nothing is stored', async (t) => {
  const { runs, send } = await harness(t);
  assert.equal(await send({ readMs: 60, chunks: 100 }, 200), 'AbortError');
  await Promise.race([runs[0].done, sleep(2000)]);
  assert.equal(runs[0].aborted, true, 'the provider signal was aborted');
  assert.equal(runs[0].stored, false, 'the unseen answer was not stored');
});

test('a person who left during the reads gets no AI call at all', async (t) => {
  const { runs, send } = await harness(t);
  assert.equal(await send({ readMs: 300, chunks: 5 }, 60), 'AbortError');
  await Promise.race([runs[0].done, sleep(2000)]);
  assert.equal(runs[0].skippedBeforeStart, true);
  assert.equal(runs[0].stored, false);
});

test('a delivered answer is stored and never counted as an abort', async (t) => {
  const { runs, send } = await harness(t);
  const text = await send({ readMs: 30, chunks: 3 });
  assert.match(text, /"type":"done"/);
  await runs[0].done;
  await sleep(20); // the response 'close' after end() must not abort
  assert.equal(runs[0].stored, true);
  assert.equal(runs[0].aborted, false);
});

test('/api/ai/query streams through the response watcher and skips storing once the person is gone', () => {
  const src = readFileSync(new URL('../routes/ai.routes.js', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /req\.on\('close'/, 'req close fires before the handler listens');
  const start = src.indexOf('if (stream) {');
  const branch = src.slice(start, src.indexOf('\n      return;\n    }\n', start));
  assert.ok(start > 0 && branch.includes('persistChatTurn'), 'found the streamed branch');
  assert.match(branch, /const client = watchStreamClient\(res\);\s*if \(client\.gone\(\)\)/);
  assert.match(branch, /signal: client\.signal/);
  assert.match(branch, /if \(client\.gone\(\)\) return;\s*\n\s*const \{ saved, usage \} = await persistChatTurn/);
  assert.match(branch, /finally \{\s*client\.dispose\(\);/);
});

// Review (2026-10-08): enforceAiQuota listens for 'close' only after its own reads. A person gone during
// them never fired that listener, and the early return neither charged nor freed the slot — it stayed
// reserved until the 20-minute sweep. Cancels are also not AI errors: admin's command center turns
// „AI შეცდომები“ on for any ERROR row in 24 h.
test('/api/ai/query frees the reserved slot when the person left before the stream started', () => {
  const src = readFileSync(new URL('../routes/ai.routes.js', import.meta.url), 'utf8');
  const early = src.slice(src.indexOf('const client = watchStreamClient(res);'));
  const block = early.slice(0, early.indexOf('return;'));
  assert.match(block, /if \(client\.gone\(\)\) \{[\s\S]*await req\.releaseAiCredit\?\.\(\)/);
  assert.match(early, /runTrackedAi\(\{[\s\S]*?cancelled: client\.gone,[\s\S]*?signal: client\.signal/);
});

test('a cancelled AI call is not logged as an AI error; a real failure still is', async (t) => {
  const { prisma } = await import('./prisma.js');
  const { runTrackedAi } = await import('./aiTelemetry.js');
  const rows = [];
  const original = prisma.aiInteraction.create;
  prisma.aiInteraction.create = async ({ data }) => { rows.push(data); return { id: `row-${rows.length}` }; };
  t.after(() => { prisma.aiInteraction.create = original; });
  const fail = () => { throw new Error('upstream'); };

  let gone = true;
  await assert.rejects(runTrackedAi({ userId: 'u1', mode: 'DOCTOR', userPrompt: 'q', cancelled: () => gone, fn: fail }), /upstream/);
  assert.equal(rows.length, 0, 'the person left: no ERROR row');

  gone = false;
  await assert.rejects(runTrackedAi({ userId: 'u1', mode: 'DOCTOR', userPrompt: 'q', cancelled: () => gone, fn: fail }), /upstream/);
  await assert.rejects(runTrackedAi({ userId: 'u1', mode: 'DOCTOR', userPrompt: 'q', fn: fail }), /upstream/);
  assert.deepEqual(rows.map((row) => row.status), ['ERROR', 'ERROR']);

  const ok = await runTrackedAi({ userId: 'u1', mode: 'DOCTOR', userPrompt: 'q', cancelled: () => false, fn: async () => ({ content: 'a' }) });
  assert.equal(ok.interactionId, 'row-3');
  assert.equal(rows[2].status, 'OK');
});
