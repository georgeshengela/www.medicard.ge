/**
 * Velvet colours, depth and shadows, with no imports, so Node scripts (scripts/generate-launch-art.mjs) and
 * tests read the very values the app uses. The app imports these through `@/theme/velvet`.
 *
 * Depth (owner 2026-10-17: „ძალიან მომწონს, მაგრამ … ძალიან განსხვავებულია აპის დანარჩენ ელემენტებთან“ →
 * lighter velvet): `full` is the original welcome material, `soft` keeps its colours with gentler light and
 * shade, `calm` moves the page towards the app's own canvas with only a breath of depth. `depth` scales every
 * velvet shadow (the helpers at the end of this file).
 */
export type VelvetPalette = {
  /** The page, and every pressed surface on it. */
  surface: string;
  /** Raised objects (buttons, cards, knobs, the disc): the page colour itself in full/soft velvet, a card colour in calm. */
  raised: string;
  /** Light falling from the top-left. */
  light: string;
  /** Shade to the bottom-right. */
  shade: string;
  /** Selected options, links. */
  ink: string;
  /** Body copy. */
  ink2: string;
  /** Options that are not selected, placeholders, resting icons. */
  inkOff: string;
  /** What a person types into a field. */
  text: string;
  /** Inside a text field: a touch lighter than the page, like the app's own fields. */
  field: string;
  danger: string;
  sun: string;
  moon: string;
  /** The heartbeat signal and its ripple. */
  pulse: string;
  wordmark: string;
  /** Lit corner of a big raised disc. */
  discTop: string;
  /** Coloured shade under the teal button. */
  ctaShade: string;
  /** Scale of every velvet shadow (offsets and blur): 1 = the original material. */
  depth: number;
};

export type VelvetDepth = 'full' | 'soft' | 'calm';

const FULL: Record<'light' | 'dark', VelvetPalette> = {
  light: {
    surface: '#E6EFED',
    raised: '#E6EFED',
    light: '#FFFFFF',
    shade: '#BCCDC9',
    ink: '#0B4F49',
    ink2: '#4F6866',
    inkOff: '#7D9491',
    text: '#0F2A28',
    field: '#F3F8F7',
    danger: '#C62B3F',
    sun: '#F29B48',
    moon: '#A3B8B4',
    pulse: '#14B8A6',
    wordmark: '#2A6A64',
    discTop: '#FFFFFF',
    ctaShade: 'rgba(13, 148, 136, 0.32)',
    depth: 1,
  },
  dark: {
    surface: '#132A34',
    raised: '#132A34',
    light: '#1D3D4A',
    shade: '#07161C',
    ink: '#99F6E4',
    ink2: '#A6BBC2',
    inkOff: '#7895A0',
    text: '#EAF6F4',
    field: '#18343F',
    danger: '#FB7185',
    sun: '#5F7F8B',
    moon: '#FFFFFF',
    pulse: '#5EEAD4',
    wordmark: '#D5F6F0',
    discTop: '#1A3743',
    ctaShade: 'rgba(0, 0, 0, 0.5)',
    depth: 1,
  },
};

const DEPTHS: Record<VelvetDepth, Record<'light' | 'dark', Partial<VelvetPalette>>> = {
  full: { light: {}, dark: {} },
  soft: {
    light: { shade: '#CBD9D6', ctaShade: 'rgba(13, 148, 136, 0.22)', depth: 0.55 },
    dark: { light: '#1A3743', shade: '#0B1E26', discTop: '#183441', ctaShade: 'rgba(0, 0, 0, 0.38)', depth: 0.55 },
  },
  calm: {
    light: { surface: '#EEF3F2', raised: '#FFFFFF', shade: '#D3DEDC', field: '#FFFFFF', moon: '#A9BAB7', ctaShade: 'rgba(13, 148, 136, 0.18)', depth: 0.38 },
    dark: {
      surface: '#0D1B23',
      raised: '#15252F',
      light: '#1B2F3A',
      shade: '#050D12',
      field: '#12232D',
      discTop: '#142832',
      sun: '#557380',
      ctaShade: 'rgba(0, 0, 0, 0.32)',
      depth: 0.38,
    },
  },
};

export function velvetPalettes(depth: VelvetDepth): Record<'light' | 'dark', VelvetPalette> {
  return {
    light: { ...FULL.light, ...DEPTHS[depth].light },
    dark: { ...FULL.dark, ...DEPTHS[depth].dark },
  };
}

/** The depth the app ships with (owner 2026-10-17 picked „მშვიდი“ from the three-level board). */
export const VELVET_DEPTH: VelvetDepth = 'calm';

/** Dev web QA only: `?velvet=soft|calm|full` previews another depth (never in production builds). */
function activeDepth(): VelvetDepth {
  const g = globalThis as { __DEV__?: boolean; location?: { search?: string } };
  if (g.__DEV__ !== true) return VELVET_DEPTH;
  const search = g.location?.search ?? '';
  const m = /[?&]velvet=(full|soft|calm)\b/.exec(search);
  return m ? (m[1] as VelvetDepth) : VELVET_DEPTH;
}

export const VELVET: Record<'light' | 'dark', VelvetPalette> = velvetPalettes(activeDepth());

/** One shadow, its offsets and blur scaled by the palette's depth (never below half a point when set). */
function sh(p: VelvetPalette, x: number, y: number, blur: number, color: string, inset = false): string {
  const k = (n: number) => (n === 0 ? 0 : Math.sign(n) * Math.max(0.5, Math.round(Math.abs(n) * p.depth * 2) / 2));
  return `${inset ? 'inset ' : ''}${k(x)}px ${k(y)}px ${k(blur)}px ${color}`;
}

/** A track pressed into the surface (the CodePen toggle's four shadows). */
export const velvetTrack = (p: VelvetPalette) =>
  [sh(p, -3, -3, 3, p.light), sh(p, 3, 3, 3, p.shade), sh(p, 2, 2, 3, p.shade, true), sh(p, 2, 2, 20, p.shade, true)].join(', ');

/** A knob or thumb resting in a track. */
export const velvetKnob = (p: VelvetPalette) => [sh(p, 2, 2, 2, p.light, true), sh(p, 5, 6, 6, p.shade)].join(', ');

/** A big raised disc. */
export const velvetRaised = (p: VelvetPalette) => [sh(p, 18, 18, 36, p.shade), sh(p, -14, -14, 30, p.light)].join(', ');

/** A text field: barely pressed into the page (light on purpose — see the note above). */
export const velvetField = (p: VelvetPalette) => [sh(p, 1, 1, 3, p.shade, true), sh(p, -1, -1, 2, p.light, true)].join(', ');

/** A button-sized object resting lightly on the page. */
export const velvetLift = (p: VelvetPalette) => [sh(p, -2, -2, 6, p.light), sh(p, 3, 4, 10, p.shade)].join(', ');

/** A small pill (onboarding choices) resting on the page. */
export const velvetPill = (p: VelvetPalette) => [sh(p, -2, -2, 5, p.light), sh(p, 2, 3, 7, p.shade)].join(', ');

/** The lit teal button: light above, its own coloured shade below. */
export const velvetCta = (p: VelvetPalette) => [sh(p, -4, -4, 10, p.light), sh(p, 6, 9, 18, p.ctaShade)].join(', ');

/** A raised card (the invite ticket). */
export const velvetCard = (p: VelvetPalette) => [sh(p, 10, 12, 24, p.shade), sh(p, -8, -8, 18, p.light)].join(', ');

/** A shallow well pressed into a raised surface. */
export const velvetWell = (p: VelvetPalette) => [sh(p, 8, 8, 16, p.shade, true), sh(p, -8, -8, 16, p.light, true)].join(', ');
