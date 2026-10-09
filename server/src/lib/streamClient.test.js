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
  assert.match(branch, /if \(client\.gone\(\)\) return;\s*\n\s*const \{ saved, usage \} = await persistChatTurn\(\{[^}]*gone: client\.gone \}\)/);
  assert.match(branch, /finally \{\s*client\.dispose\(\);/);
});

// Integration review IR-3 (2026-10-09): she closed Medi in the moment after the last word. The OK row was
// written anyway (it counted for the weekly Medi mission), and a close during the save freed the slot under
// a stored consultation; the app dropped the turn and offered the question again as a draft.
test('/api/ai/query keeps no answer she closed Medi on, and sends done before the quest refresh', () => {
  const src = readFileSync(new URL('../routes/ai.routes.js', import.meta.url), 'utf8');
  const start = src.indexOf('if (stream) {');
  const branch = src.slice(start, src.indexOf('\n      return;\n    }\n', start));
  // Any unkept answer — she left, or the save failed (IR2-3) — loses its row, after the response ended.
  assert.match(branch, /finally \{\s*client\.dispose\(\);(\s*\/\/[^\n]*)*\s*if \(!kept\) await forgetUnkeptAnswer\(req\.user\.id, answer\?\.interactionId\);/);
  assert.match(branch, /persistChatTurn\([^\n]*\);\s*kept = true;/);
  const done = branch.indexOf("type: 'done'");
  assert.ok(done > 0 && done < branch.indexOf('res.end();') && branch.indexOf('res.end();') < branch.indexOf('refreshQuestProgressForUser('),
    "'done' reaches the phone before the quest refresh");
  assert.match(src, /async function forgetUnkeptAnswer\(userId, interactionId\) \{[\s\S]*?aiInteraction\.deleteMany\(\{ where: \{ id: interactionId, userId \} \}\)/);
  // The save and the credit are one transaction inside the limiter's settlement, `gone` read last in it.
  const save = src.slice(src.indexOf('export async function persistChatTurn('), src.indexOf('async function forgetUnkeptAnswer('));
  assert.match(save, /req\.settleAiOperation\(\(\) => prisma\.\$transaction\(async \(tx\) => \{[\s\S]*tx\.chatSession\.create[\s\S]*commitAiCredit\(req\.user\.id, tx\);\s*if \(typeof gone === 'function' && gone\(\)\) throw clientGoneError\(\);/);
  assert.doesNotMatch(save, /prisma\.chatSession\.(create|update)|consumeAiCredit|refreshQuestProgressForUser/);
});

test('an answer she left as it finished writes no row', async (t) => {
  const { prisma } = await import('./prisma.js');
  const { runTrackedAi } = await import('./aiTelemetry.js');
  const rows = [];
  const original = prisma.aiInteraction.create;
  prisma.aiInteraction.create = async ({ data }) => { rows.push(data); return { id: `row-${rows.length}` }; };
  t.after(() => { prisma.aiInteraction.create = original; });
  let gone = false;
  // The last delta went out, then the response closed before the provider call returned.
  const fn = async () => { gone = true; return { content: 'the whole answer', model: 'm' }; };
  await assert.rejects(runTrackedAi({ userId: 'u1', mode: 'DOCTOR', userPrompt: 'q', cancelled: () => gone, fn }), { code: 'AI_CLIENT_GONE' });
  assert.equal(rows.length, 0, 'no OK row for the weekly Medi mission to count');
  // Without a cancel hook (every other AI route) a finished answer is logged as before.
  const ok = await runTrackedAi({ userId: 'u1', mode: 'DOCTOR', userPrompt: 'q', fn });
  assert.equal(ok.interactionId, 'row-1');
});

/**
 * persistChatTurn with the real limiter (enforceAiQuota → settle / release) over a fake PeriodUsage row and
 * a fake transaction that applies its writes only when the work resolves. `closeAt` closes the response at
 * one point of the save, as her phone does when she closes Medi.
 * Options: `probe` collects the transaction options, reads made on the global client while the transaction
 * is open, and the save's error; `poolOfOne` makes such a read stall until the transaction expires (the only
 * pool connection is the transaction's own); `reservationLost` empties the reservation before the save (an
 * admin quota reset mid-answer).
 */
async function saveWithCloseAt(closeAt, { probe = {}, poolOfOne = false, reservationLost = false } = {}) {
  const { EventEmitter } = await import('node:events');
  const { prisma } = await import('./prisma.js');
  const { enforceAiQuota } = await import('../middleware/aiLimiter.js');
  const { persistChatTurn } = await import('../routes/ai.routes.js');
  const db = { reserved: 0, commits: 0, releases: 0, sessions: [] };
  const originals = {};
  const patch = (target, key, value, name = key) => { originals[name] = [target, key, target[key]]; target[key] = value; };
  const USER = `close-race-${closeAt}`;
  const req = { user: { id: USER }, lang: 'ka' };
  const res = Object.assign(new EventEmitter(), { status: () => res, json: () => res });
  let gone = false;
  let txOpen = 0;
  probe.globalReadsInTx = 0;
  const pause = async (point) => {
    if (point !== closeAt) return;
    gone = true;
    res.emit('close');
    await sleep(5); // the close handler runs while this statement is still on its way
  };
  const userRow = async () => ({ id: USER, package: null, packageExpiresAt: null });
  patch(prisma.user, 'findUnique', async () => {
    if (txOpen > 0) {
      probe.globalReadsInTx += 1;
      if (poolOfOne) {
        // It waits for a second connection that only frees when the transaction ends: the transaction
        // expires first and the save rolls back (what a busy pool did to finished answers).
        throw Object.assign(new Error('Transaction API error: Transaction already closed: The timeout for this transaction was 5000 ms'), { code: 'P2028' });
      }
    }
    return userRow();
  }, 'user');
  patch(prisma, '$executeRawUnsafe', async () => 0);
  // reserveAiCredit's UPDATE … RETURNING
  patch(prisma, '$queryRaw', async () => { db.reserved += 1; return [{ count: 0, reserved: db.reserved, resetAt: null, notifyAt: null }]; });
  // releaseAiCredit (the stale sweep and the usage-row insert change nothing here)
  patch(prisma, '$executeRaw', async (strings) => {
    if (!strings.join('?').includes('GREATEST("reserved" - 1, 0)') || db.reserved <= 0) return 0;
    db.reserved -= 1;
    db.releases += 1;
    return 1;
  });
  patch(prisma, '$transaction', async (work, options) => {
    probe.txOptions = options;
    const staged = { sessions: [], commits: 0 };
    const tx = {
      // commitAiCredit's package read, through the transaction
      user: { findUnique: userRow },
      chatSession: {
        create: async ({ data }) => { await pause('session'); const row = { id: `s-${closeAt}`, ...data }; staged.sessions.push(row); return row; },
      },
      // commitAiCredit (unlimited) inside the transaction
      $executeRaw: async () => { await pause('credit'); if (db.reserved <= staged.commits) return 0; staged.commits += 1; return 1; },
    };
    txOpen += 1;
    try {
      const result = await work(tx);
      await pause('commit');
      db.sessions.push(...staged.sessions);
      db.reserved -= staged.commits;
      db.commits += staged.commits;
      return result;
    } finally {
      txOpen -= 1;
    }
  });
  try {
    await new Promise((resolve, reject) => enforceAiQuota(req, res, (error) => (error ? reject(error) : resolve())));
    if (closeAt === 'before') res.emit('close'), (gone = true);
    if (reservationLost) db.reserved = 0;
    let outcome = 'kept';
    try {
      await persistChatTurn({ req, session: null, history: [], message: 'my question', mode: 'DOCTOR', answer: { content: 'the answer', interactionId: null }, gone: () => gone });
    } catch (error) {
      outcome = error.message;
      probe.error = error;
    }
    if (!gone) res.emit('finish');
    await req.releaseAiCredit(); // whatever the close or finish started has settled
    return { outcome, sessions: db.sessions.length, commits: db.commits, releases: db.releases, reserved: db.reserved };
  } finally {
    for (const [target, key, value] of Object.values(originals)) target[key] = value;
  }
}

test('a delivered answer is saved and charged once; nothing is released under it', async () => {
  assert.deepEqual(await saveWithCloseAt('never'), { outcome: 'kept', sessions: 1, commits: 1, releases: 0, reserved: 0 });
});

test('closing Medi before or during the save stores and charges nothing and frees the slot', async () => {
  for (const closeAt of ['before', 'session', 'credit']) {
    const result = await saveWithCloseAt(closeAt);
    assert.equal(result.sessions, 0, `${closeAt}: no stored consultation`);
    assert.equal(result.commits, 0, `${closeAt}: no credit taken`);
    assert.equal(result.releases, 1, `${closeAt}: the slot is free again`);
    assert.equal(result.reserved, 0);
    assert.match(result.outcome, closeAt === 'before' ? /AI_REQUEST_ALREADY_RELEASED/ : /AI_CLIENT_GONE/);
  }
});

test('a close during the final commit keeps the answer and its one credit together (the window left)', async () => {
  assert.deepEqual(await saveWithCloseAt('commit'), { outcome: 'kept', sessions: 1, commits: 1, releases: 0, reserved: 0 });
});

// Integration review IR2-2 (2026-10-09): the credit commit inside the save read her package on the global
// client. Each save held its transaction's connection while waiting for a second one from the same pool, under
// Prisma's 2 s / 5 s interactive defaults: a busy pool (or as many finishing answers as pool connections)
// expired the transaction and the answer she had just read was thrown away.
test('a finished answer is saved even when the pool has no second connection for it', async () => {
  const probe = {};
  assert.deepEqual(await saveWithCloseAt('never', { probe, poolOfOne: true }), { outcome: 'kept', sessions: 1, commits: 1, releases: 0, reserved: 0 });
  assert.equal(probe.globalReadsInTx, 0, 'nothing is read on a second connection while the transaction holds one');
  assert.ok(probe.txOptions?.maxWait >= 8_000, 'a busy pool is waited for, not given up on after 2 s');
  assert.ok(probe.txOptions?.timeout >= 15_000, 'the save is not cut at the 5 s default');
});

test('commitAiCredit and the package read go through the transaction client they are given', async (t) => {
  const { prisma } = await import('./prisma.js');
  const { commitAiCredit } = await import('./usage.js');
  const { getUserPackage } = await import('./packages.js');
  const originals = [[prisma.user, 'findUnique', prisma.user.findUnique], [prisma.package, 'findUnique', prisma.package.findUnique]];
  const outside = async () => { throw new Error('read on the global client inside a transaction'); };
  prisma.user.findUnique = outside;
  prisma.package.findUnique = outside;
  t.after(() => { for (const [target, key, value] of originals) target[key] = value; });
  const reads = [];
  const tx = {
    // An expired paid package also reads the FREE package: through the transaction too.
    user: { findUnique: async ({ where }) => { reads.push('user'); return { id: where.id, packageExpiresAt: new Date(Date.now() - 86_400_000), package: { code: 'STANDARD' } }; } },
    package: { findUnique: async () => { reads.push('package'); return { code: 'FREE' }; } },
    $executeRaw: async () => 1,
  };
  const found = await getUserPackage('u-tx', tx);
  assert.equal(found.package.code, 'FREE');
  assert.equal(found.expired, true);
  assert.equal((await commitAiCredit('u-tx', tx)).unlimited, true);
  assert.deepEqual(reads, ['user', 'package', 'user', 'package']);
});

// Integration review IR2-3 (2026-10-09): a save that failed while she was still there (the reservation gone
// after an admin quota reset, a pool timeout, a session deleted mid-answer) sent the raw code or Prisma's
// English text to the phone under a Georgian screen, and the answer's OK row stayed to count for weekly Medi.
test('a save that fails while she waits stores and charges nothing, and the phone reads our own copy', async () => {
  const { streamErrorEvent } = await import('../routes/ai.routes.js');
  const { AiEngineError } = await import('./evidencemd.js');
  const probe = {};
  assert.deepEqual(await saveWithCloseAt('never', { probe, reservationLost: true }),
    { outcome: 'AI_CREDIT_COMMIT_WITHOUT_RESERVATION', sessions: 0, commits: 0, releases: 0, reserved: 0 });
  const generic = { type: 'error', error: 'სამედიცინო ანალიზის სერვისთან დაკავშირება ვერ მოხერხდა.', status: 502 };
  assert.deepEqual(streamErrorEvent({ lang: 'ka' }, probe.error), generic);
  assert.deepEqual(streamErrorEvent({ lang: 'en' }, probe.error), { ...generic, error: 'We could not reach the medical analysis service.' });
  const poolTimeout = Object.assign(new Error('Transaction API error: Unable to start a transaction in the given time.'), { code: 'P2028' });
  assert.deepEqual(streamErrorEvent({ lang: 'ka' }, poolTimeout), generic);
  // Our own copy still reaches her, in her language and with its status — the keys every older build reads.
  const busy = new AiEngineError('AI დროებით გადატვირთულია. სცადე ერთი წუთის შემდეგ.', { status: 503, messageEn: 'The AI is busy right now. Please try again in a minute.' });
  assert.deepEqual(streamErrorEvent({ lang: 'ka' }, busy), { type: 'error', error: busy.message, status: 503 });
  assert.deepEqual(streamErrorEvent({ lang: 'en' }, busy), { type: 'error', error: busy.messageEn, status: 503 });
  const labelled = Object.assign(new Error('ჩანაწერი ვერ შეინახა.'), { messageEn: 'The entry was not saved.', status: 409 });
  assert.deepEqual(streamErrorEvent({ lang: 'en' }, labelled), { type: 'error', error: 'The entry was not saved.', status: 409 });
});

test('/api/ai/query takes back the row of any answer it did not save, streamed or not', () => {
  const src = readFileSync(new URL('../routes/ai.routes.js', import.meta.url), 'utf8');
  const start = src.indexOf('if (stream) {');
  const end = src.indexOf('\n      return;\n    }\n', start);
  const branch = src.slice(start, end);
  assert.match(branch, /catch \(error\) \{[\s\S]*?writeSse\(res, streamErrorEvent\(req, error\)\);\s*res\.end\(\);/);
  assert.doesNotMatch(branch, /error\?\.message\b/, 'no raw error text in the stream');
  const json = src.slice(end, src.indexOf('POST /api/ai/analyze-image'));
  assert.match(json, /try \{\s*turn = await persistChatTurn\(\{[^\n]*\}\);\s*\} catch \(error\) \{[\s\S]*?await forgetUnkeptAnswer\(req\.user\.id, answer\.interactionId\);\s*throw error;\s*\}/);
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
