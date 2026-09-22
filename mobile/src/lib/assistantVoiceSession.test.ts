import test from 'node:test';
import assert from 'node:assert/strict';
import { createVoiceCapture } from './assistantVoiceSession.ts';
import { assistantDialogIntent, spokenAssistantReview, assistantFieldError } from './assistantDialog.ts';

function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; }
function fixture(overrides: Record<string, unknown> = {}) {
  const events: string[] = []; let time = 0, active = true;
  const capture = createVoiceCapture({
    prepare: async () => { events.push('prepare'); }, record: () => { events.push('record'); },
    stop: async () => { events.push('stop'); return 'test.m4a'; },
    transcribe: async () => { events.push('transcribe'); return 'დავლიე 250 მლ წყალი'; },
    discard: async () => { events.push('discard'); }, active: () => active, now: () => time,
    onPhase: p => { events.push(p); }, onTranscript: t => { events.push('text:' + t); },
    onError: e => { events.push('error:' + e); }, onNotice: n => { events.push('notice:' + n); }, feedback: kind => { events.push('haptic:' + kind); },
    ...overrides,
  });
  return { capture, events, advance: (ms: number) => { time += ms; }, leave: () => { active = false; } };
}
test('hold, release: process once, after microphone cleanup', async () => {
  const f = fixture(); await f.capture.start(); f.advance(1800);
  await Promise.all([f.capture.release(), f.capture.release()]);
  assert.equal(f.events.filter(e => e === 'transcribe').length, 1);
  assert.equal(f.events.filter(e => e.startsWith('text:')).length, 1);
  assert.ok(f.events.indexOf('discard') < f.events.findIndex(e => e.startsWith('text:')));
  assert.equal(f.capture.phase, 'idle');
});
test('release while permission/prepare is pending never starts recording', async () => {
  const p = deferred<void>(), f = fixture({ prepare: () => p.promise });
  const starting = f.capture.start(); await f.capture.release(); p.resolve(); await starting;
  assert.ok(!f.events.includes('record')); assert.ok(!f.events.includes('transcribe'));
  assert.equal(f.capture.phase, 'idle');
});
test('permission failure cleans up, then another press can record', async () => {
  let attempts = 0; const f = fixture({ prepare: async () => { if (!attempts++) throw Error('denied'); } });
  await f.capture.start(); assert.ok(f.events.includes('error:denied')); assert.ok(f.events.includes('discard'));
  await f.capture.start(); assert.equal(f.capture.phase, 'recording'); await f.capture.cancel();
});
test('declining AI sharing is a notice and never starts or uploads a recording', async () => {
  const f = fixture({ prepare: async () => { throw Object.assign(new Error('Declined'), { code: 'AI_CONSENT_DECLINED' }); } });
  await f.capture.start(); await f.capture.release();
  assert.equal(f.capture.phase, 'idle');
  assert.ok(!f.events.includes('record')); assert.ok(!f.events.includes('transcribe'));
  assert.ok(!f.events.some(e => e.startsWith('error:') || e.startsWith('haptic:')));
  assert.ok(f.events.some(e => e.startsWith('notice:')));
});
test('cancellation during transcription drops the late result', async () => {
  const p = deferred<string>(), f = fixture({ transcribe: () => p.promise });
  await f.capture.start(); f.advance(1800); const done = f.capture.release();
  await Promise.resolve(); await f.capture.cancel(); p.resolve('კი'); await done;
  assert.ok(!f.events.some(e => e.startsWith('text:'))); assert.equal(f.capture.phase, 'idle');
});
test('cancel and owner/focus loss never submit audio', async () => {
  for (const leave of [false, true]) {
    const f = fixture(); await f.capture.start(); f.advance(1000);
    if (leave) { f.leave(); await f.capture.release(); } else await f.capture.cancel();
    assert.ok(!f.events.includes('transcribe')); assert.ok(!f.events.some(e => e.startsWith('text:')));
  }
});
test('accidental tap and digital silence do not send an action', async () => {
  const short = fixture(); await short.capture.start(); short.advance(100); await short.capture.release();
  assert.ok(!short.events.includes('transcribe'));
  const silent = fixture({ transcribe: async () => '' }); await silent.capture.start(); silent.advance(1000); await silent.capture.release();
  assert.ok(!silent.events.some(e => e.startsWith('text:')));
});
test('second press during preparation cannot create overlapping recorders', async () => {
  const p = deferred<void>(), f = fixture({ prepare: () => p.promise });
  const first = f.capture.start(); await f.capture.start(); p.resolve(); await first;
  assert.equal(f.events.filter(e => e === 'record').length, 1); await f.capture.cancel();
});
test('maximum duration submits once even if finger is still down', async () => {
  const done = deferred<void>(), f = fixture({ maxMs: 5, onTranscript: () => done.resolve() });
  await f.capture.start(); f.advance(60000); await done.promise; await f.capture.release();
  assert.equal(f.events.filter(e => e === 'transcribe').length, 1); assert.equal(f.capture.phase, 'idle');
});
test('Georgian confirmation is exact, qualified yes remains a correction', () => {
  for (const word of ['კი', 'დიახ!', 'კი შეინახე.', 'ვეთანხმები']) assert.equal(assistantDialogIntent(word), 'confirm');
  for (const word of ['არა', 'არ შეინახო', 'გააუქმე']) assert.equal(assistantDialogIntent(word), 'cancel');
  for (const word of ['კი, მაგრამ 200 მლ', 'არა 250 კი არა 200', 'დიახ 500', 'არ დაადასტურო ჯერ']) assert.equal(assistantDialogIntent(word), 'message');
});
test('spoken review includes exact validated values, and never truncates a dose', () => {
  const s = spokenAssistantReview('წყლის მიღება', [{ label: 'წყალი · მლ', value: '250' }, { label: 'თარიღი', value: '2026-09-21' }], false);
  assert.match(s, /250/); assert.match(s, /2026-09-21/); assert.match(s, /შევინახო/);
  assert.match(spokenAssistantReview('კონსილიუმი', [], true), /გავხსნა/);
  const long = spokenAssistantReview('შენიშვნა', [{ label: 'დეტალები', value: 'x'.repeat(1800) }], false);
  assert.match(long, /ეკრანზეა/); assert.ok(!long.includes('xxx'));
});

test('validation explains the next step in Georgian, without raw schema errors',()=>{
  const text=assistantFieldError('dosage','Invalid input: expected string, received undefined','შენი დოზა');
  assert.ok(text.includes('დანიშნული დოზა'));assert.ok(!text.includes('Invalid'));
  assert.equal(assistantFieldError('startDate','აირჩიე დაწყების დღე','დაწყება'),'დაწყება: აირჩიე დაწყების დღე');
});
