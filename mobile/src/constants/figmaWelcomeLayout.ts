/** Figma Welcome Screen layout (375×812 reference frames). */
export const FIGMA_FRAME = { width: 375, height: 812 } as const;

/** iOS status bar + fake clock/battery strip baked into Figma exports — never show. */
export const FIGMA_STATUS_BAR = 47;

/** Progress row in Figma export (we render our own). */
export const FIGMA_PROGRESS_ROW = 20;

/** Carousel hero illustration band (below status + progress, above white sheet). */
export const FIGMA_HERO_TOP = FIGMA_STATUS_BAR + FIGMA_PROGRESS_ROW;
export const FIGMA_SHEET_TOP = 478;
export const FIGMA_SHEET_HEIGHT = FIGMA_FRAME.height - FIGMA_SHEET_TOP;
export const FIGMA_HERO_BAND = FIGMA_SHEET_TOP - FIGMA_HERO_TOP;

export const FIGMA_SHEET_RATIO = FIGMA_SHEET_HEIGHT / FIGMA_FRAME.height;
export const FIGMA_HERO_BAND_RATIO = FIGMA_HERO_BAND / FIGMA_FRAME.height;

export const FIGMA_SHEET_RADIUS = 32;
export const FIGMA_PROGRESS_HEIGHT = 4;
export const FIGMA_PROGRESS_GAP = 6;

export const WELCOME_PROGRESS_SEGMENTS = 6;

/** Mint/teal hero backdrop (matches Nightingale welcome frames). */
export const WELCOME_HERO_BG = '#E8F8F5';
export const WELCOME_HERO_BG_DARK = '#042F2E';

/** Figma 8846:211832 — brand 500 → 400 splash. */
export const LANDING_BRAND_FROM = '#14B8A6';
export const LANDING_BRAND_TO = '#2DD4BF';
export const LANDING_RING_COLOR = '#5EEAD4';
export const LANDING_RING_STROKE = 48;
export const LANDING_LOGO_SIZE = 80;

export const LANDING_GRADIENT = {
  colors: [LANDING_BRAND_FROM, LANDING_BRAND_TO] as const,
  locations: [0, 1] as const,
};

/** Exact ellipse boxes from Figma 11334:71555–71557 / downloaded SVGs. */
export const LANDING_RINGS = [
  {
    id: 'outer',
    viewBox: 1353,
    layout: 1305,
    left: -974,
    top: -384,
    radius: 652.5,
    opacity: 0.64,
    durationMs: 48000,
    direction: 1 as const,
    driftX: 14,
    driftY: -10,
    scaleTo: 1.04,
    progress: false,
  },
  {
    id: 'middle',
    viewBox: 691,
    layout: 643,
    left: 52,
    top: 122,
    radius: 321.5,
    opacity: 1,
    durationMs: 28000,
    direction: -1 as const,
    driftX: -10,
    driftY: 12,
    scaleTo: 1.035,
    progress: true,
  },
  {
    id: 'inner',
    viewBox: 594,
    layout: 546,
    left: -351,
    top: -51,
    radius: 273,
    opacity: 0.32,
    durationMs: 36000,
    direction: 1 as const,
    driftX: 8,
    driftY: 8,
    scaleTo: 1.05,
    progress: false,
  },
] as const;

export type LandingRing = (typeof LANDING_RINGS)[number];

export function landingCanvasScale(screenWidth: number): number {
  return screenWidth / FIGMA_FRAME.width;
}

export function landingCanvasOffsetY(screenHeight: number, scale: number): number {
  return (screenHeight - FIGMA_FRAME.height * scale) / 2;
}

export function landingRingBox(ring: LandingRing, scale: number, offsetY: number) {
  const overflow = LANDING_RING_STROKE / 2;
  return {
    left: (ring.left - overflow) * scale,
    top: (ring.top - overflow) * scale + offsetY,
    size: ring.viewBox * scale,
  };
}

/** Minimum top breathing room below Dynamic Island / notch. */
export const WELCOME_TOP_INSET_MIN = 12;
export const WELCOME_TOP_INSET_EXTRA = 8;

export function welcomeTopInset(safeTop: number): number {
  return Math.max(safeTop, WELCOME_TOP_INSET_MIN) + WELCOME_TOP_INSET_EXTRA;
}

export type WelcomeProgressState = {
  visible: boolean;
  activeSegment: number;
  activeFill: number;
};

/** Landing (0) hides progress. Carousel 1–11: 6 segments × 2 slides (50% → 100%). */
export function welcomeProgressState(slideIndex: number): WelcomeProgressState {
  if (slideIndex <= 0) {
    return { visible: false, activeSegment: 0, activeFill: 0 };
  }

  const carouselIndex = slideIndex - 1;

  return {
    visible: true,
    activeSegment: Math.floor(carouselIndex / 2),
    activeFill: carouselIndex % 2 === 0 ? 0.5 : 1,
  };
}

/** Map a Figma y-span to pixels for the current screen width. */
export function figmaYToPx(y: number, screenWidth: number): number {
  const frameH = (FIGMA_FRAME.height / FIGMA_FRAME.width) * screenWidth;
  return (y / FIGMA_FRAME.height) * frameH;
}
