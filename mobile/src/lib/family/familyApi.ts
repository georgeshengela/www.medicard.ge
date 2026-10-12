/**
 * MEDIFAMILY client (server: server/src/routes/family.routes.js, docs/MEDIFAMILY.md). Every read goes through
 * useAccountQuery with keys ['family', …]; writes invalidate ['family'] via queryInvalidation.ts.
 * Nothing about a child ever travels in a URL except its id.
 */
import { familyRequest } from '@/lib/api';

export type Sex = 'FEMALE' | 'MALE';
export type Stage = 'newborn' | 'infant_0_6' | 'infant_6_12' | 'toddler' | 'preschool' | 'school' | 'teen';
export type Tone = 'ok' | 'info' | 'watch' | 'alert';

export type FamilyMember = {
  id: string;
  kind: 'CHILD';
  name: string;
  birthDate: string;
  sex: Sex;
  gestationWeeks: number | null;
  birthWeightG: number | null;
  birthLengthCm: number | null;
  bloodGroup: string | null;
  color: string | null;
  feedingMode: 'BREAST' | 'FORMULA' | 'MIXED' | null;
  notes: string | null;
  role: 'OWNER' | 'CAREGIVER';
};

export type AgeInfo = {
  days: number;
  correctedDays: number;
  preterm: boolean;
  label: string;
  correctedLabel: string | null;
  stage: Stage;
  months: number;
  isBirthdayMonth: number | null;
};

export type VaccineStatus = 'done' | 'skipped' | 'due' | 'overdue' | 'soon' | 'upcoming' | 'expired' | 'not_needed';
export type VaccineSummary = {
  doneForAge: number;
  totalForAge: number;
  overdueCount: number;
  dueCount: number;
  next: { id: string; code: string; dose: number; dueOn: string; status: VaccineStatus } | null;
  nextVisit: string[];
};

export type DoseRecord = {
  id: string; status: 'GIVEN' | 'GIVEN_UNKNOWN_DATE' | 'SKIPPED'; givenOn: string | null;
  place: string | null; lot: string | null; reaction: string | null; note: string | null;
};

export type VaccineItem = {
  id: string; code: string; dose: number; stage: string;
  calendarOn: string; dueOn: string; status: VaccineStatus;
  note: string | null; warning: string | null; noteText: string | null; warningText: string | null;
  record: DoseRecord | null;
  abbr: string; name: string; protects: string; daysFromToday: number;
};

export type ExtraDose = DoseRecord & { code: string; dose: number; extraCode: string; name: string; nextOn: string | null };

export type FamilyListItem = FamilyMember & { age: { label: string; days: number; stage: Stage }; vaccines: VaccineSummary };

export type Hero = { kind: string; tone: Tone; title: string; body: string; action: 'vaccines' | 'growth' | 'health' | 'guide'; dueOn?: string };

export type RibbonStation = { key: string; ageDays: number; status: VaccineStatus; doses: number };

export type GrowthLatest ={ value: number; percentile: number; status: string; tone: Tone; on: string } | null;
export type Measurement = { id: string; measuredOn: string; weightKg: number | null; heightCm: number | null; headCm: number | null; position: 'LYING' | 'STANDING' | null; note: string | null };
export type FamilyLog = { id: string; kind: LogKind; at: string; endAt: string | null; data: Record<string, any> };
export type LogKind = 'FEED' | 'TEMP' | 'SYMPTOM' | 'MED' | 'DIAPER' | 'NOTE';
export type HealthItem = { id: string; kind: 'ALLERGY' | 'CONDITION' | 'MEDICATION'; name: string; detail: string | null; severity: 'MILD' | 'MODERATE' | 'SEVERE' | null; active: boolean };
export type Tip = { topic: string; label: string; text: string };
export type FeedingGuide = { stage: Stage; title: string; points: string[] };
export type FeedToday = { count: number; ml: number; breastMinutes: number; last: FamilyLog | null; lastSide: 'L' | 'R' | 'BOTH' | null };

export type Overview = {
  member: FamilyMember;
  age: AgeInfo;
  hero: Hero;
  ribbon: RibbonStation[];
  vaccines: { summary: VaccineSummary; upcoming: VaccineItem[] };
  growth: {
    last: Measurement | null;
    dueForCheck: boolean;
    latest: Partial<Record<Indicator, GrowthLatest>>;
    trends: Partial<Record<Indicator, 'steady' | 'falling' | 'rising' | null>>;
    spark: { on: string; value: number; z: number }[];
  };
  sick: { lastTemp: { c: number; at: string } | null; feverDays: number; active: boolean; temps: { c: number; at: string }[] };
  feeding: (FeedToday & { mode: FamilyMember['feedingMode'] }) | null;
  foods: { tried: number; allergensTried: number; allergensTotal: number; reactions: string[] } | null;
  milestones: { current: { key: string; months: number; done: number; total: number; screen: boolean } | null; next: { key: string; months: number } | null } | null;
  health: { allergies: HealthItem[]; conditions: HealthItem[]; medicines: HealthItem[] };
  tips: Tip[];
  feedingGuide: FeedingGuide;
};

export type Indicator = 'wfa' | 'lhfa' | 'hcfa' | 'bfa';
export type GrowthPoint = { id: string; on: string; ageDays: number; value: number; z: number; percentile: number; status: string; tone: Tone; note: string };
export type GrowthIndicator = {
  points: GrowthPoint[];
  latest: GrowthPoint | null;
  trend: { direction: 'steady' | 'falling' | 'rising'; delta: number; sinceDays: number } | null;
  window: { from: number; to: number } | null;
  curves: Record<'p3' | 'p15' | 'p50' | 'p85' | 'p97', [number, number][]> | null;
};
export type GrowthView = { age: AgeInfo; measurements: Measurement[]; indicators: Partial<Record<Indicator, GrowthIndicator>>; last: Measurement | null; daysSinceLast: number | null; dueForCheck: boolean };

export type VaccinesView = {
  items: VaccineItem[];
  summary: VaccineSummary;
  extras: ExtraDose[];
  stages: { key: string; label: string }[];
  source: { text: string; url: string; checkedOn: string };
  freeNote: string;
  extraCatalog: { code: string; name: string }[];
};

export type FoodItem = { key: string; allergen: boolean; name: string; how: string; status: FoodStatus | null; firstOn: string | null; note: string | null };
export type FoodStatus = 'TRIED' | 'LIKED' | 'REACTION' | 'AVOID';
export type FeedingView = { age: AgeInfo; guide: FeedingGuide; mode: FamilyMember['feedingMode']; today: FeedToday; recent: FamilyLog[]; foods: FoodItem[]; showFoods: boolean; showLog: boolean };

export type MilestoneItem = { key: string; domain: 'social' | 'language' | 'cognitive' | 'movement'; text: string; status: 'YES' | 'NOT_YET' | null };
export type Checkpoint = { key: string; months: number; screen: boolean; done: number; total: number; items: MilestoneItem[] };
export type GuideView = {
  age: AgeInfo;
  milestones: { current: Checkpoint | null; next: Checkpoint | null; domains: Record<string, string>; note: string; all: { key: string; months: number; screen: boolean }[] };
  checkpoint: Checkpoint | null;
  tips: Tip[];
  feeding: FeedingGuide;
};

export type SickView = { lastTemp: { c: number; at: string; site: string | null } | null; feverDays: number; active: boolean; temps: { c: number; at: string }[] };
export type LogsView = { logs: FamilyLog[]; sick: SickView; feedingToday: FeedToday };

export type TriageLevel = 'EMERGENCY_NOW' | 'SEE_DOCTOR_TODAY' | 'SEE_DOCTOR_24H' | 'ROUTINE' | 'HOME_CARE';
export type Triage = { level: TriageLevel; text: string } | null;
export type ChatMessage = { id: string; role: 'user' | 'assistant'; content: string; status: string; triage: Triage; createdAt?: string };
export type ChatSession = { id: string; title: string; updatedAt: string };

export type ReminderPoint = { id: string; memberId: string; kind: 'vaccine' | 'extra' | 'month'; fireOn: string; hour: number; title: string; body: string; route: string };

export type MemberWrite = {
  name: string; birthDate: string; sex: Sex; gestationWeeks?: number | null; birthWeightG?: number | null; birthLengthCm?: number | null;
  bloodGroup?: string | null; color?: string | null; feedingMode?: FamilyMember['feedingMode']; notes?: string | null;
};

const m = (id: string) => `/members/${id}`;

export const familyApi = {
  list: () => familyRequest<{ members: FamilyListItem[]; maxChildren: number; consentVersion: string }>(''),
  create: (body: MemberWrite & { consent: true; pastVaccines?: 'ALL' | 'NONE' | 'MANUAL' }) => familyRequest<{ member: FamilyMember }>('/members', 'POST', body),
  get: (id: string) => familyRequest<{ member: FamilyMember; age: AgeInfo }>(m(id)),
  update: (id: string, body: Partial<MemberWrite>) => familyRequest<{ member: FamilyMember }>(m(id), 'PATCH', body),
  remove: (id: string) => familyRequest<{ ok: true }>(m(id), 'DELETE'),
  overview: (id: string) => familyRequest<Overview>(`${m(id)}/overview`),

  vaccines: (id: string) => familyRequest<VaccinesView>(`${m(id)}/vaccines`),
  setDose: (id: string, doseId: string, body: { status: DoseRecord['status']; givenOn?: string | null; place?: string | null; lot?: string | null; reaction?: string | null; note?: string | null }) =>
    familyRequest<{ dose: DoseRecord }>(`${m(id)}/vaccines/${doseId}`, 'PUT', body),
  clearDose: (id: string, doseId: string) => familyRequest<{ ok: true }>(`${m(id)}/vaccines/${doseId}`, 'DELETE'),
  markPast: (id: string) => familyRequest<{ ok: true; added: number }>(`${m(id)}/vaccines/past`, 'POST', {}),
  addExtra: (id: string, body: { code: string; givenOn: string; nextOn?: string | null; place?: string | null; note?: string | null }) =>
    familyRequest<{ dose: DoseRecord }>(`${m(id)}/vaccines/extra`, 'POST', body),
  removeExtra: (id: string, recordId: string) => familyRequest<{ ok: true }>(`${m(id)}/vaccines/extra/${recordId}`, 'DELETE'),

  growth: (id: string) => familyRequest<GrowthView>(`${m(id)}/growth`),
  addMeasurement: (id: string, body: Omit<Measurement, 'id'>) => familyRequest<{ measurement: Measurement }>(`${m(id)}/measurements`, 'POST', body),
  removeMeasurement: (id: string, measurementId: string) => familyRequest<{ ok: true }>(`${m(id)}/measurements/${measurementId}`, 'DELETE'),

  logs: (id: string, days = 7, kinds?: LogKind[]) => familyRequest<LogsView>(`${m(id)}/logs?days=${days}${kinds ? `&kinds=${kinds.join(',')}` : ''}`),
  addLog: (id: string, body: { kind: LogKind; at: string; endAt?: string | null; data: Record<string, unknown>; clientRequestId?: string }) =>
    familyRequest<{ log: FamilyLog }>(`${m(id)}/logs`, 'POST', body),
  removeLog: (id: string, logId: string) => familyRequest<{ ok: true }>(`${m(id)}/logs/${logId}`, 'DELETE'),

  health: (id: string) => familyRequest<{ items: HealthItem[] }>(`${m(id)}/health`),
  addHealth: (id: string, body: { kind: HealthItem['kind']; name: string; detail?: string | null; severity?: HealthItem['severity'] }) =>
    familyRequest<{ item: HealthItem }>(`${m(id)}/health`, 'POST', body),
  removeHealth: (id: string, itemId: string) => familyRequest<{ ok: true }>(`${m(id)}/health/${itemId}`, 'DELETE'),

  feeding: (id: string) => familyRequest<FeedingView>(`${m(id)}/feeding`),
  setFood: (id: string, key: string, body: { status: FoodStatus; note?: string | null }) => familyRequest<{ foods: FoodItem[] }>(`${m(id)}/foods/${key}`, 'PUT', body),
  clearFood: (id: string, key: string) => familyRequest<{ foods: FoodItem[] }>(`${m(id)}/foods/${key}`, 'DELETE'),

  guide: (id: string, checkpoint?: string) => familyRequest<GuideView>(`${m(id)}/guide${checkpoint ? `?checkpoint=${encodeURIComponent(checkpoint)}` : ''}`),
  setMilestone: (id: string, key: string, status: 'YES' | 'NOT_YET') => familyRequest<{ ok: true }>(`${m(id)}/milestones/${key}`, 'PUT', { status }),
  clearMilestone: (id: string, key: string) => familyRequest<{ ok: true }>(`${m(id)}/milestones/${key}`, 'DELETE'),

  chats: (id: string) => familyRequest<{ sessions: ChatSession[] }>(`${m(id)}/chats`),
  chat: (id: string, sessionId: string) => familyRequest<{ session: ChatSession; messages: ChatMessage[] }>(`${m(id)}/chats/${sessionId}`),
  deleteChat: (id: string, sessionId: string) => familyRequest<{ ok: true }>(`${m(id)}/chats/${sessionId}`, 'DELETE'),

  reminderFeed: () => familyRequest<{ today: string; items: ReminderPoint[] }>('/reminders/feed'),
};

export function newFamilyRequestId(): string {
  return `fam-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
