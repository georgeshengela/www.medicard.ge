/** Velvet Rhythm: C:/Users/User/Desktop/DESIGN.md. Text shades are AA-adjusted. */
export const cycleLight = {
  cream: '#FAF7F4', creamDeep: '#E5E2DF',
  card: '#FFFFFF', cardSoft: '#F4EFEB',
  ink: '#2A1624', muted: '#504446', mutedSoft: '#6E5D67',
  border: '#E8DFD8', controlBorder: '#827376',
  brand: '#7D4E5D', cta: '#7D4E5D', fab: '#7D4E5D', onPrimary: '#FFFFFF',
  ctaPressed: '#653A48', ctaHover: '#744553', ctaBorder: '#7D4E5D', focus: '#7D4E5D',
  disabledFill: '#E5E2DF', onDisabled: '#6E5D67',
  accentSoft: '#F4E9ED', accentBorder: '#B998A2',
  period: '#A6445A', periodSoft: '#F8E9ED', onPeriod: '#FFFFFF',
  fertile: '#765733', ovulation: '#765733', fertilitySoft: '#F4ECDD',
  follicular: '#8B4D43', luteal: '#765C7C',
  todayRing: '#516051', gaugeProgress: '#7D4E5D', gaugeTrack: '#EAE2E5',
  danger: '#BA1A1A', dangerSoft: '#FFDAD6', success: '#516051',
  white: '#FFFFFF', shadow: 'transparent', overlay: 'rgba(42,22,36,0.38)',
  heroFrom: '#FFFFFF', heroTo: '#FFFFFF', accentGlow: 'transparent',
  // Compatibility aliases for phase art; chrome uses accentSoft.
  blush: '#F2B6C7', blushDeep: '#A6445A', rose: '#A6445A', roseSoft: '#F8E9ED',
  lavender: '#765C7C', lavenderSoft: '#EEE7F0', peach: '#F4E9E3', mint: '#516051',
};

export type CyclePalette = { [K in keyof typeof cycleLight]: string };

export const cycleDark: CyclePalette = {
  cream: '#141016', creamDeep: '#382B3E',
  card: '#1C1620', cardSoft: '#251D2A',
  ink: '#F9F5F6', muted: '#C9BDC5', mutedSoft: '#AFA4AD',
  border: '#382B3E', controlBorder: '#907E88',
  brand: '#C697A7', cta: '#7D4E5D', fab: '#7D4E5D', onPrimary: '#FFFFFF',
  ctaPressed: '#653A48', ctaHover: '#855566', ctaBorder: '#B88899', focus: '#B88899',
  disabledFill: '#382B3E', onDisabled: '#BDB0BA',
  accentSoft: '#33252E', accentBorder: '#775360',
  period: '#D99AA9', periodSoft: '#36222D', onPeriod: '#321521',
  fertile: '#D4B591', ovulation: '#D4B591', fertilitySoft: '#322B23',
  follicular: '#D6A294', luteal: '#B8A3BE',
  todayRing: '#BACBB9', gaugeProgress: '#B88899', gaugeTrack: '#382B3E',
  danger: '#FFB4AB', dangerSoft: '#452422', success: '#BACBB9',
  white: '#FFFFFF', shadow: 'transparent', overlay: 'rgba(0,0,0,0.60)',
  heroFrom: '#1C1620', heroTo: '#1C1620', accentGlow: 'transparent',
  blush: '#775360', blushDeep: '#D99AA9', rose: '#D99AA9', roseSoft: '#36222D',
  lavender: '#B8A3BE', lavenderSoft: '#302637', peach: '#322822', mint: '#BACBB9',
};
