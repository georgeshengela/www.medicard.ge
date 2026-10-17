import { useTheme } from '@/store/ThemeContext';
import { VELVET, type VelvetPalette } from '@/theme/velvetMaterial';

export {
  VELVET,
  VELVET_DEPTH,
  velvetCard,
  velvetCta,
  velvetField,
  velvetKnob,
  velvetLift,
  velvetPalettes,
  velvetPill,
  velvetRaised,
  velvetTrack,
  velvetWell,
  type VelvetDepth,
  type VelvetPalette,
} from '@/theme/velvetMaterial';

/**
 * Velvet: the soft pressed material of the welcome screen (owner 2026-10-11, „ბარხატის / ზამშის ეფექტი“).
 * Every element has the page's own colour and is told apart only by light from the top-left and shade to
 * the bottom-right (neumorphism). The theme toggle is the CodePen „Neumorphic dark mode toggle“ (Cameron
 * Knight) in these colours. Shadows are RN `boxShadow` strings (new architecture; inset needs it too).
 * Text on velvet keeps full-contrast ink: the material is the decoration, never the copy.
 * Owner 2026-10-11: „ზომიერად“ — beyond the welcome screen velvet stays light (fields and buttons only a
 * touch of depth), so the app that follows does not feel foreign. Owner 2026-10-17: lighter still — every
 * shadow (velvetMaterial.ts) is scaled by the palette's `depth`, so one value softens all of velvet.
 */

export function useVelvet(): { palette: VelvetPalette; dark: boolean } {
  const { scheme } = useTheme();
  const dark = scheme === 'dark';
  return { palette: VELVET[dark ? 'dark' : 'light'], dark };
}
