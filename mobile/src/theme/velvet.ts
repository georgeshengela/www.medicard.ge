import { useTheme } from '@/store/ThemeContext';

/**
 * Velvet: the soft pressed material of the welcome screen (owner 2026-10-11, „ბარხატის / ზამშის ეფექტი“).
 * Every element has the page's own colour and is told apart only by light from the top-left and shade to
 * the bottom-right (neumorphism). The theme toggle is the CodePen „Neumorphic dark mode toggle“ (Cameron
 * Knight) in these colours. Shadows are RN `boxShadow` strings (new architecture; inset needs it too).
 * Text on velvet keeps full-contrast ink: the material is the decoration, never the copy.
 * Owner 2026-10-11: „ზომიერად“ — beyond the welcome screen velvet stays light (fields and buttons only a
 * touch of depth), so the app that follows does not feel foreign.
 */
export type VelvetPalette = {
  /** The page and every raised or pressed surface on it. */
  surface: string;
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
};

export const VELVET: Record<'light' | 'dark', VelvetPalette> = {
  light: {
    surface: '#E6EFED',
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
  },
  dark: {
    surface: '#132A34',
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
  },
};

/** A track pressed into the surface (the CodePen toggle's four shadows). */
export const velvetTrack = (p: VelvetPalette) =>
  `-3px -3px 3px ${p.light}, 3px 3px 3px ${p.shade}, inset 2px 2px 3px ${p.shade}, inset 2px 2px 20px ${p.shade}`;

/** A knob or thumb resting in a track. */
export const velvetKnob = (p: VelvetPalette) => `inset 2px 2px 2px ${p.light}, 5px 6px 6px ${p.shade}`;

/** A big raised disc. */
export const velvetRaised = (p: VelvetPalette) => `18px 18px 36px ${p.shade}, -14px -14px 30px ${p.light}`;

/** A text field: barely pressed into the page (light on purpose — see the note above). */
export const velvetField = (p: VelvetPalette) => `inset 1px 1px 3px ${p.shade}, inset -1px -1px 2px ${p.light}`;

/** A button-sized object resting lightly on the page. */
export const velvetLift = (p: VelvetPalette) => `-2px -2px 6px ${p.light}, 3px 4px 10px ${p.shade}`;

/** A shallow well pressed into a raised surface. */
export const velvetWell = (p: VelvetPalette) => `inset 8px 8px 16px ${p.shade}, inset -8px -8px 16px ${p.light}`;

export function useVelvet(): { palette: VelvetPalette; dark: boolean } {
  const { scheme } = useTheme();
  const dark = scheme === 'dark';
  return { palette: VELVET[dark ? 'dark' : 'light'], dark };
}
