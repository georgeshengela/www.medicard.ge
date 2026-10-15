/**
 * The MEDI module family (owner 2026-10-03): every flagship module is written as one wordmark —
 * „MEDI“ upright, the module part in its own colour and skewed −16°, Exo 2 ExtraBold (owner's pick) —
 * the way MEDIRUN always was. Each module owns one signature colour; MEDIRUN and the Medi assistant
 * keep the brand teal.
 *
 * Where the colour appears: the wordmark, the module's hero card (gradient + rings, like the admin
 * „ახლა აპში“ card), its Home icon tile and ads. Page canvas, cards, tab bar and status bar stay
 * shared — never re-token colors.ts / global.css from here.
 *
 * Utility areas (visits, water, …) keep plain names on purpose. Module pages use the standard
 * header `ModuleHeader` (components/brand/ModuleHeader.tsx) — the MEDIRUN hub header.
 * The site (`server/public/js/module-brand.js`) mirrors these values — keep them in sync.
 */
export type ModuleBrandId = 'run' | 'cycle' | 'food' | 'pill' | 'quest' | 'vet' | 'coach' | 'scan' | 'lab' | 'sleep' | 'family' | 'horo' | 'book' | 'profile' | 'medi';

export type ModuleBrand = {
  id: ModuleBrandId;
  /** The skewed part after „MEDI“ ('' for the assistant itself). */
  suffix: string;
  /** Full name for accessibility, copy and analytics. */
  name: string;
  /** Suffix colour on surfaces (AA on white / on the dark surface). */
  ink: { light: string; dark: string };
  /** Hero gradient: deep → signature → bright, plus the corner glow. */
  gradient: [string, string, string];
  glow: string;
  /** Suffix colour on the hero gradient. */
  onHero: string;
};

export const MODULE_BRANDS: Record<ModuleBrandId, ModuleBrand> = {
  run: {
    id: 'run', suffix: 'RUN', name: 'MEDIRUN',
    ink: { light: '#0D9488', dark: '#2DD4BF' },
    gradient: ['#0B4D47', '#0D9488', '#14B8A6'], glow: 'rgba(94,234,212,0.35)', onHero: '#99F6E4',
  },
  cycle: {
    id: 'cycle', suffix: 'CYCLE', name: 'MEDICYCLE',
    ink: { light: '#C92A55', dark: '#FF8FA8' },
    gradient: ['#831843', '#C92A55', '#F43F5E'], glow: 'rgba(255,143,168,0.35)', onHero: '#FECDD3',
  },
  food: {
    id: 'food', suffix: 'FOOD', name: 'MEDIFOOD',
    ink: { light: '#047857', dark: '#34D399' },
    gradient: ['#064E3B', '#059669', '#34D399'], glow: 'rgba(110,231,183,0.38)', onHero: '#A7F3D0',
  },
  pill: {
    id: 'pill', suffix: 'PILL', name: 'MEDIPILL',
    ink: { light: '#1D4ED8', dark: '#93C5FD' },
    gradient: ['#1E3A8A', '#1D4ED8', '#3B82F6'], glow: 'rgba(147,197,253,0.35)', onHero: '#BFDBFE',
  },
  quest: {
    id: 'quest', suffix: 'QUEST', name: 'MEDIQUEST',
    ink: { light: '#6D28D9', dark: '#C4B5FD' },
    gradient: ['#3B0764', '#6D28D9', '#8B5CF6'], glow: 'rgba(196,181,253,0.35)', onHero: '#DDD6FE',
  },
  vet: {
    id: 'vet', suffix: 'VET', name: 'MEDIVET',
    ink: { light: '#0369A1', dark: '#7DD3FC' },
    gradient: ['#0C4A6E', '#0284C7', '#38BDF8'], glow: 'rgba(125,211,252,0.38)', onHero: '#E0F2FE',
  },
  coach: {
    id: 'coach', suffix: 'COACH', name: 'MEDICOACH',
    ink: { light: '#475569', dark: '#CBD5E1' },
    gradient: ['#0F172A', '#1F2937', '#475569'], glow: 'rgba(148,163,184,0.30)', onHero: '#CBD5E1',
  },
  // MEDISCAN (owner 2026-10-03): lab sheets, imaging and skin photos read in one chat. Cyan = the radiology light
  // box (owner rejected amber in both themes; fuchsia was the offered alternative).
  scan: {
    id: 'scan', suffix: 'SCAN', name: 'MEDISCAN',
    // Owner 2026-10-04: the light theme uses the same bright cyan as the dark one (small text: scanTextInk).
    ink: { light: '#22D3EE', dark: '#67E8F9' },
    gradient: ['#083344', '#0891B2', '#22D3EE'], glow: 'rgba(103,232,249,0.35)', onHero: '#CFFAFE',
  },
  // MEDILAB (owner 2026-10-04): „ჩემი ბარათი“ — lab values, saved reports and every Medi conversation.
  // Indigo = the ink of a lab report; distinct from MEDIPILL blue and MEDIQUEST violet.
  lab: {
    id: 'lab', suffix: 'LAB', name: 'MEDILAB',
    ink: { light: '#4F46E5', dark: '#A5B4FC' },
    gradient: ['#1E1B4B', '#4338CA', '#6366F1'], glow: 'rgba(165,180,252,0.38)', onHero: '#C7D2FE',
  },
  // MEDISLEEP (owner 2026-10-12): night plum → orchid, after the owner's two sleep-app references (#291965,
  // #533EA8, #943EC3 and the aubergine dusk). Distinct from MEDIQUEST violet (more magenta, deeper) and MEDILAB
  // indigo. The whole module is a night space (NightProvider + the `sleep` tone in colors.ts).
  sleep: {
    id: 'sleep', suffix: 'SLEEP', name: 'MEDISLEEP',
    ink: { light: '#8A35C2', dark: '#D9A8FF' },
    gradient: ['#1B1145', '#4B2A9E', '#9A4FD6'], glow: 'rgba(217,168,255,0.35)', onHero: '#F1DEFF',
  },
  // MEDIFAMILY (owner 2026-10-12): the family's health, starting with children. Warm coral = the sunrise of a
  // family morning; distinct from MEDICYCLE rose and the women's tone.
  family: {
    id: 'family', suffix: 'FAMILY', name: 'MEDIFAMILY',
    ink: { light: '#C2410C', dark: '#FDBA74' },
    gradient: ['#7C2D12', '#EA580C', '#FB923C'], glow: 'rgba(253,186,116,0.40)', onHero: '#FFEDD5',
  },
  // MEDIHOROSCOPE (owner 2026-10-13): a magical night module — brass astrolabe on lapis night. Brass ink is
  // distinct from MEDIFAMILY coral and the hub amber; the hero is the night sky, not a gold gradient.
  horo: {
    id: 'horo', suffix: 'HOROSCOPE', name: 'MEDIHOROSCOPE',
    ink: { light: '#8A6414', dark: '#E9C77E' },
    gradient: ['#0A1030', '#1B2A66', '#C99A45'], glow: 'rgba(233,199,126,0.32)', onHero: '#F3DDA6',
  },
  // MEDIBOOK (owner 2026-10-15): dental clinics, salons, aesthetic centres and clinics on a map, with online
  // booking. Lime = a free slot on the calendar; yellow-green, so it never reads as MEDIFOOD's blue-green emerald.
  // (The first pick, fuchsia, the owner rejected the same day.)
  book: {
    id: 'book', suffix: 'BOOK', name: 'MEDIBOOK',
    ink: { light: '#4D7C0F', dark: '#BEF264' },
    gradient: ['#14230A', '#3F6212', '#84CC16'], glow: 'rgba(190,242,100,0.35)', onHero: '#ECFCCB',
  },
  // MEDIPROFILE (owner 2026-10-04): the Profile tab's title. It is the person's own page, not a module,
  // so it keeps the brand teal instead of a signature colour.
  profile: {
    id: 'profile', suffix: 'PROFILE', name: 'MEDIPROFILE',
    ink: { light: '#0D9488', dark: '#2DD4BF' },
    gradient: ['#0B4D47', '#0D9488', '#14B8A6'], glow: 'rgba(94,234,212,0.35)', onHero: '#99F6E4',
  },
  medi: {
    id: 'medi', suffix: '', name: 'MEDI',
    ink: { light: '#0D9488', dark: '#2DD4BF' },
    gradient: ['#0B4D47', '#0D9488', '#14B8A6'], glow: 'rgba(94,234,212,0.35)', onHero: '#99F6E4',
  },
};

/** Font family registered in FontsContext for every wordmark. */
export const WORDMARK_FONT = 'Exo2_800ExtraBold';
/** Skew of the module part (owner 2026-10-03: Exo 2 with a 16° lean). */
export const WORDMARK_SKEW = '-16deg';

export function moduleInk(id: ModuleBrandId, dark: boolean): string {
  return dark ? MODULE_BRANDS[id].ink.dark : MODULE_BRANDS[id].ink.light;
}
