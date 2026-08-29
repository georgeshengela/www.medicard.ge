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

/** Landing hero — logo only, no Figma PNG. */
export const LANDING_LOGO_SIZE = 112;
export const LANDING_GRADIENT = {
  colors: ['#C5EFE8', '#E2F7F3', '#FFFFFF'] as const,
  locations: [0, 0.38, 0.72] as const,
};
export const LANDING_GRADIENT_DARK = {
  colors: ['#042F2E', '#111827', '#030712'] as const,
  locations: [0, 0.38, 0.72] as const,
};

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
