/** Flat accent palette for the home hub — no gradients, distinct per module. */
export type HomeAccent = {
  bg: string;
  soft: string;
  ink: string;
  border: string;
};

const LIGHT: Record<string, HomeAccent> = {
  doctor: { bg: '#14B8A6', soft: '#CCFBF1', ink: '#0F766E', border: '#5EEAD4' },
  cycle: { bg: '#D4738A', soft: '#FCE8EE', ink: '#8E3D52', border: '#F0B8C6' },
  lab: { bg: '#2563A8', soft: '#DCE9F8', ink: '#163E6E', border: '#9BB8E0' },
  imaging: { bg: '#6B3FA0', soft: '#EFE4FA', ink: '#452768', border: '#C9A6EF' },
  skin: { bg: '#C05621', soft: '#FAEADB', ink: '#7A3412', border: '#E8B48A' },
  skincare: { bg: '#DB4F8C', soft: '#FCE4EF', ink: '#8E2958', border: '#F0A8C8' },
  consilium: { bg: '#4F46E5', soft: '#E8E7FD', ink: '#312E81', border: '#A5B4FC' },
  pharmacy: { bg: '#0F8A5F', soft: '#E3F4EC', ink: '#065A3D', border: '#7FD4B0' },
  calendar: { bg: '#B87400', soft: '#FBF0DE', ink: '#704600', border: '#E8C078' },
  visits: { bg: '#0891B2', soft: '#CFFAFE', ink: '#155E75', border: '#67E8F9' },
};

const DARK: Record<string, HomeAccent> = {
  doctor: { bg: '#14B8A6', soft: '#134E4A', ink: '#5EEAD4', border: '#0F766E' },
  cycle: { bg: '#E8899E', soft: '#3A1A24', ink: '#F7C6D0', border: '#8E3D52' },
  lab: { bg: '#7EB6E6', soft: '#163044', ink: '#B8D4F0', border: '#2563A8' },
  imaging: { bg: '#C9A6EF', soft: '#2C1D40', ink: '#E8D4FA', border: '#6B3FA0' },
  skin: { bg: '#F0A070', soft: '#3A2210', ink: '#FAD4B8', border: '#C05621' },
  skincare: { bg: '#F08BB5', soft: '#3A1528', ink: '#FBCFE0', border: '#DB4F8C' },
  consilium: { bg: '#A5B4FC', soft: '#1E1B4B', ink: '#C7D2FE', border: '#4F46E5' },
  pharmacy: { bg: '#34D399', soft: '#0E2A21', ink: '#A7F3D0', border: '#0F8A5F' },
  calendar: { bg: '#FBBF24', soft: '#2E220B', ink: '#FDE68A', border: '#B87400' },
  visits: { bg: '#22D3EE', soft: '#0C2A32', ink: '#A5F3FC', border: '#0891B2' },
};

export function homeAccentFor(key: string, dark: boolean): HomeAccent {
  const map = dark ? DARK : LIGHT;
  return map[key] ?? map.doctor;
}
