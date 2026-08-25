type CategoryVisual = { emoji: string; bg: string; fg: string };

const DEFAULT: CategoryVisual = { emoji: '💊', bg: '#E0F2F1', fg: '#00695C' };

const MAP: Record<string, CategoryVisual> = {
  immunology: { emoji: '🛡️', bg: '#E8EAF6', fg: '#3949AB' },
  'ear-drops': { emoji: '👂', bg: '#FFF3E0', fg: '#EF6C00' },
  endocrinology: { emoji: '🦋', bg: '#FCE4EC', fg: '#C2185B' },
  erectile: { emoji: '💙', bg: '#E3F2FD', fg: '#1565C0' },
  sedatives: { emoji: '🌙', bg: '#EDE7F6', fg: '#5E35B1' },
  diabetes: { emoji: '🩸', bg: '#FFEBEE', fg: '#C62828' },
  'eye-drops': { emoji: '👁️', bg: '#E0F7FA', fg: '#00838F' },
  painkillers: { emoji: '⚡', bg: '#FFF8E1', fg: '#F9A825' },
  gastro: { emoji: '🫁', bg: '#F1F8E9', fg: '#558B2F' },
  antiseptic: { emoji: '🧴', bg: '#E8F5E9', fg: '#2E7D32' },
  corticosteroids: { emoji: '💉', bg: '#ECEFF1', fg: '#455A64' },
  musculoskeletal: { emoji: '🦴', bg: '#EFEBE9', fg: '#5D4037' },
  allergy: { emoji: '🤧', bg: '#FFFDE7', fg: '#F57F17' },
  blood: { emoji: '🩸', bg: '#FFEBEE', fg: '#B71C1C' },
  antiinfective: { emoji: '🦠', bg: '#E8F5E9', fg: '#1B5E20' },
  gynecology: { emoji: '🌸', bg: '#FCE4EC', fg: '#AD1457' },
  antiparasitic: { emoji: '🐛', bg: '#F3E5F5', fg: '#7B1FA2' },
  oncology: { emoji: '🎗️', bg: '#FCE4EC', fg: '#880E4F' },
  solvents: { emoji: '💧', bg: '#E1F5FE', fg: '#0277BD' },
  vitamins: { emoji: '✨', bg: '#FFF9C4', fg: '#F57F17' },
  nervous: { emoji: '🧠', bg: '#EDE7F6', fg: '#4527A0' },
  cardio: { emoji: '❤️', bg: '#FFEBEE', fg: '#C62828' },
  dermatology: { emoji: '🧴', bg: '#FFF3E0', fg: '#E65100' },
  respiratory: { emoji: '🫁', bg: '#E0F2F1', fg: '#00695C' },
  'ear-disease': { emoji: '👂', bg: '#FFF8E1', fg: '#FF8F00' },
  hemorrhoids: { emoji: '🩹', bg: '#FFEBEE', fg: '#D32F2F' },
  medikamentebi: { emoji: '💊', bg: '#E0F2F1', fg: '#00695C' },
};

export function categoryVisual(slug: string): CategoryVisual {
  return MAP[slug] ?? DEFAULT;
}

export const PHARMACY_SOURCES = [
  { id: 'PHARMADEPOT', label: 'ფარმადეპო', color: '#14B8A6', logoUrl: 'https://pharmadepot.ge/icons/favicon.ico' },
  { id: 'AVERSI', label: 'ავერსი', color: '#5C6BC0', logoUrl: 'https://www.aversi.ge/favicon.ico' },
  { id: 'PSP', label: 'PSP', color: '#EF5350', logoUrl: 'https://psp.ge/favicon.ico' },
] as const;

/** ~6% UI scale for pharmacy browse/compare screens. */
export function pharmPx(value: number) {
  return Math.round(value * 1.06);
}
