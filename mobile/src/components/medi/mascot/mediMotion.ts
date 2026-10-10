/**
 * Medi mascot motion (port of brand/medi-character/flat/motion.js + the transform logic of medi-traced.js).
 * Clips are pure functions time → partial pose, blended over NEUTRAL with eased cross-fades; on top run
 * blinks and wandering eyes. Everything here is a worklet: the mascot computes one frame per display
 * frame on the UI thread (useFrameCallback) and every SVG group only reads its own matrix from it.
 * No React, no DOM — the same code also runs on the JS thread for the static (reduced motion) pose.
 */

export type MascotMood =
  | 'idle' | 'hello' | 'laugh' | 'jump' | 'love' | 'think' | 'surprise' | 'sad'
  | 'sleep' | 'wink' | 'yes' | 'no' | 'cheer' | 'dance' | 'walk' | 'talk';

export const MASCOT_MOODS: MascotMood[] = ['idle', 'hello', 'laugh', 'jump', 'love', 'think', 'surprise', 'sad', 'sleep', 'wink', 'yes', 'no', 'cheer', 'dance', 'walk', 'talk'];

/** Clip lengths (s). Looping clips repeat; one-shot clips play once and hand over to the next mood. */
export const CLIP_LEN: Record<MascotMood, number> = {
  idle: 4, hello: 2.2, laugh: 1.6, jump: 1.4, love: 2.4, think: 3.6, surprise: 1.8, sad: 3.2,
  sleep: 4, wink: 1.8, yes: 1.4, no: 1.4, cheer: 0.9, dance: 1.6, walk: 0.9, talk: 3,
};

export const ONE_SHOT: Record<MascotMood, boolean> = {
  idle: false, hello: true, laugh: true, jump: true, love: false, think: false, surprise: true, sad: false,
  sleep: false, wink: true, yes: true, no: true, cheer: false, dance: false, walk: false, talk: false,
};

/** The moment of each clip that reads best as a still (reduced motion). */
const STILL_T: Record<MascotMood, number> = {
  idle: 0, hello: 0.9, laugh: 0.8, jump: 0.62, love: 1.2, think: 1.2, surprise: 0.6, sad: 1.2,
  sleep: 0, wink: 0.8, yes: 0, no: 0, cheer: 0.45, dance: 0, walk: 0, talk: 0.4,
};

/** One frame of Medi, flat (worklet-friendly). Units: motion units (× U = picture px), degrees, 0–1. */
export type Pose = {
  rx: number; ry: number; rsx: number; rsy: number; rrot: number;
  bodyRot: number;
  hrot: number; hx: number; hy: number; hsx: number; hsy: number;
  aLRot: number; aLFront: number; aRRot: number; aRFront: number;
  lLRot: number; lLLift: number; lRRot: number; lRLift: number;
  openL: number; openR: number; happyL: number; happyR: number; lookX: number; lookY: number; pupil: number; eheart: number;
  bY: number; bRotL: number; bRotR: number; worry: number;
  mW: number; mSmile: number; mOpen: number; mTongue: number; mO: number;
  blush: number; hScale: number; hGlow: number; shadow: number;
};
type Partial_ = { [K in keyof Pose]?: number };

export function neutralPose(): Pose {
  'worklet';
  return {
    rx: 0, ry: 0, rsx: 1, rsy: 1, rrot: 0,
    bodyRot: 0,
    hrot: 0, hx: 0, hy: 0, hsx: 1, hsy: 1,
    aLRot: 0, aLFront: 0, aRRot: 0, aRFront: 0,
    lLRot: 0, lLLift: 0, lRRot: 0, lRLift: 0,
    openL: 1, openR: 1, happyL: 0, happyR: 0, lookX: 0, lookY: 0, pupil: 1, eheart: 0,
    bY: 0, bRotL: 0, bRotR: 0, worry: 0,
    mW: 0.9, mSmile: 0.15, mOpen: 0.55, mTongue: 0.9, mO: 0,
    blush: 0, hScale: 1, hGlow: 0, shadow: 1,
  };
}

// ---------- easing helpers ----------
const TAU = Math.PI * 2;
function s(t: number, f = 1, ph = 0) { 'worklet'; return Math.sin(TAU * (t * f + ph)); }
function c01(x: number) { 'worklet'; return Math.min(1, Math.max(0, x)); }
function ease(x: number) { 'worklet'; const v = c01(x); return v * v * (3 - 2 * v); }
function outBack(x: number, k = 1.9) { 'worklet'; const v = c01(x), a = v - 1; return 1 + (k + 1) * a * a * a + k * a * a; }
function bump(t: number, a: number, b: number) { 'worklet'; return t < a || t > b ? 0 : Math.sin((Math.PI * (t - a)) / (b - a)); }
/** 0 → 1 between a and b with overshoot, then holds. */
function pop(t: number, a: number, b: number, k = 1.9) { 'worklet'; return t <= a ? 0 : outBack((t - a) / (b - a), k); }

/** A clip's partial pose at time t (s). */
export function clipPose(name: MascotMood, t: number): Partial_ {
  'worklet';
  switch (name) {
    case 'idle': {
      const b = s(t, 1 / 4);
      return { rsy: 1 + 0.012 * b, rsx: 1 - 0.008 * b, hrot: 2.5 * s(t, 1 / 4, 0.2), hy: -1.5 * b, aLRot: 4 * b, aRRot: 4 * b, bodyRot: 1.2 * s(t, 1 / 4, 0.1) };
    }
    case 'hello': {
      const up = pop(t, 0.05, 0.38, 2.2) * (1 - ease((t - 1.75) / 0.4)), wag = s(t, 2.6) * up, hop = bump(t, 0.02, 0.32);
      return {
        ry: -14 * hop, rsy: 1 - 0.08 * bump(t, 0, 0.1) + 0.05 * hop, rsx: 1 + 0.05 * bump(t, 0, 0.1),
        bodyRot: -4 * up, hrot: -8 * up + 2 * wag, aRRot: 104 * up + 8 * wag, aRFront: 2, aLRot: 6 * up,
        lookX: 0.35 * up, happyL: 0, happyR: 0, bY: 5 * up,
        mOpen: 0.55 + 0.25 * up, mSmile: 0.5 + 0.5 * up, mW: 1 + 0.15 * up, blush: 0.5 * up,
      };
    }
    case 'laugh': {
      const k = pop(t, 0, 0.18) * (1 - ease((t - 1.35) / 0.25)), shake = s(t, 6) * k;
      return {
        ry: -4 * Math.abs(shake), rsy: 1 + 0.04 * shake, rsx: 1 - 0.03 * shake, hrot: -6 * k + 3 * shake, hy: -2 * Math.abs(shake),
        bodyRot: 2 * shake, aLRot: 22 * k + 6 * shake, aRRot: 22 * k - 6 * shake,
        openL: 1 - k, openR: 1 - k, happyL: 1, happyR: 1, bY: 6 * k,
        mOpen: 0.55 + 0.45 * k + 0.12 * Math.abs(shake), mSmile: 0.4 + 0.6 * k, mW: 1 + 0.25 * k, blush: k,
      };
    }
    case 'jump': {
      const p = t / 1.4;
      const crouch = bump(p, 0, 0.26), air = bump(p, 0.22, 0.66), land = bump(p, 0.62, 0.82), rec = bump(p, 0.78, 1);
      const sy = 1 - 0.13 * crouch + 0.12 * bump(p, 0.2, 0.36) - 0.12 * land + 0.04 * rec;
      const arms = c01(air * 1.3);
      return {
        ry: -95 * Math.pow(air, 1.1), rsy: sy, rsx: 2 - sy - 0.1 * (sy - 1),
        hy: 6 * crouch - 4 * air, hrot: 4 * s(p, 1), lLLift: 10 * air, lLRot: 14 * air, lRLift: 10 * air, lRRot: -14 * air,
        aLRot: 96 * arms - 20 * crouch, aLFront: 2, aRRot: 96 * arms - 20 * crouch, aRFront: 2,
        openL: 1 - air, openR: 1 - air, happyL: 1, happyR: 1, lookY: 0.4 * crouch,
        mOpen: 0.3 + 0.7 * air, mSmile: 0.6 + 0.4 * air, mW: 1 + 0.2 * air, bY: 7 * air, shadow: 1 - 0.4 * air, blush: 0.6 * air,
      };
    }
    case 'love': {
      const k = pop(t, 0, 0.3), beat = Math.pow(Math.max(0, s(t, 2.5)), 6), sway = s(t, 1 / 2.4);
      return {
        rsy: 1 + 0.015 * beat, bodyRot: 3 * sway, hrot: -8 * sway * k, hy: -2 * beat,
        aLRot: -30 * k, aLFront: 1, aRRot: -30 * k, aRFront: 1,
        eheart: k, pupil: 1 + 0.1 * beat, hScale: 1 + 0.22 * beat * k, hGlow: k * (0.4 + 0.6 * beat),
        mOpen: 0.35, mSmile: 1, mW: 0.9, blush: k, bY: 3 * k,
      };
    }
    case 'think': {
      const k = pop(t, 0, 0.35, 1.4), tap = Math.max(0, s(t, 2.2)) * k;
      return {
        hrot: 10 * k + 2 * s(t, 1 / 3.6), hy: -2 * k, bodyRot: -2 * k, aRRot: 90 * k + 5 * tap, aRFront: 2,
        lookX: -0.55 * k, lookY: -0.7 * k, bY: 4 * k, bRotL: -10 * k, bRotR: 12 * k,
        mOpen: 0.08, mSmile: -0.2 * k, mW: 0.65,
      };
    }
    case 'surprise': {
      const k = pop(t, 0.12, 0.3, 2.6) * (1 - ease((t - 1.45) / 0.3)), ant = bump(t, 0, 0.14);
      return {
        ry: -18 * bump(t, 0.12, 0.42), rsy: 1 - 0.1 * ant + 0.12 * bump(t, 0.12, 0.3), hy: -6 * k, hrot: -3 * k,
        aLRot: 55 * k, aRRot: 55 * k, pupil: 1 - 0.45 * k, openL: 1 + 0.1 * k, openR: 1 + 0.1 * k,
        bY: 12 * k, mO: k, mOpen: 0.2 * (1 - k), mSmile: 0,
      };
    }
    case 'sad': {
      const k = ease(t / 0.5), sigh = bump(t / 3.2, 0.45, 0.8);
      return {
        rsy: 1 - 0.04 * k - 0.02 * sigh, hy: 6 * k + 2 * sigh, hrot: 5 * k, bodyRot: 2 * k, aLRot: -10 * k, aRRot: -10 * k,
        lookY: 0.45 * k, openL: 1 - 0.25 * k, openR: 1 - 0.25 * k, worry: k, bY: 2 * k,
        mSmile: -1 * k, mOpen: 0.06, mW: 0.7,
      };
    }
    case 'sleep': {
      const b = s(t, 1 / 4), nod = bump(t / 4, 0.55, 0.75);
      return {
        rsy: 1 + 0.03 * b, rsx: 1 - 0.015 * b, hrot: 9 + 3 * b + 6 * nod, hy: 4 + 2 * nod, bodyRot: 2, aLRot: -6, aRRot: -6,
        openL: 0, openR: 0, happyL: 0, happyR: 0, bY: -2, mO: 0.35 + (0.25 * (b + 1)) / 2, mOpen: 0, mSmile: 0,
      };
    }
    case 'wink': {
      const k = pop(t, 0.05, 0.3, 2) * (1 - ease((t - 1.4) / 0.3));
      return {
        hrot: -10 * k, bodyRot: -3 * k, aRRot: 70 * k, aRFront: 1, openR: 1 - k, happyR: 1, lookX: 0.3 * k,
        bRotR: -12 * k, bY: 3 * k, mOpen: 0.3 + 0.2 * k, mSmile: 0.6 + 0.4 * k, mW: 0.9, blush: 0.6 * k,
      };
    }
    case 'yes': {
      const n = s(t, 2.2) * (1 - ease((t - 1.05) / 0.35));
      return { hrot: 0, hy: 6 * Math.max(0, n), hsy: 1 - 0.03 * Math.max(0, n), rsy: 1 - 0.02 * Math.abs(n), lookY: 0.25 * n, mOpen: 0.45, mSmile: 0.8, bY: 3 };
    }
    case 'no': {
      const n = s(t, 2.4) * (1 - ease((t - 1.05) / 0.35));
      return { hrot: 9 * n, hx: 7 * n, bodyRot: -2 * n, lookX: -0.4 * n, worry: 0.4, mOpen: 0.1, mSmile: -0.4, mW: 0.8 };
    }
    case 'cheer': {
      const h = Math.abs(s(t, 1 / 0.9)), pump = s(t, 2 / 0.9);
      return {
        ry: -26 * h, rsy: 1 + 0.08 * (h - 0.5), rsx: 1 - 0.06 * (h - 0.5), hrot: 4 * s(t, 1 / 0.9),
        aLRot: 98 + 12 * pump, aLFront: 2, aRRot: 98 - 12 * pump, aRFront: 2, lLLift: 6 * h, lRLift: 6 * h,
        openL: 0, openR: 0, happyL: 1, happyR: 1, mOpen: 1, mSmile: 1, mW: 1.2, bY: 7, blush: 0.8, shadow: 1 - 0.3 * h,
      };
    }
    case 'dance': {
      const beat = s(t, 1 / 1.6), half = Math.abs(s(t, 2 / 1.6));
      return {
        rx: 10 * beat, ry: -10 * half, rrot: 5 * beat, rsy: 1 + 0.06 * (half - 0.5), rsx: 1 - 0.05 * (half - 0.5),
        hrot: -9 * beat, hy: -3 * half, bodyRot: -3 * beat,
        aLRot: 45 + 45 * beat, aLFront: 2, aRRot: 45 - 45 * beat, aRFront: 2,
        lLLift: 12 * Math.max(0, beat), lLRot: -10 * Math.max(0, beat), lRLift: 12 * Math.max(0, -beat), lRRot: 10 * Math.max(0, -beat),
        openL: 0, openR: 0, happyL: 1, happyR: 1, mOpen: 0.75, mSmile: 1, blush: 0.5, bY: 5,
      };
    }
    case 'walk': {
      const st = s(t, 1 / 0.9), h = Math.abs(s(t, 1 / 0.9, 0.25));
      return {
        ry: -7 * h, rrot: 4 * st, rsy: 1 + 0.03 * (h - 0.5), hrot: -3 * st, bodyRot: -2 * st,
        lLLift: 10 * Math.max(0, st), lLRot: 8 * st, lRLift: 10 * Math.max(0, -st), lRRot: 8 * st,
        aLRot: 10 + 22 * st, aRRot: 10 - 22 * st, mOpen: 0.45, mSmile: 0.6,
      };
    }
    case 'talk': {
      // syllables: a few overlapping waves → irregular, speech-like mouth
      const syl = c01(0.55 + 0.45 * (s(t, 3.1) * 0.6 + s(t, 4.7, 0.3) * 0.4)) * (0.6 + 0.4 * c01(s(t, 0.7) + 0.6));
      const gest = s(t, 1 / 3);
      return {
        hrot: 4 * s(t, 0.8), hy: -2 * syl, bodyRot: 1.5 * gest, aRRot: 30 + 20 * Math.max(0, gest), aRFront: 1, aLRot: 8,
        lookX: 0.15 * s(t, 0.35), bY: 3 * syl,
        mOpen: 0.15 + 0.6 * syl, mSmile: 0.45, mW: 0.85 + 0.15 * syl, mO: 0.25 * Math.max(0, s(t, 2.3)),
      };
    }
    default:
      return {};
  }
}

function blendInto(out: Pose, part: Partial_, w: number) {
  'worklet';
  const o = out as unknown as Record<string, number>;
  const keys = Object.keys(part);
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    const v = (part as Record<string, number>)[k];
    if (k === 'aLFront' || k === 'aRFront') { if (w > 0.5) o[k] = v; continue; }
    o[k] = o[k] + (v - o[k]) * w;
  }
}

/** A still frame of a mood: no blinks, no wandering — used when the OS asks for reduced motion. */
export function stillPose(mood: MascotMood): Pose {
  'worklet';
  const pose = neutralPose();
  blendInto(pose, clipPose(mood, STILL_T[mood] ?? 0), 1);
  return pose;
}

// ---------- animator (UI-thread state) ----------
type Layer = { name: MascotMood; t: number; w: number; fade: number; once: boolean; then: MascotMood };
export type AnimState = {
  layers: Layer[]; time: number;
  blinkAt: number; blinkStart: number; lookT: number; lookX: number; lookY: number; lookTx: number; lookTy: number;
  key: number;
};
/** What the JS side asks for; a new `key` starts `mood` (one-shot moods then hand over to `then`). */
export type MascotRequest = { mood: MascotMood; then: MascotMood; key: number };

export function createAnimState(): AnimState {
  'worklet';
  return { layers: [], time: 0, blinkAt: 1.2, blinkStart: -9, lookT: 0, lookX: 0, lookY: 0, lookTx: 0, lookTy: 0, key: -1 };
}

function play(S: AnimState, name: MascotMood, then: MascotMood, fade = 0.28) {
  'worklet';
  const top = S.layers.length ? S.layers[S.layers.length - 1] : null;
  if (top && top.name === name && !ONE_SHOT[name]) return;
  S.layers.push({ name, t: 0, w: S.layers.length ? 0 : 1, fade, once: ONE_SHOT[name], then });
  if (S.layers.length > 3) S.layers.splice(0, S.layers.length - 3);
}

/** Advance the animator by dt seconds and return the blended pose. Mutates S. */
export function stepAnim(S: AnimState, req: MascotRequest, dt: number): Pose {
  'worklet';
  if (req.key !== S.key) { S.key = req.key; play(S, req.mood, req.then); }
  S.time += dt;
  let top = S.layers[S.layers.length - 1];
  // a one-shot clip that finished hands over to the next mood
  if (top && top.once && top.t >= CLIP_LEN[top.name]) { play(S, top.then, top.then); top = S.layers[S.layers.length - 1]; }
  for (let i = 0; i < S.layers.length; i++) {
    const L = S.layers[i];
    L.t += dt;
    if (L === top) L.w = L.fade ? Math.min(1, L.w + dt / L.fade) : 1;
  }
  if (top && top.w >= 1 && S.layers.length > 1) S.layers = [top];
  const pose = neutralPose();
  for (let i = 0; i < S.layers.length; i++) {
    const L = S.layers[i];
    const len = CLIP_LEN[L.name];
    const t = L.once ? Math.min(L.t, len - 0.001) : L.t % len;
    blendInto(pose, clipPose(L.name, t), i === 0 ? 1 : ease(L.w));
  }
  // blinks (a shut eye stays shut)
  if (S.time > S.blinkAt) {
    S.blinkStart = S.time;
    S.blinkAt = S.time + 2 + Math.random() * 3.5 + (Math.random() < 0.2 ? 0.22 : 0);
  }
  const bk = bump(S.time - S.blinkStart, 0, 0.16);
  pose.openL = Math.min(pose.openL, 1 - bk);
  pose.openR = Math.min(pose.openR, 1 - bk);
  // the eyes wander a little when the clip does not aim them
  S.lookT -= dt;
  if (S.lookT <= 0) { S.lookT = 1 + Math.random() * 2.5; S.lookTx = (Math.random() - 0.5) * 0.5; S.lookTy = (Math.random() - 0.5) * 0.3; }
  const f = 1 - Math.exp(-dt * 10);
  S.lookX += (S.lookTx - S.lookX) * f;
  S.lookY += (S.lookTy - S.lookY) * f;
  if (Math.abs(pose.lookX) < 0.05) pose.lookX += S.lookX;
  if (Math.abs(pose.lookY) < 0.05) pose.lookY += S.lookY;
  return pose;
}

/**
 * View boxes in picture px. `snug` hugs the figure for small placements (every mood but jump, surprise and
 * cheer stays inside it, tilts and the hello wave included); `full` has room for the jump. Guarded by
 * mediMotion.test.ts — widen them there if a clip grows.
 */
export const MASCOT_CROPS = {
  full: { x: -120, y: -520, w: 2288, h: 2590 },
  snug: { x: 180, y: -40, w: 1688, h: 2080 },
} as const;

// ---------- pose → SVG frame (picture pixels, 2048 × 2048) ----------
export const U = 5.8; // motion units → picture px
const GROUND = [1024, 1982], NECK = [1024, 1330], HIPS = [1024, 1760], HEART = [1024, 1585], MOUTH = [1024, 1080];
const SHOULDER_L = [796, 1405], SHOULDER_R = [1252, 1405], HIP_L = [850, 1690], HIP_R = [1198, 1690];
export const EYE_L = [700, 930], EYE_R = [1350, 930];
const BROW_L = [700, 662], BROW_R = [1350, 662];

/** SVG affine matrix [a, b, c, d, e, f]. */
export type M6 = [number, number, number, number, number, number];
function mul(A: M6, B: M6): M6 {
  'worklet';
  return [
    A[0] * B[0] + A[2] * B[1], A[1] * B[0] + A[3] * B[1],
    A[0] * B[2] + A[2] * B[3], A[1] * B[2] + A[3] * B[3],
    A[0] * B[4] + A[2] * B[5] + A[4], A[1] * B[4] + A[3] * B[5] + A[5],
  ];
}
function T(x: number, y: number): M6 { 'worklet'; return [1, 0, 0, 1, x, y]; }
/** rotate(deg) then scale(sx, sy) about point p — like SVG `translate(p) rotate scale translate(-p)`. */
function about(p: number[], deg: number, sx = 1, sy = 1): M6 {
  'worklet';
  const r = (deg * Math.PI) / 180, c = Math.cos(r), n = Math.sin(r);
  const RS: M6 = [c * sx, n * sx, -n * sy, c * sy, 0, 0];
  return mul(mul(T(p[0], p[1]), RS), T(-p[0], -p[1]));
}

export type MascotFrame = {
  shadowM: M6; shadowO: number; rootM: M6; bodyM: M6; legLM: M6; legRM: M6;
  armLM: M6; armRM: M6; armLLayer: number; armRLayer: number;
  heartM: M6; glowO: number; headM: M6; blushO: number;
  eyeLM: M6; eyeRM: M6; eyeLO: number; eyeRO: number; shutLD: string; shutRD: string; shutLO: number; shutRO: number;
  browLM: M6; browRM: M6; mouthD: string; tongueD: string; tongueO: number; lineD: string;
};

const r1 = (v: number) => { 'worklet'; return Math.round(v * 10) / 10; };
const EMPTY = 'M0,0';

export function poseToFrame(p: Pose): MascotFrame {
  'worklet';
  const lift = -p.ry * U;
  const shadowK = Math.max(0.5, 1 - lift / 1400) * p.shadow;
  const shadowM = mul(T(p.rx * U, 0), about(GROUND, 0, shadowK, 1));
  const rootM = mul(T(p.rx * U, p.ry * U), about(GROUND, p.rrot, p.rsx, p.rsy));
  const lean = about(HIPS, p.bodyRot);
  const legLM = mul(T(0, -p.lLLift * U), about(HIP_L, p.lLRot));
  const legRM = mul(T(0, -p.lRLift * U), about(HIP_R, -p.lRRot));
  const armLM = mul(lean, about(SHOULDER_L, p.aLRot));
  const armRM = mul(lean, about(SHOULDER_R, -p.aRRot));
  const layer = (front: number) => { 'worklet'; return front >= 1.5 ? 2 : front >= 0.5 ? 1 : 0; };
  // Squash and stretch mostly in the body: the head keeps ~35 % of it, so the face never flattens.
  const keep = 0.35, csx = Math.pow(1 / p.rsx, 1 - keep), csy = Math.pow(1 / p.rsy, 1 - keep);
  const headM = mul(mul(lean, T(p.hx * U, p.hy * U)), about(NECK, p.hrot, p.hsx * csx, p.hsy * csy));

  // eyes: blink squashes the drawn eye; shut eyes become a line (‿ sleepy, ^ happy). Heart eyes = happy shut.
  const eye = (cx: number, cy: number, openRaw: number, happyRaw: number) => {
    'worklet';
    const open = Math.min(openRaw, 1 - p.eheart), happy = Math.max(happyRaw, p.eheart);
    const sy = Math.max(0.04, Math.min(1.12, open));
    const m = mul(T(p.lookX * 26, p.lookY * 22), about([cx, cy + 40], 0, 1 + 0.06 * (1 - p.pupil), sy));
    const bend = -70 + 140 * happy;
    const d = `M${r1(cx - 120)},${r1(cy + 20 - bend * 0.15)} Q${cx},${r1(cy + 20 + bend)} ${r1(cx + 120)},${r1(cy + 20 - bend * 0.15)}`;
    return { m, o: open < 0.16 ? 0 : 1, d, so: open < 0.16 ? 1 : 0 };
  };
  const eL = eye(EYE_L[0], EYE_L[1], p.openL, p.happyL), eR = eye(EYE_R[0], EYE_R[1], p.openR, p.happyR);
  const brow = (pt: number[], side: number, rot: number) => {
    'worklet';
    return mul(T(0, -p.bY * U), about(pt, rot * side + p.worry * side * 14));
  };

  // mouth: the picture's D shape, parametric (width, smile, open, round o); the tongue is cut from its
  // lower half (no clip path: the bottom curve is split exactly, the top is a soft hump).
  const w = 112 * p.mW * (1 - 0.45 * p.mO), up = 34 * p.mSmile, depth = 190 * p.mOpen + 120 * p.mO;
  const mx = MOUTH[0], my = MOUTH[1];
  let mouthD = EMPTY, tongueD = EMPTY, lineD = EMPTY;
  if (depth < 16) {
    lineD = `M${r1(mx - w)},${r1(my - up)} Q${mx},${r1(my + up * 1.4 + 10)} ${r1(mx + w)},${r1(my - up)}`;
  } else {
    const top = my - up + (p.mO > 0.5 ? -depth * 0.35 : 22 - up * 0.3);
    mouthD = `M${r1(mx - w)},${r1(my - up)} Q${mx},${r1(top)} ${r1(mx + w)},${r1(my - up)} C${r1(mx + w * 1.02)},${r1(my + depth * 0.55)} ${r1(mx + w * 0.62)},${r1(my + depth)} ${mx},${r1(my + depth)} C${r1(mx - w * 0.62)},${r1(my + depth)} ${r1(mx - w * 1.02)},${r1(my + depth * 0.55)} ${r1(mx - w)},${r1(my - up)} Z`;
    // right lower cubic P0..P3, split at u (de Casteljau): S = point, then S R1 Q2 P3 is the rest
    const u = 0.5;
    const P0x = mx + w, P0y = my - up, P1x = mx + w * 1.02, P1y = my + depth * 0.55, P2x = mx + w * 0.62, P2y = my + depth, P3x = mx, P3y = my + depth;
    const Q0x = P0x + (P1x - P0x) * u, Q0y = P0y + (P1y - P0y) * u, Q1x = P1x + (P2x - P1x) * u, Q1y = P1y + (P2y - P1y) * u;
    const Q2x = P2x + (P3x - P2x) * u, Q2y = P2y + (P3y - P2y) * u;
    const R0x = Q0x + (Q1x - Q0x) * u, R0y = Q0y + (Q1y - Q0y) * u, R1x = Q1x + (Q2x - Q1x) * u, R1y = Q1y + (Q2y - Q1y) * u;
    const Sx = R0x + (R1x - R0x) * u, Sy = R0y + (R1y - R0y) * u;
    const L = (x: number) => { 'worklet'; return r1(2 * mx - x); };
    tongueD = `M${L(Sx)},${r1(Sy)} Q${mx},${r1(my + depth * 0.42)} ${r1(Sx)},${r1(Sy)} C${r1(R1x)},${r1(R1y)} ${r1(Q2x)},${r1(Q2y)} ${P3x},${r1(P3y)} C${L(Q2x)},${r1(Q2y)} ${L(R1x)},${r1(R1y)} ${L(Sx)},${r1(Sy)} Z`;
  }

  return {
    shadowM, shadowO: Math.max(0.35, 1 - lift / 900), rootM, bodyM: lean, legLM, legRM,
    armLM, armRM, armLLayer: layer(p.aLFront), armRLayer: layer(p.aRFront),
    heartM: about(HEART, 0, p.hScale, p.hScale), glowO: p.hGlow, headM, blushO: p.blush * 0.6,
    eyeLM: eL.m, eyeRM: eR.m, eyeLO: eL.o, eyeRO: eR.o, shutLD: eL.d, shutRD: eR.d, shutLO: eL.so, shutRO: eR.so,
    browLM: brow(BROW_L, -1, p.bRotL), browRM: brow(BROW_R, 1, p.bRotR),
    mouthD, tongueD, tongueO: depth < 16 ? 0 : p.mTongue, lineD,
  };
}
