import assert from 'node:assert/strict';
import test from 'node:test';
import { MEDI_ART } from './mediMascotArt.ts';
import { CLIP_LEN, MASCOT_CROPS, MASCOT_MOODS, ONE_SHOT, createAnimState, poseToFrame, stepAnim, stillPose, type MascotMood } from './mediMotion.ts';

const finite = (frame: Record<string, unknown>, where: string) => {
  for (const [k, v] of Object.entries(frame)) {
    const values = Array.isArray(v) ? v : typeof v === 'number' ? [v] : [];
    for (const n of values) assert.ok(Number.isFinite(n), `${where}: ${k} = ${n}`);
    if (typeof v === 'string') assert.ok(!/NaN|Infinity|undefined/.test(v), `${where}: ${k} = ${v}`);
  }
};

test('every mood animates to finite frames for two loops', () => {
  for (const mood of MASCOT_MOODS) {
    const S = createAnimState();
    for (let t = 0; t < CLIP_LEN[mood] * 2; t += 1 / 60) finite(poseToFrame(stepAnim(S, { mood, then: 'idle', key: 1 }, 1 / 60)), `${mood}@${t.toFixed(2)}`);
    finite(poseToFrame(stillPose(mood)), `${mood} still`);
  }
});

test('a one-shot mood hands over to its `then` mood', () => {
  const S = createAnimState();
  const req = { mood: 'hello' as MascotMood, then: 'think' as MascotMood, key: 1 };
  for (let t = 0; t < CLIP_LEN.hello + 1; t += 1 / 60) stepAnim(S, req, 1 / 60);
  assert.equal(S.layers.at(-1)?.name, 'think');
  assert.equal(S.layers.length, 1);
});

test('a new key replays the same one-shot mood', () => {
  const S = createAnimState();
  for (let i = 0; i < 200; i++) stepAnim(S, { mood: 'cheer', then: 'idle', key: 1 }, 1 / 60);
  stepAnim(S, { mood: 'jump', then: 'idle', key: 2 }, 1 / 60);
  assert.equal(S.layers.at(-1)?.name, 'jump');
  assert.ok(ONE_SHOT.jump);
});

test('sleep keeps the eyes shut as ‿ arcs, idle keeps them open', () => {
  const sleep = poseToFrame(stillPose('sleep'));
  assert.equal(sleep.eyeLO, 0);
  assert.equal(sleep.shutLO, 1);
  const idle = poseToFrame(stillPose('idle'));
  assert.equal(idle.eyeLO, 1);
  assert.equal(idle.shutLO, 0);
});

test('every mood stays inside its crop (snug for small placements, full for the jump)', () => {
  const pts = (list: { d?: string }[]) => list.flatMap((e) => (e.d ? [...e.d.matchAll(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g)].map((m) => [+m[1], +m[2]]) : []));
  const mul = (A: number[], B: number[]) => [A[0] * B[0] + A[2] * B[1], A[1] * B[0] + A[3] * B[1], A[0] * B[2] + A[2] * B[3], A[1] * B[2] + A[3] * B[3], A[0] * B[4] + A[2] * B[5] + A[4], A[1] * B[4] + A[3] * B[5] + A[5]];
  const parts = { head: pts(MEDI_ART.head), armL: pts(MEDI_ART.armL), armR: pts(MEDI_ART.armR), legL: pts(MEDI_ART.legL), legR: pts(MEDI_ART.legR), body: pts(MEDI_ART.body) };
  const fullOnly = new Set<MascotMood>(['jump', 'surprise', 'cheer']);
  for (const mood of MASCOT_MOODS) {
    const crop = fullOnly.has(mood) ? MASCOT_CROPS.full : MASCOT_CROPS.snug;
    const S = createAnimState();
    for (let t = 0; t < CLIP_LEN[mood] * 2; t += 1 / 60) {
      const f = poseToFrame(stepAnim(S, { mood, then: 'idle', key: 1 }, 1 / 60));
      const sets: [number[], number[][]][] = [[f.headM, parts.head], [f.armLM, parts.armL], [f.armRM, parts.armR], [f.legLM, parts.legL], [f.legRM, parts.legR], [f.bodyM, parts.body]];
      for (const [local, list] of sets) {
        const m = mul(f.rootM, local);
        for (const [x, y] of list) {
          const px = m[0] * x + m[2] * y + m[4], py = m[1] * x + m[3] * y + m[5];
          assert.ok(px >= crop.x && px <= crop.x + crop.w && py >= crop.y && py <= crop.y + crop.h, `${mood} @${t.toFixed(2)}s: ${Math.round(px)},${Math.round(py)} outside`);
        }
      }
    }
  }
});
