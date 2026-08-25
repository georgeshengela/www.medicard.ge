/**
 * Maps Medicard app routes → Nightingale Figma sections (SH nightingale UI Kit v3).
 * Regenerate inventory: npm run figma:sync
 */
export const FIGMA_FILE_KEY = 'UvO6dfZRJH8SjUj8D0mB8N';

export const FIGMA_SECTIONS = {
  splash: 'Splash & Loading',
  welcome: 'Welcome Screen',
  auth: 'Authentication',
  home: 'Home & Smart Health Metrics',
  doctor: 'Doctor Consultation',
  pharmacy: 'E-Pharmacy',
  medications: 'Medication Tracker',
  profile: 'Profile Setting & Help Center',
} as const;

/** Medicard screens we implement vs Figma kit sections. */
export const MEDICARD_FIGMA_MAP = [
  { route: '/(auth)/sign-in', figmaSection: 'Authentication', notes: 'Email + password login' },
  { route: '/(auth)/sign-up', figmaSection: 'Authentication', notes: 'Registration' },
  { route: '/(auth)/phone', figmaSection: 'Authentication', notes: 'Phone OTP' },
  { route: '/(tabs)/home', figmaSection: 'Home & Smart Health Metrics', notes: 'Main hub' },
  { route: '/chat/doctor', figmaSection: 'Doctor Consultation', notes: 'AI doctor chat' },
  { route: '/pharmacy', figmaSection: 'E-Pharmacy', notes: 'Price compare' },
  { route: '/(tabs)/medications', figmaSection: 'Medication Tracker', notes: 'Calendar + reminders' },
  { route: '/visits', figmaSection: 'Home & Smart Health Metrics', notes: 'Custom Medicard feature' },
  { route: '/cycle', figmaSection: 'Wellness Resources', notes: 'Cycle tracking' },
] as const;
