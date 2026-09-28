/**
 * MEDI COACH (2026-09-28) — shared types and pure helpers for the client screens (`/trainer/*`)
 * and the trainer workspace (`/coach/*`). Server: /api/trainer, docs/TRAINER.md.
 */

export type CoachScopes = { workouts: boolean; nutrition: boolean; weight: boolean; photos: boolean };
export type CoachScope = keyof CoachScopes;
export const COACH_SCOPES: CoachScope[] = ['workouts', 'nutrition', 'weight', 'photos'];

export type Gym = { id: string; brand: string; brandKa: string | null; name: string; nameKa: string | null; city: string; district: string | null; address: string | null; status: string };
export type GymBrand = { brand: string; brandKa: string | null; branches: Gym[] };

export type TrainerCard = {
  id: string;
  displayName: string;
  avatarId: string | null;
  bio: string;
  specialties: { key: string; label: string }[];
  experienceYears: number | null;
  instagram: string | null;
  verified: boolean;
  certificates: { title: string; issuer: string; year: number | null }[];
  gyms: Gym[];
  clients: number;
};

export type TrainerStatus = 'PENDING' | 'VERIFIED' | 'REJECTED' | 'SUSPENDED';

export type OwnTrainerProfile = {
  status: TrainerStatus;
  displayName: string;
  bio: string;
  specialties: string[];
  experienceYears: number | null;
  instagram: string;
  gyms: Gym[];
  gymIds: string[];
  certificates: { id: string; title: string; issuer: string; year: number | null; addedAt: string }[];
  code: string | null;
  link: string | null;
  reviewNote: string | null;
};

export type CoachMe = { trainerProfile: OwnTrainerProfile | null; clientLink: { id: string; status: 'REQUESTED' | 'ACTIVE'; trainerId: string } | null; consentVersion: string };

export type SessionStatus = 'OPEN' | 'SCHEDULED' | 'CANCELLED' | 'DONE' | 'NO_SHOW';
export type Exercise = { name: string; sets?: number | null; reps?: number | null; kg?: number | null; minutes?: number | null };
export type Workout = { id: string; source: string; kind: string; startedAt: string; endedAt: string; durationMin: number; kcal: number | null; avgHeartRate: number | null; distanceKm: number | null; date: string };

export type CoachSession = {
  id: string;
  trainerId: string;
  clientId: string | null;
  clientName: string | null;
  clientAvatarId: string | null;
  startsAt: string;
  durationMin: number;
  kind: string;
  kindLabel: string;
  note: string;
  status: SessionStatus;
  gym: { id: string; brand: string; name: string; city: string } | null;
  seriesId: string | null;
  clientConfirmedAt: string | null;
  cancelledBy: string | null;
  cancelReason: string | null;
  lateCancel: boolean;
  exercises: Exercise[];
  trainerNote: string;
  clientRating: number | null;
  label: string;
  workout?: Workout | null;
};

export type MealPlan = {
  id: string;
  title: string;
  targets: { calories: number; protein?: number | null; carbs?: number | null; fat?: number | null };
  meals: { slot: string; time?: string | null; items: { name: string; grams?: number | null; calories?: number | null; protein?: number | null }[] }[];
  note: string;
  startsOn: string | null;
  updatedAt: string;
};

export type DayStatus = 'ON' | 'OVER' | 'UNDER' | 'LOW_PROTEIN' | 'PENDING' | 'NONE';
export type NutritionDay = { date: string; meals: number; calories: number; protein: number; carbs: number; fat: number; status: DayStatus; ratio: number | null };

export type GoalProposal = { type: 'lose' | 'gain' | 'recomp' | 'performance'; targetKg: number; deadlineYmd: string; note?: string; proposedAt: string };

export type ClientOverview = {
  link: null | { id: string; status: 'REQUESTED' | 'ACTIVE'; scopes: CoachScopes; since: string | null; createdAt: string; proposedGoal: GoalProposal | null; trainerViewedAt: string | null };
  trainer?: TrainerCard | null;
  upcoming?: CoachSession[];
  openSlots?: CoachSession[];
  past?: CoachSession[];
  plan?: MealPlan | null;
  nutrition?: { days: NutritionDay[]; score: number | null } | null;
  stats?: { done: number; noShow: number };
  consentVersion?: string;
};

export type CoachAlert = { kind: string; tone: 'warn' | 'info' | 'good'; text: string; clientId?: string; clientName?: string; avatarId?: string | null };

export type RosterClient = {
  linkId: string;
  id: string;
  name: string;
  avatarId: string | null;
  age: number | null;
  gender: string | null;
  since?: string | null;
  scopes: CoachScopes;
  week: { date: string; status: DayStatus }[] | null;
  kcalToday: { eaten: number; target: number | null } | null;
  weight: { currentKg: number | null; goalKg: number | null; percent: number | null } | null;
  nextSession: string | null;
  alerts: CoachAlert[];
};
export type RosterRequest = { linkId: string; id: string; name: string; avatarId: string | null; age: number | null; gender: string | null; note: string; createdAt: string; scopes: CoachScopes };

export type CoachToday = {
  today: string;
  trainer: { displayName: string; status: TrainerStatus };
  sessions: CoachSession[];
  stats: { clients: number; requests: number; weekSessions: number; done30: number; noShow30: number };
  alerts: CoachAlert[];
  requests: RosterRequest[];
};

export type WeightData = {
  series: { date: string; kg: number }[];
  currentKg: number | null;
  lastWeighYmd: string | null;
  heightCm: number | null;
  goal: { targetKg: number; startKg: number; startedYmd: string; deadlineYmd: string; paceKgPerWeek: number } | null;
  progress: { percent: number; remainingKg: number; direction: 'lose' | 'gain' | 'keep' } | null;
};

export type ProgressPhoto = { id: string; takenOn: string; pose: 'FRONT' | 'SIDE' | 'BACK' | 'OTHER'; weightKg: number | null; note: string; url: string };

export type ClientDashboard = {
  client: { id: string; name: string; firstName: string; avatarId: string | null; age: number | null; gender: string | null; heightCm: number | null };
  link: { id: string; since: string | null; scopes: CoachScopes; proposedGoal: GoalProposal | null; note: string };
  plan: MealPlan | null;
  sessions: CoachSession[];
  nutrition: null | { days: NutritionDay[]; lastMealYmd: string | null; score: number | null; today: { id: string; type: string; title: string; calories: number; protein: number; time: string; source: string }[]; targets: MealPlan['targets'] | null };
  weight: WeightData | null;
  activity: null | {
    days: { date: string; steps: number | null; activeMinutes: number | null; heartRate: number | null; sleepHours: number | null }[];
    activities: { date: string; kind: string; minutes: number; kcal: number; source: string }[];
    workouts: Workout[];
  };
  photos: ProgressPhoto[] | null;
};

export type CoachCatalog = {
  specialties: { key: string; label: string }[];
  sessionKinds: { key: string; label: string }[];
  mealSlots: { key: string; label: string }[];
  consentVersion: string;
};

// ——— pure helpers ———

export const TBILISI_OFFSET_MS = 4 * 3600000;

export function tbilisiYmd(date: Date | string = new Date()): string {
  return new Date(new Date(date).getTime() + TBILISI_OFFSET_MS).toISOString().slice(0, 10);
}

export function addDaysYmd(ymd: string, days: number): string {
  return new Date(Date.parse(`${ymd}T12:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
}

/** A Tbilisi wall-clock date + "HH:MM" as a UTC ISO string (Georgia has no DST). */
export function tbilisiToIso(ymd: string, hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  return new Date(Date.parse(`${ymd}T00:00:00Z`) - TBILISI_OFFSET_MS + (h * 60 + m) * 60000).toISOString();
}

export function clockOf(iso: string): string {
  const t = new Date(new Date(iso).getTime() + TBILISI_OFFSET_MS);
  return `${String(t.getUTCHours()).padStart(2, '0')}:${String(t.getUTCMinutes()).padStart(2, '0')}`;
}

export const WEEKDAY_SHORT = ['კვი', 'ორშ', 'სამ', 'ოთხ', 'ხუთ', 'პარ', 'შაბ'];
export const MONTH_SHORT = ['იან', 'თებ', 'მარ', 'აპრ', 'მაი', 'ივნ', 'ივლ', 'აგვ', 'სექ', 'ოქტ', 'ნოე', 'დეკ'];

export function dayLabel(ymd: string, today = tbilisiYmd()): string {
  if (ymd === today) return 'დღეს';
  if (ymd === addDaysYmd(today, 1)) return 'ხვალ';
  if (ymd === addDaysYmd(today, -1)) return 'გუშინ';
  const d = new Date(`${ymd}T12:00:00Z`);
  return `${WEEKDAY_SHORT[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTH_SHORT[d.getUTCMonth()]}`;
}

/** Monday-first week that contains `ymd`. */
export function weekDays(ymd: string): string[] {
  const d = new Date(`${ymd}T12:00:00Z`);
  const offset = (d.getUTCDay() + 6) % 7;
  const monday = addDaysYmd(ymd, -offset);
  return Array.from({ length: 7 }, (_, i) => addDaysYmd(monday, i));
}

export function hoursUntil(iso: string, now = Date.now()): number {
  return (new Date(iso).getTime() - now) / 3600000;
}

/** Friendly relative time for the next session: "40 წუთში", "3 საათში", "ხვალ 19:00". */
export function relativeStart(iso: string, now = Date.now()): string {
  const mins = Math.round((new Date(iso).getTime() - now) / 60000);
  if (mins <= 0) return 'მიმდინარეობს';
  if (mins < 60) return `${mins} წუთში`;
  if (mins < 6 * 60) return `${Math.round(mins / 60)} საათში`;
  return `${dayLabel(tbilisiYmd(iso), tbilisiYmd(new Date(now)))} ${clockOf(iso)}`;
}

export const DAY_STATUS_LABEL: Record<DayStatus, string> = {
  ON: 'გეგმაში',
  OVER: 'გადააჭარბა',
  UNDER: 'ცოტა ჭამა',
  LOW_PROTEIN: 'ცილა აკლდა',
  PENDING: 'მიმდინარე',
  NONE: 'არ ჩაწერა',
};

export function dayStatusColor(status: DayStatus, dark: boolean): string {
  switch (status) {
    case 'ON':
      return dark ? '#34D399' : '#0F8A5F';
    case 'OVER':
      return dark ? '#FB7185' : '#C62B3F';
    case 'UNDER':
    case 'LOW_PROTEIN':
      return dark ? '#FBBF24' : '#B87400';
    case 'PENDING':
      return dark ? '#5EEAD4' : '#0F766E';
    default:
      return dark ? '#374151' : '#DDE3E4';
  }
}

export const SESSION_STATUS_LABEL: Record<SessionStatus, string> = {
  OPEN: 'თავისუფალი',
  SCHEDULED: 'დაგეგმილი',
  CANCELLED: 'გაუქმდა',
  DONE: 'ჩატარდა',
  NO_SHOW: 'არ მოვიდა',
};

export const POSE_LABEL: Record<ProgressPhoto['pose'], string> = { FRONT: 'წინიდან', SIDE: 'გვერდიდან', BACK: 'ზურგიდან', OTHER: 'სხვა' };

export const GOAL_TYPE_LABEL: Record<GoalProposal['type'], string> = { lose: 'წონის კლება', gain: 'წონის მატება', recomp: 'რეკომპოზიცია', performance: 'ფორმა და ძალა' };

export const SCOPE_COPY: Record<CoachScope, { title: string; body: string }> = {
  workouts: { title: 'ვარჯიშები და აქტივობა', body: 'ნაბიჯები, აქტიური წუთები, პულსი და ვარჯიშები Apple Health / Health Connect-იდან.' },
  nutrition: { title: 'კვება', body: 'კვების დღიური, კალორიები, მაკროები და ტრენერის გეგმის დაცვა.' },
  weight: { title: 'წონა და მიზანი', body: 'აწონვები, წონის მიზანი და პროგრესი.' },
  photos: { title: 'პროგრეს-ფოტოები', body: 'შენი „მანამდე / შემდეგ“ ფოტოები. ნაგულისხმევად გამორთულია.' },
};

/** Share of the goal covered, clamped to 0–100 (null when unknown). */
export function goalPercent(startKg: number | null | undefined, targetKg: number | null | undefined, currentKg: number | null | undefined): number | null {
  if (![startKg, targetKg, currentKg].every((v) => typeof v === 'number' && Number.isFinite(v))) return null;
  const total = (targetKg as number) - (startKg as number);
  if (Math.abs(total) < 0.05) return 100;
  return Math.max(0, Math.min(100, Math.round((((currentKg as number) - (startKg as number)) / total) * 100)));
}

/** Pick the before/after pair for the compare view: earliest and latest photo of the same pose. */
export function beforeAfter(photos: ProgressPhoto[], pose: ProgressPhoto['pose'] = 'FRONT'): { before: ProgressPhoto; after: ProgressPhoto } | null {
  const same = photos.filter((p) => p.pose === pose).sort((a, b) => a.takenOn.localeCompare(b.takenOn));
  if (same.length < 2) return null;
  return { before: same[0], after: same[same.length - 1] };
}

export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86400000);
}

export function normalizeCoachCode(raw: unknown): string | null {
  const code = String(raw ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/.test(code) ? code : null;
}

export function coachLink(code: string): string {
  return `https://medicard.ge/c/${code}`;
}

export const WORKOUT_KIND_KA: Record<string, string> = {
  traditionalStrengthTraining: 'ძალოვანი ვარჯიში',
  functionalStrengthTraining: 'ფუნქციური ვარჯიში',
  highIntensityIntervalTraining: 'HIIT',
  running: 'სირბილი',
  walking: 'სიარული',
  cycling: 'ველოსიპედი',
  swimming: 'ცურვა',
  yoga: 'იოგა',
  pilates: 'პილატესი',
  boxing: 'ბოქსი',
  crossTraining: 'კროს-ტრენინგი',
  elliptical: 'ელიფსური',
  rowing: 'ნიჩბოსნობა',
  coreTraining: 'კორი',
  flexibility: 'მოქნილობა',
  mixedCardio: 'კარდიო',
  stairClimbing: 'კიბეები',
  other: 'ვარჯიში',
};

export function workoutKindLabel(kind: string): string {
  return WORKOUT_KIND_KA[kind] || WORKOUT_KIND_KA[kind.replace(/^EXERCISE_TYPE_/, '').toLowerCase()] || 'ვარჯიში';
}
