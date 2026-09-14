/** Ten Tbilisi raioni. IDs must match `server/prisma/tbilisi-moves-phase2.sql`. */

export const TBILISI_MOVES_DISTRICTS = Object.freeze([
  { id: '11111111-1111-4111-a111-111111111001', slug: 'gldani', nameKa: 'გლდანი', sortOrder: 10 },
  { id: '11111111-1111-4111-a111-111111111002', slug: 'didube', nameKa: 'დიდუბე', sortOrder: 20 },
  { id: '11111111-1111-4111-a111-111111111003', slug: 'vake', nameKa: 'ვაკე', sortOrder: 30 },
  { id: '11111111-1111-4111-a111-111111111004', slug: 'isani', nameKa: 'ისანი', sortOrder: 40 },
  { id: '11111111-1111-4111-a111-111111111005', slug: 'krtsanisi', nameKa: 'კრწანისი', sortOrder: 50 },
  { id: '11111111-1111-4111-a111-111111111006', slug: 'mtatsminda', nameKa: 'მთაწმინდა', sortOrder: 60 },
  { id: '11111111-1111-4111-a111-111111111007', slug: 'nadzaladevi', nameKa: 'ნაძალადევი', sortOrder: 70 },
  { id: '11111111-1111-4111-a111-111111111008', slug: 'saburtalo', nameKa: 'საბურთალო', sortOrder: 80 },
  { id: '11111111-1111-4111-a111-111111111009', slug: 'samgori', nameKa: 'სამგორი', sortOrder: 90 },
  { id: '11111111-1111-4111-a111-111111111010', slug: 'chughureti', nameKa: 'ჩუღურეთი', sortOrder: 100 },
]);

export const TBILISI_MOVES_CONFIG_ID = 'default';

export const ALLOWED_OBSERVATION_PROVIDERS = Object.freeze(['APPLE_HEALTH', 'HEALTH_CONNECT']);
export const REJECTED_OBSERVATION_PROVIDERS = Object.freeze([
  'MANUAL',
  'TYPED',
  'UNKNOWN',
  'OTHER',
  'PEDOMETER',
  'HEALTH_METRIC_DAILY',
  'STEP_LOG',
]);

export const PUBLIC_AVATAR_IDS = Object.freeze([
  'avatar-1',
  'avatar-2',
  'avatar-3',
  'avatar-4',
  'avatar-5',
  'avatar-6',
  'avatar-7',
  'avatar-8',
  'avatar-9',
  'avatar-10',
  'avatar-11',
  'avatar-12',
]);

export const CLOCK_SKEW_MS = 2 * 60 * 1000;
export const PEOPLE_PAGE_DEFAULT = 50;
export const PEOPLE_PAGE_MAX = 50;
