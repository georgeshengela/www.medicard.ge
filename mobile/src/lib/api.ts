import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { ka } from '@/i18n/ka';
import { publicApiErrorMessage } from './rateLimitCopy.js';
import { getToken } from './storage';
import { UploadTimeoutError, uploadWithDeadline } from './uploadDeadline';
import { withAuthConnectionRetry } from './authConnection';
/**
 * Resolves the API base URL.
 *
 * Hosted default: https://medicard.ge (Render).
 * Local Expo QA can override EXPO_PUBLIC_API_URL in the ignored .env.development;
 * EAS preview and production set their hosted URL explicitly in eas.json.
 */
const PRODUCTION_API_DEFAULT = 'https://medicard.ge';

function resolveBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, '');

  const fromExtra = Constants.expoConfig?.extra?.apiUrl as string | undefined;
  if (fromExtra?.trim()) return fromExtra.trim().replace(/\/$/, '');

  return PRODUCTION_API_DEFAULT;
}

export const API_BASE_URL = resolveBaseUrl();

/** IANA zone for Cycle "today". Historical YYYY-MM-DD rows are never rewritten. */
function clientTimezoneHeaders(): Record<string, string> {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return tz ? { 'X-Client-Timezone': tz } : {};
  } catch {
    return {};
  }
}

export type Usage = {
  date: string;
  periodKey?: string;
  periodType?: 'subscription' | 'calendar' | 'rolling';
  periodLabel?: string;
  periodStart?: string | null;
  periodEnd?: string | null;
  billingPeriod?: 'monthly' | 'daily';
  used: number;
  limit: number;
  remaining: number;
  exceeded: boolean;
  unlimited?: boolean;
  resetsInMs: number;
  resetAt?: string | null;
  resetKind?: 'lock' | 'calendar' | null;
  refilled?: boolean;
  refilledKey?: string | null;
};

export type Gender = 'MALE' | 'FEMALE' | 'OTHER';

export type UserPackage = {
  id: string;
  code: string;
  nameKa: string;
  nameEn: string;
  descriptionKa: string;
  monthlyAiLimit: number;
  dailyAiLimit: number;
  unlimited: boolean;
  priceGel: number;
  billingPeriod: 'monthly';
  features: Record<string, boolean>;
};

export type AiEngineId = 'gemini_flash' | 'ling_free' | 'evidencemd';

export type User = {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  gender: Gender | null;
  /** `YYYY-MM-DD`, or null for accounts that predate the medical profile. */
  birthDate: string | null;
  age: number | null;
  status?: 'ACTIVE' | 'BLOCKED';
  package?: UserPackage | null;
  packageStartedAt?: string | null;
  packageExpiresAt?: string | null;
  createdAt: string;
  points?: number;
  currentStreak?: number;
  longestStreak?: number;
  lastCheckInDate?: string | null;
  aiEngine?: AiEngineId;
};

export type CheckInDayStatus = 'completed' | 'skipped' | 'empty';

export type CheckInDay = {
  date: string;
  status: CheckInDayStatus;
};

export type CheckInState = {
  points: number;
  currentStreak: number;
  longestStreak: number;
  lastCheckInDate: string | null;
  weekStreak: number;
  claimedToday: boolean;
  today: string;
  pointsPerDay: number;
  week: CheckInDay[];
};

export type UserLocationSnapshot = {
  prompted: boolean;
  enabled: boolean;
  countryCode: string | null;
  countryKa: string | null;
  cityKa: string | null;
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  updatedAt: string | null;
};

export type HealthProfile = {
  heightCm: number | null;
  weightKg: number | null;
  bloodType: string | null;
  activityLevel: string | null;
  exerciseFrequency: string | null;
  sleepQuality: string | null;
  sleepHours: number | null;
  stressLevel: string | null;
  smokingStatus: string | null;
  alcoholUse: string | null;
  dietType: string | null;
  waterIntakeL: number | null;
  restingHeartRate: number | null;
  bloodPressureSystolic: number | null;
  bloodPressureDiastolic: number | null;
  chronicConditions: string[];
  allergies: string[];
  medications: string[];
  familyHistory: string[];
  healthGoals: string[];
  extraAnswers: Record<string, unknown>;
  currentStepIndex: number;
  completedAt: string | null;
  bmi: number | null;
};

export type AccountAppState = {
  labPanels: import('@/types/lab').LabPanel[];
  weightGoal: import('@/types/weightGoal').WeightGoal | null;
  weightLogs: import('@/types/weightGoal').WeightLog[];
  stepsGoal: import('@/types/stepsGoal').StepsGoal | null;
  stepsGoalHistory: import('@/types/stepsGoal').StepsGoalRecord[];
  runHistory: import('@/lib/run/history').RunSummary[];
  doseLogs: import('@/types/medications').MedicationDoseLog[];
  symptomHistory: import('@/lib/symptomResultStorage').SavedSymptomSession[];
  updatedAt?: string | null;
};

export type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  interactionId?: string;
  feedbackRating?: 1 | -1;
  streaming?: boolean;
};

export type ChatSummary = {
  id: string;
  title: string;
  mode: 'DOCTOR' | 'CONSILIUM';
  messageCount: number;
  preview: string;
  createdAt: string;
  updatedAt: string;
};

export type MedicalRecord = {
  id: string;
  type: 'LAB' | 'XRAY' | 'CT_MRI' | 'SKIN' | 'SKINCARE' | 'PRESCRIPTION' | 'SYMPTOM';
  imageUrl: string | null;
  aiAnalysis: string;
  createdAt: string;
};

export type Medication = {
  id: string;
  medName: string;
  dosage: string;
  frequency: string;
  notes: string | null;
  active: boolean;
  config?: Record<string, unknown>;
  createdAt: string;
};

export type DoctorTypeCode =
  | 'GP'
  | 'DENTIST'
  | 'CARDIO'
  | 'GYN'
  | 'NEURO'
  | 'ORTHO'
  | 'THERAPIST'
  | 'OPHTHALMO'
  | 'DERM'
  | 'PED'
  | 'OTHER';

export type VisitReminderConfig = {
  enabled: boolean;
  offsetsMinutes: number[];
  repeatCount: number;
};

export type DoctorVisit = {
  id: string;
  doctorType: DoctorTypeCode;
  doctorFirstName: string | null;
  doctorLastName: string | null;
  visitDate: string;
  visitTime: string;
  address: string | null;
  addressLabel: string | null;
  lat: number | null;
  lng: number | null;
  notes: string | null;
  reminderConfig: VisitReminderConfig;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type GeocodeResult = {
  id: string;
  label: string;
  lat: number;
  lng: number;
};

export type PetAgeKind = 'EXACT' | 'APPROXIMATE' | 'UNKNOWN';
export type PetSex = 'MALE' | 'FEMALE' | 'UNKNOWN';

export type PetAgeDisplay = {
  kind: PetAgeKind;
  years: number | null;
  months: number | null;
};

export type PetClinicHoursSlot = {
  allDay?: boolean;
  closed?: boolean;
  openMin?: number;
  closeMin?: number;
  label?: string;
} | null;

export type PetClinic = {
  id: string;
  name: string;
  description: string | null;
  location: string | null;
  email: string | null;
  phones: Array<{ display: string; tel: string }>;
  hours: Record<string, PetClinicHoursSlot>;
  sourceUrl: string;
  openNow: boolean | null;
  hoursKnown: boolean;
};

export type PetClinicsDirectory = {
  source: { name: string; url: string };
  timezone: string;
  fetchedAt: string | null;
  stale: boolean;
  error?: string;
  clinics: PetClinic[];
};

export type Pet = {
  id: string;
  name: string;
  speciesId: string;
  breedId: string;
  customBreed: string | null;
  sex: PetSex;
  neutered: boolean | null;
  ageKind: PetAgeKind;
  birthDate: string | null;
  approxAgeYears: number | null;
  approxAgeMonths: number | null;
  approxAgeRecordedOn: string | null;
  age: PetAgeDisplay;
  photoUrl: string | null;
  vetClinicName: string | null;
  vetName: string | null;
  vetPhone: string | null;
  vetAddress: string | null;
  vetNotes: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PetWriteBody = {
  name: string;
  speciesId: string;
  breedId?: string;
  customBreed?: string | null;
  sex?: PetSex;
  neutered?: boolean | null;
  ageKind?: PetAgeKind;
  birthDate?: string | null;
  approxAgeYears?: number | null;
  approxAgeMonths?: number | null;
  approxAgeRecordedOn?: string | null;
  vetClinicName?: string | null;
  vetName?: string | null;
  vetPhone?: string | null;
  vetAddress?: string | null;
  vetNotes?: string | null;
};

export type PetWeightUnit = 'kg' | 'g' | 'lb';

export type PetWeightLog = {
  id: string;
  petId: string;
  recordedOn: string;
  weightKg: number;
  inputValue: number;
  inputUnit: PetWeightUnit;
  note: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PetWeightWrite = {
  recordedOn: string;
  inputValue: number;
  inputUnit: PetWeightUnit;
  note?: string | null;
  clientRequestId?: string;
};

export type PetAllergyCategory = 'medication' | 'food' | 'environmental' | 'other' | 'unknown';
export type PetAllergyStatus = 'suspected' | 'veterinarian_confirmed';

export type PetAllergy = {
  id: string;
  petId: string;
  name: string;
  category: PetAllergyCategory;
  reaction: string | null;
  reportedStatus: PetAllergyStatus;
  notedOn: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PetAllergyWrite = {
  name: string;
  category?: PetAllergyCategory;
  reaction?: string | null;
  reportedStatus: PetAllergyStatus;
  notedOn?: string | null;
  notes?: string | null;
  clientRequestId?: string;
};

export type PetConditionStatus = 'active' | 'resolved' | 'unknown';
export type PetConditionBasis = 'owner_reported' | 'veterinarian_confirmed';

export type PetCondition = {
  id: string;
  petId: string;
  name: string;
  status: PetConditionStatus;
  reportedBasis: PetConditionBasis;
  onsetOn: string | null;
  resolvedOn: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PetConditionWrite = {
  name: string;
  status: PetConditionStatus;
  reportedBasis: PetConditionBasis;
  onsetOn?: string | null;
  resolvedOn?: string | null;
  notes?: string | null;
  clientRequestId?: string;
};

export type PetCareKind = 'VACCINATION' | 'FLEA_TICK' | 'DEWORMING' | 'MEDICATION' | 'OTHER';
export type PetRecurrenceKind = 'ONCE' | 'EVERY_N_DAYS' | 'EVERY_N_WEEKS' | 'EVERY_N_MONTHS' | 'DAILY_COURSE';
export type PetRecurrenceBasis = 'NONE' | 'FIXED_CALENDAR' | 'FROM_ADMINISTRATION';
export type PetCareSource = 'VETERINARIAN' | 'PRODUCT_INSTRUCTIONS' | 'USER_ENTERED';
export type PetCareRoute = 'oral' | 'topical' | 'injection' | 'other' | 'unknown';
export type PetScheduleStatus = 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
export type PetOccurrenceStatus = 'OPEN' | 'ADMINISTERED' | 'SKIPPED' | 'CANCELLED';
export type PetCareEventStatus = 'RECORDED' | 'VOIDED';

export type PetProduct = {
  id: string;
  petId: string;
  kind: PetCareKind;
  name: string;
  formulation: string | null;
  batchId: string | null;
  notes: string | null;
  expiresOn: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PetProductWrite = {
  kind: PetCareKind;
  name: string;
  formulation?: string | null;
  batchId?: string | null;
  notes?: string | null;
  expiresOn?: string | null;
  clientRequestId?: string;
};

export type PetCareSchedule = {
  id: string;
  petId: string;
  productId: string | null;
  kind: PetCareKind;
  title: string;
  dose: string | null;
  doseUnit: string | null;
  route: PetCareRoute | null;
  startOn: string;
  dueTime: string | null;
  times: string[] | null;
  recurrenceKind: PetRecurrenceKind;
  intervalCount: number | null;
  recurrenceBasis: PetRecurrenceBasis;
  source: PetCareSource;
  sourceNote: string | null;
  courseEndsOn: string | null;
  occurrenceLimit: number | null;
  anchorDay: number | null;
  status: PetScheduleStatus;
  revision: number;
  nextDueOn: string | null;
  nextDueTime: string | null;
  nextSequence: number | null;
  reminderEnabled: boolean;
  reminderOffsetsDays: number[];
  timeMode: 'DATE_BASED' | 'EXACT_TIME';
  timezone: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PetCareScheduleWrite = {
  kind: PetCareKind;
  title: string;
  productId?: string | null;
  dose?: string | null;
  doseUnit?: string | null;
  route?: PetCareRoute | null;
  startOn: string;
  dueTime?: string | null;
  times?: string[] | null;
  recurrenceKind: PetRecurrenceKind;
  intervalCount?: number | null;
  recurrenceBasis?: PetRecurrenceBasis;
  source: PetCareSource;
  sourceNote?: string | null;
  courseEndsOn?: string | null;
  occurrenceLimit?: number | null;
  timeMode?: 'DATE_BASED' | 'EXACT_TIME';
  timezone?: string | null;
  clientRequestId?: string;
};

export type PetCareOccurrence = {
  scheduleId: string;
  revision: number;
  plannedOn: string;
  plannedTime: string | null;
  sequence: number;
  occurrenceKey: string;
  status: PetOccurrenceStatus;
  eventId: string | null;
  reminderIdentity: string | null;
  reminderEnabled: boolean;
  kind: PetCareKind | null;
  title: string | null;
};

export type PetCareEvent = {
  id: string;
  petId: string;
  kind: PetCareKind;
  productId: string | null;
  scheduleId: string | null;
  occurrenceId: string | null;
  occurrenceKey: string | null;
  titleSnapshot: string;
  productNameSnapshot: string | null;
  doseSnapshot: string | null;
  doseUnitSnapshot: string | null;
  routeSnapshot: string | null;
  administeredOn: string;
  administeredTime: string | null;
  timezone: string | null;
  utcOffsetMinutes: number | null;
  notes: string | null;
  status: PetCareEventStatus;
  voidedAt: string | null;
  voidReason: string | null;
  correctionMeta: Record<string, unknown> | null;
  previousNextDueOn: string | null;
  source: string;
  createdAt: string;
  updatedAt: string;
};

export type PetCareEventWrite = {
  kind: PetCareKind;
  title: string;
  productId?: string | null;
  scheduleId?: string | null;
  dose?: string | null;
  doseUnit?: string | null;
  route?: PetCareRoute | null;
  administeredOn: string;
  administeredTime?: string | null;
  timezone?: string | null;
  utcOffsetMinutes?: number | null;
  notes?: string | null;
  clientRequestId?: string;
};

export type PetChatCitation = {
  id: string;
  title: string;
  publisher: string;
  url: string;
  version?: string;
  retrievedOn?: string;
};

export type PetCareDraft = {
  petId: string;
  kind: PetCareKind | null;
  title: string | null;
  productId: string | null;
  dose: string | null;
  doseUnit: string | null;
  startOn: string | null;
  dueTime: string | null;
  recurrenceKind: PetRecurrenceKind;
  intervalCount: number | null;
  source: string;
  provenance: string;
  incomplete: boolean;
  missingFields: string[];
  reminderEnabled: boolean;
};

export type PetChatMessage = {
  id?: string;
  sessionId?: string;
  petId?: string;
  role: 'user' | 'assistant';
  content: string;
  status?: 'PENDING' | 'PARTIAL' | 'COMPLETE' | 'FAILED' | 'CANCELLED';
  clientRequestId?: string | null;
  citations?: PetChatCitation[];
  draft?: PetCareDraft | null;
  grounding?: { status?: string; sourceIds?: string[] } | null;
  createdAt?: string;
  timestamp?: string;
  streaming?: boolean;
};

export type PetChatSession = {
  id: string;
  petId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

export type PetCareCompleteWrite = {
  occurrenceKey: string;
  revision: number;
  administeredOn: string;
  administeredTime?: string | null;
  timezone?: string | null;
  utcOffsetMinutes?: number | null;
  notes?: string | null;
  dose?: string | null;
  doseUnit?: string | null;
  route?: PetCareRoute | null;
  clientRequestId?: string;
};

export type PetsCatalog = {
  version: string;
  coverageNotes: Record<string, unknown>;
  species: Array<{
    id: string;
    labelKa: string;
    coverage: string;
    allowsMixed: boolean;
    breeds: Array<{ id: string; label: string }>;
    sentinels: string[];
  }>;
};

export type ScheduledDose = {
  medicationId: string;
  medName: string;
  dosage: string;
  notes: string | null;
  time: string;
};

export type PharmacySourceInfo = {
  id: string;
  nameKa: string;
  logoUrl: string | null;
  baseUrl: string;
};

export type DrugCategoryInfo = {
  id: string;
  slug: string;
  nameKa: string;
  iconUrl?: string | null;
  productCount?: number;
  children?: DrugCategoryInfo[];
};

export type PharmacyOfferInfo = {
  id: string;
  source: PharmacySourceInfo | null;
  priceGel: number;
  oldPriceGel: number | null;
  discountPercent: number | null;
  inStock: boolean;
  sourceUrl: string;
  rawName: string;
  imageUrl: string | null;
  syncedAt: string;
};

export type PharmacySourcePrice = {
  sourceId: string;
  nameKa: string;
  logoUrl: string | null;
  priceGel: number | null;
  oldPriceGel: number | null;
  inStock: boolean;
  isBest: boolean;
  sourceUrl: string | null;
  priceDiffGel?: number | null;
};

export type CatalogProductSummary = {
  id: string;
  slug: string;
  name: string;
  imageUrl: string | null;
  manufacturer: string | null;
  country: string | null;
  form: string | null;
  strength: string | null;
  packSize: string | null;
  description: string | null;
  category: { id: string; slug: string; nameKa: string } | null;
  bestPriceGel: number | null;
  bestSource: PharmacySourceInfo | null;
  offerCount: number;
  savingsPercent: number | null;
  sourcePrices: PharmacySourcePrice[];
  lastSyncedAt: string | null;
};

export type CatalogProductDetail = CatalogProductSummary & {
  offers: PharmacyOfferInfo[];
};

export type Upsell = { title: string; body: string; cta: string };

/** A failed request the UI can branch on — quota walls need different treatment to 500s. */
export class ApiError extends Error {
  status: number;
  code?: string;
  fields?: { field: string; message: string }[];
  usage?: Usage;
  upsell?: Upsell;
  retryAfterSeconds?: number;
  schemaReady?: boolean;
  healthSchemaReady?: boolean;
  careSchemaReady?: boolean;
  chatSchemaReady?: boolean;

  constructor(
    message: string,
    status: number,
    payload?: Record<string, unknown>,
    retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = payload?.code as string | undefined;
    this.fields = payload?.fields as ApiError['fields'];
    this.usage = payload?.usage as Usage | undefined;
    this.upsell = payload?.upsell as Upsell | undefined;
    this.retryAfterSeconds = retryAfterSeconds;
    if (payload && 'schemaReady' in payload) this.schemaReady = payload.schemaReady as boolean;
    if (payload && 'healthSchemaReady' in payload) this.healthSchemaReady = payload.healthSchemaReady as boolean;
    if (payload && 'careSchemaReady' in payload) this.careSchemaReady = payload.careSchemaReady as boolean;
    if (payload && 'chatSchemaReady' in payload) this.chatSchemaReady = payload.chatSchemaReady as boolean;
  }

  get isQuotaExceeded() {
    return (
      this.status === 429 &&
      (this.code === 'MONTHLY_LIMIT_REACHED' || this.code === 'DAILY_LIMIT_REACHED')
    );
  }

  get isUnauthorized() {
    return this.status === 401;
  }

  get isSchemaUnavailable() {
    return this.status === 503 && this.schemaReady === false;
  }

  get isCareSchemaUnavailable() {
    return this.status === 503 && this.careSchemaReady === false;
  }

  get isChatSchemaUnavailable() {
    return this.status === 503 && this.chatSchemaReady === false;
  }
}

export type CycleMode = 'TRACK_PERIOD' | 'TRY_TO_CONCEIVE' | 'PREGNANCY' | 'PERIMENOPAUSE' | 'POSTPARTUM';

export type CycleInsightCard = {
  id: string;
  tone: 'calm' | 'energy' | 'care' | 'fertile' | 'pregnancy' | 'mood' | string;
  title: string;
  body: string;
  action: string | null;
};

export type CycleInsights = {
  headline: string;
  phaseLabel?: string | null;
  cards: CycleInsightCard[];
  source: 'ai' | 'local' | 'local_fallback' | string;
  generatedAt: string;
};

export type CycleCondition = 'pcos' | 'endometriosis' | 'perimenopause';

export type CycleSharePermissions = {
  period: boolean;
  cyclePhase: boolean;
  fertileWindow: boolean;
  symptoms: boolean;
};

export type CyclePartnerShare = {
  active: boolean;
  code: string | null;
  expiresAt: string | null;
  partnerBound: boolean;
  permissions: CycleSharePermissions;
};

export type CyclePartnerPayload = {
  estimated: true;
  permissions: CycleSharePermissions;
  period?: {
    inPeriod: boolean;
    inPeriodEstimated?: boolean;
    nextPeriodStart: string | null;
    nextPeriodEstimated?: boolean;
  };
  phase?: { phase: string; phaseKa: string; cycleDay: number | null; estimated?: boolean };
  fertileWindow?: {
    start: string | null;
    end: string | null;
    ovulationDate: string | null;
    estimated: true;
  };
  symptoms?: { keys: string[] };
};

export type CycleReminderPrefsServer = {
  enabled?: boolean;
  periodDaysBefore?: number;
  ovulation?: boolean;
  dailyLog?: boolean;
  pms?: boolean;
  opk?: boolean;
  bbt?: boolean;
  maskNotifications?: boolean;
  maskStyle?: 'neutral' | 'wellness' | 'calendar' | 'notes';
};

export type CycleContraceptionMethod =
  | 'NONE'
  | 'COMBINED_PILL'
  | 'PROGESTIN_PILL'
  | 'HORMONAL_IUD'
  | 'COPPER_IUD'
  | 'IMPLANT'
  | 'INJECTION'
  | 'PATCH'
  | 'VAGINAL_RING'
  | 'BARRIER'
  | 'FERTILITY_AWARENESS'
  | 'OTHER';

export type CyclePredictionAvailability = 'NORMAL' | 'CAUTION' | 'LIMITED';

export type CycleContraceptionContext = {
  method: CycleContraceptionMethod | null;
  startedAt: string | null;
  set: boolean;
  category: string;
  predictionAvailability: CyclePredictionAvailability;
  ttcConflict: boolean;
  bleedingLabel: 'period' | 'bleeding';
  presentation: {
    showFertilityMarkers: boolean;
    showOvulationDate: boolean;
    showFertileWindow: boolean;
    showPhaseAsBiological: boolean;
    emphasizeFertility: boolean;
    phaseLabelOverride: string | null;
    loggedBleedKeepsPeriod: boolean;
    famNotCertified: boolean;
    showContextCard: boolean;
    contextKind: 'limited' | 'caution' | null;
  };
};

export type CycleProfile = {
  id: string;
  userId: string;
  mode: CycleMode;
  avgCycleLength: number;
  avgPeriodLength: number;
  lastPeriodStart: string | null;
  isIrregular: boolean;
  dueDate: string | null;
  privacyEnabled: boolean;
  partnerShareCode: string | null;
  conditions: CycleCondition[];
  reminderPrefs: CycleReminderPrefsServer | null;
  contraceptionMethod?: CycleContraceptionMethod | null;
  contraceptionStartedAt?: string | null;
  aiInsights?: CycleInsights | null;
  aiInsightsAt?: string | null;
};

export type CycleTestResult = 'negative' | 'positive' | 'unclear';

export type CyclePainType =
  | 'cramps'
  | 'pelvic'
  | 'lower_back'
  | 'headache'
  | 'breast'
  | 'ovulation_side'
  | 'other';

export type CyclePainSeverity = 'mild' | 'moderate' | 'severe';

export type CyclePainEntry = {
  type: CyclePainType;
  severity: CyclePainSeverity;
};

export type CycleSleepQuality = 'poor' | 'okay' | 'good';
export type CycleStressLevel = 'low' | 'medium' | 'high';
export type CycleExerciseLevel = 'none' | 'light' | 'moderate' | 'intense';
export type CycleCaffeineLevel = 'none' | 'low' | 'moderate' | 'high';
export type CycleAlcoholLevel = 'none' | 'light' | 'moderate' | 'heavy';
export type CycleEnergyLevel = 'very_low' | 'low' | 'normal' | 'high' | 'very_high';

export type CycleCustomTag = {
  id: string;
  name: string;
  archivedAt?: string | null;
  createdAt?: string;
};

export type CycleDailyMetric = {
  date: string;
  hydrationMl: number | null;
  steps: number | null;
  sleepHours: number | null;
};

export type CycleObservationTrendType =
  | 'RECENT_OCCURRENCE'
  | 'PERIOD_EPISODE_RECURRENCE'
  | 'RECENT_SEVERITY_DISTRIBUTION';

export type CycleObservationTrend = {
  key: string;
  category: string;
  trendGroup: 'pain' | 'energy' | 'digestion' | 'skin' | 'physical' | string;
  window: string;
  occurrenceCount: number;
  episodeCount: number;
  lastLoggedDate: string | null;
  summaryType: CycleObservationTrendType;
  summaryArgs: Record<string, string | number | null | undefined>;
  recentDates: string[];
  severityCounts?: { mild: number; moderate: number; severe: number };
  severityMode?: string | null;
};

export type CyclePregnancyObservationTrendType =
  | 'RECENT_OCCURRENCE'
  | 'RECENT_SEVERITY_DISTRIBUTION'
  | 'RECENT_BLEEDING_OCCURRENCE';

export type CycleObservationExposure = {
  presentDays: number;
  absentDays: number;
  assessedDays: number;
  availableDays: number;
  ratePercent: number;
  rateDisplayEligible: boolean;
};

export type CycleObservationExposureComparisonDirection = 'HIGHER' | 'LOWER';

export type CycleObservationExposureComparisonWindow = {
  presentDays: number;
  absentDays: number;
  assessedDays: number;
  availableDays: number;
  ratePercent: number | null;
  from: string | null;
  to: string | null;
};

export type CycleObservationExposureComparison = {
  earlier: CycleObservationExposureComparisonWindow;
  recent: CycleObservationExposureComparisonWindow;
  direction: CycleObservationExposureComparisonDirection | null;
};

export type CycleObservationRateUnavailableReason =
  | 'INSUFFICIENT_ASSESSED_DAYS'
  | 'INSUFFICIENT_COVERAGE'
  | 'INSUFFICIENT_OCCURRENCES'
  | 'NO_PRESENT_OCCURRENCES'
  | 'NOT_EXPOSURE_ELIGIBLE';

export type CycleObservationComparisonUnavailableReason =
  | 'EARLIER_WINDOW_INSUFFICIENT'
  | 'RECENT_WINDOW_INSUFFICIENT'
  | 'BOTH_WINDOWS_INSUFFICIENT'
  | 'SHORT_AVAILABLE_HISTORY'
  | 'NO_QUALIFIED_TWO_WINDOW_DATA';

export type CycleObservationDirectionUnavailableReason =
  | 'CHANGE_TOO_SMALL'
  | 'COVERAGE_NOT_COMPARABLE'
  | 'EVENT_COUNT_TOO_LOW'
  | 'ZERO_BASELINE_NOT_QUALIFIED';

export type CycleObservationRateExplainability = {
  available: boolean;
  reason: CycleObservationRateUnavailableReason | null;
};

export type CycleObservationComparisonExplainability = {
  numbersAvailable: boolean;
  directionAvailable: boolean;
  numbersReason: CycleObservationComparisonUnavailableReason | null;
  directionReason: CycleObservationDirectionUnavailableReason | null;
};

export type CycleObservationExplainability = {
  rate: CycleObservationRateExplainability;
  comparison: CycleObservationComparisonExplainability | null;
};

export type CyclePregnancyObservationTrend = {
  key: string;
  family: 'bleeding' | 'pain' | 'digestion' | 'energy' | 'body' | string;
  summaryType: CyclePregnancyObservationTrendType;
  occurrenceCount: number;
  lastLoggedDate: string | null;
  recentDates: string[];
  summaryArgs: { days: number };
  severityCounts?: { mild: number; moderate: number; severe: number };
  flowCounts?: { spotting: number; light: number; medium: number; heavy: number };
  exposure?: CycleObservationExposure;
  comparison?: CycleObservationExposureComparison;
  explainability?: CycleObservationExplainability;
};

export type CyclePregnancyObservationTrendsPayload = {
  version: string;
  window: {
    from: string | null;
    to: string | null;
    recentDays: number;
    episodeFrom: string | null;
    queryCapDays: number;
  };
  trends: CyclePregnancyObservationTrend[];
  generatedAt: string | null;
};

export type CyclePerimenopauseObservationSummaryType =
  | 'RECENT_OCCURRENCE'
  | 'RECENT_SEVERITY_DISTRIBUTION'
  | 'RECENT_BLEEDING_OCCURRENCE'
  | 'RECENT_CATEGORY_DISTRIBUTION';

export type CyclePerimenopauseObservationSummary = {
  key: string;
  family: 'bleeding' | 'vasomotor' | 'wellness' | 'pain' | 'mood' | 'digestion' | 'body' | string;
  summaryType: CyclePerimenopauseObservationSummaryType;
  occurrenceCount: number;
  lastLoggedDate: string | null;
  recentDates: string[];
  summaryArgs: { days: number };
  severityCounts?: { mild: number; moderate: number; severe: number };
  flowCounts?: { spotting: number; light: number; medium: number; heavy: number };
  exposure?: CycleObservationExposure;
  comparison?: CycleObservationExposureComparison;
  explainability?: CycleObservationExplainability;
};

export type CyclePerimenopauseObservationSummariesPayload = {
  version: string;
  window: {
    from: string | null;
    to: string | null;
    recentDays: number;
    queryCapDays: number;
  };
  summaries: CyclePerimenopauseObservationSummary[];
  generatedAt: string | null;
};

export type CycleDoctorSummaryInclusions = {
  menstrual: boolean;
  pain: boolean;
  symptoms: boolean;
  wellness: boolean;
  fertility: boolean;
  sexual: boolean;
  notes: boolean;
  pregnancyContext?: boolean;
  perimenopauseContext?: boolean;
  postpartumContext?: boolean;
};

export type CycleDoctorPregnancyContext = {
  current: true;
  trackingMode: 'PREGNANCY';
  referenceDate: string | null;
  referenceType: 'LMP' | 'USER_SELECTED' | null;
  reviewRequired: boolean;
  estimatedGestationalAge: { week: number; day: number } | null;
  estimatedDueDate: { date: string; estimated: true } | null;
};

export type CycleDoctorPerimenopauseContext = {
  current: true;
  trackingMode: 'PERIMENOPAUSE';
  userSelected: true;
  variability: {
    intervalCount: number;
    shortestDays: number;
    longestDays: number;
    sourceWindow: string;
  } | null;
};

export type CycleDoctorPostpartumContext = {
  current: true;
  trackingMode: 'POSTPARTUM';
  referenceDate: string | null;
  elapsed: { week: number; day: number } | null;
};

export type CycleDoctorSummary = {
  version: string;
  generatedAt: string;
  range: { from: string; to: string; queryDays: number; loggedDays: number };
  inclusions: CycleDoctorSummaryInclusions;
  pregnancyContext?: CycleDoctorPregnancyContext | null;
  perimenopauseContext?: CycleDoctorPerimenopauseContext | null;
  postpartumContext?: CycleDoctorPostpartumContext | null;
  menstrualHistory: {
    episodes: {
      start: string;
      end: string;
      durationDays: number;
      flowSequence: string[];
      source: string;
    }[];
    spottingDates: string[];
    cycleLengths: { start: string; end: string; lengthDays: number; source: string }[];
    periodDayCount: number;
  } | null;
  pain: {
    rows: { date: string; type: string; severity: string | null; source: string }[];
    aggregates: { type: string; dayCount: number; severityMode: string | null; source: string }[];
  } | null;
  symptoms: { rows: { key: string; dayCount: number; dates: string[]; source: string }[] } | null;
  wellness: {
    energy?: { date: string; value: string; source: string }[];
    sleep?: { date: string; value: string; label?: string; source: string }[];
    stress?: { date: string; value: string; source: string }[];
  } | null;
  contraception: { method: string; startedAt: string | null; source: string; label: string } | null;
  fertilityObservations: {
    ovulationTests: { date: string; result: string; source: string }[];
    pregnancyTests: { date: string; result: string; source: string }[];
    bbt: { date: string; temperature: number; unit: string; source: string }[];
    cervicalMucus: { date: string; value: string; source: string }[];
  } | null;
  privateObservations: {
    sexual: { date: string; key: string; value?: number; source: string }[];
    notes: { date: string; text: string; source: string }[];
  } | null;
  disclaimer: 'history_not_diagnosis';
  mode?: CycleMode | null;
  avgCycleLength?: number | null;
  avgPeriodLength?: number | null;
  cycleCount?: number;
  shortestCycle?: number | null;
  longestCycle?: number | null;
  loggedDays: number;
  periodDaysLogged: number;
  painObservations?: { date: string; type: string; severity: string | null }[];
  topSymptoms: { key: string; count: number }[];
  topMoods: { key: string; count: number }[];
};

export type CycleObservationTrendsPayload = {
  window: { from: string | null; to: string | null; recentDays: number; queryDays: number };
  trends: CycleObservationTrend[];
  generatedAt: string | null;
};

export type CycleObservationPattern = {
  id: string;
  sampleDays: number;
  numerator: number;
  denominator: number;
  textKa: string;
};

export type CycleObservationInsights = {
  pain: {
    daysLogged: number;
    sampleDays: number;
    severityCounts: { mild: number; moderate: number; severe: number };
    typeCounts: Record<string, number>;
    recent: { date: string; type: CyclePainType; severity: CyclePainSeverity }[];
  };
  lifestyle: {
    sleep: Record<string, number>;
    stress: Record<string, number>;
    exercise: Record<string, number>;
    caffeine: Record<string, number>;
    alcohol: Record<string, number>;
    patterns: CycleObservationPattern[];
  };
  journal: {
    noteDays: number;
    dates: string[];
  };
  limitedPhaseInsights?: boolean;
};

export type CycleLog = {
  id: string;
  userId: string;
  date: string;
  flow: string | null;
  symptoms: string[];
  moods: string[];
  sexualActivity: boolean | null;
  libido: number | null;
  bbt: number | null;
  cervicalMucus: string | null;
  ovulationTest?: CycleTestResult | null;
  pregnancyTest?: CycleTestResult | null;
  notes: string | null;
  painEntries?: CyclePainEntry[];
  sleepQuality?: CycleSleepQuality | null;
  stressLevel?: CycleStressLevel | null;
  exerciseLevel?: CycleExerciseLevel | null;
  caffeine?: CycleCaffeineLevel | null;
  alcohol?: CycleAlcoholLevel | null;
  customTagIds?: string[];
  observations?: { energy?: CycleEnergyLevel | null } | null;
  energy?: CycleEnergyLevel | null;
  observationSchemaVersion?: number;
  observationAssessments?: Record<string, 'ABSENT'> | null;
  dailyAssessments?: Record<string, 'PRESENT' | 'ABSENT'> | null;
  trackingContext?: string | null;
  postpartumEpisodeId?: string | null;
};

export type PregnancyLog = {
  id: string;
  userId: string;
  date: string;
  currentWeek: number | null;
  weightKg: number | null;
  symptoms: string[];
  kickCount: number;
  notes: string | null;
};

export type CyclePhaseKind =
  | 'period'
  | 'follicular'
  | 'fertile'
  | 'ovulation'
  | 'luteal'
  | 'unknown';

export type CycleAverages = {
  storedCycleLength: number | null;
  storedPeriodLength: number | null;
  inferredCycleLength: number | null;
  inferredPeriodLength: number | null;
  usedCycleLength: number | null;
  usedPeriodLength: number | null;
  source: 'user' | 'inferred' | 'default';
  cycleCount: number;
};

export type CycleInsightDataQuality = 'LOW' | 'MEDIUM' | 'HIGH';

export type CycleHistoricalCycle = {
  startDate: string;
  nextPeriodStart: string | null;
  cycleLength: number | null;
  loggedBleedDays: number;
  loggedObservationDays: number;
  complete: boolean;
  contraceptionRelation?: 'before_current_method' | 'on_or_after_current_start' | 'unknown';
};

export type CycleRecurringPattern = {
  key: string;
  cyclesWithObservation: number;
  eligibleCycles: number;
  daysBeforeMin: number | null;
  daysBeforeMax: number | null;
};

export type CyclePainPattern = {
  kind: 'pain_before_period';
  painType: string;
  cyclesWithObservation: number;
  eligibleCycles: number;
  daysBeforeMin: number | null;
  daysBeforeMax: number | null;
  severeCycles?: number;
};

export type CycleLifestylePattern = {
  kind: 'co_occurrence';
  left: string;
  right: string;
  numerator: number;
  denominator: number;
};

export type CycleAnalytics = {
  insightDataQuality: CycleInsightDataQuality;
  completedCycleCount: number;
  patternCycleCount: number;
  loggingCoverage: number;
  horizonCycles: number;
  historicalCycles: CycleHistoricalCycle[];
  cycleLengths: { startDate: string; length: number | null }[];
  cycleLengthStats: {
    average: number | null;
    shortest: number | null;
    longest: number | null;
    variability: number | null;
    count: number;
  };
  bleedDurations: {
    average: number | null;
    shortest: number | null;
    longest: number | null;
    variability: number | null;
    count: number;
    label: 'logged_bleeding_duration';
  };
  flowPatterns?: {
    source: 'observed_flow_only';
    heavyFlowDaysPerCycle: number | null;
    spottingDayCount: number;
    flowByBleedDay: { bleedDay: number; mostCommonFlow: string | null; counts: Record<string, number> }[];
  };
  pmsByDaysBefore: { daysBefore: number; count: number; topSymptoms: { key: string; count: number }[] }[];
  pmsRecurringEligible: boolean;
  painPatterns: CyclePainPattern[];
  symptomPatterns: CycleRecurringPattern[];
  moodPatterns: CycleRecurringPattern[];
  lifestylePatterns: CycleLifestylePattern[];
  fertilityObservations: {
    label: 'user_logged';
    bbtReadingCount: number;
    bbtMin?: number | null;
    bbtMax?: number | null;
    cyclesWithPositiveOpk: number;
    eligibleCycles: number;
  };
  customTagDayCounts: { tagId: string; dayCount: number }[];
  contraceptionContext: {
    startedAt: string | null;
    doNotRetroactivelyApply: boolean;
    applyLimitedHistorically: boolean;
    cyclesBeforeCurrentMethod: number;
  };
  thresholds: {
    basicStatsMinCycles: number;
    recurringPatternMinCycles: number;
    pmsWindow: { min: number; max: number };
    patternHorizon: number;
    coverageMedium: number;
    coverageHigh: number;
  };
};

export type CyclePeriodRange = {
  start: string;
  end: string;
  lengthDays: number;
  source: 'logged';
};

export type CycleDayMark = {
  period?: boolean;
  fertile?: boolean;
  ovulation?: boolean;
  predicted?: boolean;
  estimated?: boolean;
  logged?: boolean;
  hasNote?: boolean;
  flow?: string;
  ownerClassifiedPeriod?: boolean;
  cycleDay?: number | null;
  phase?: CyclePhaseKind;
  phaseKa?: string;
  ovulationTest?: CycleTestResult | null;
  pregnancyTest?: CycleTestResult | null;
  hasBbt?: boolean;
  hasMucus?: boolean;
  hasSex?: boolean;
};

export type CyclePredictionHistoryEpisode = {
  cycleAnchorDate: string;
  actualStart: string | null;
  firstPredictedStart: string | null;
  lastPredictedStart: string | null;
  firstErrorDays: number | null;
  lastErrorDays: number | null;
  firstAbsErrorDays: number | null;
  lastAbsErrorDays: number | null;
  snapshotCount: number;
  prePeriodSnapshotCount: number;
  confidenceAtFirst: string | null;
  confidenceAtLast: string | null;
  status: 'completed' | 'open' | 'excluded';
  exclusionReason: string | null;
};

export type CyclePredictionHistory = {
  engineVersion: number;
  snapshotCount: number;
  completedCount: number;
  openCount: number;
  excludedCount: number;
  aggregateEligible: boolean;
  aggregate: { completedCount: number; typicalAbsErrorDays: number | null; basis: string } | null;
  episodes: CyclePredictionHistoryEpisode[];
  emptyReason: 'NO_SNAPSHOTS' | null;
};

export type CycleTtcPayload = {
  version: string;
  mode: CycleMode;
  ttcActive: boolean;
  capabilities: {
    live: boolean;
    showFertileEstimates: boolean;
    showFertilityLogging: boolean;
    showFertilityShortcuts: boolean;
    showFertilityHistory: boolean;
    showBbtHistory: boolean;
    showOpkHistory: boolean;
    showPregnancyTestLog: boolean;
    showTtcOverview: boolean;
  };
  range: { from: string; to: string; queryDays: number };
  cycleContext: {
    confidence: 'low' | 'medium' | 'high';
    softened: boolean;
    nextPeriodStart: string | null;
    estimated: true;
  };
  fertilityEstimate: {
    estimated: true;
    available: boolean;
    softened: boolean;
    fertileWindow: { start: string; end: string } | null;
    ovulationDate: string | null;
    unavailableReason?: string;
  };
  contraceptionConflict: boolean;
  fertilityEstimatesUnavailable: boolean;
  todayLogged: {
    opk: 'negative' | 'positive' | 'unclear' | null;
    bbt: number | null;
    mucus: string | null;
    pregnancyTest: 'negative' | 'positive' | 'unclear' | null;
    sexualActivity: boolean;
  };
  timeline: Array<{
    date: string;
    items: Array<{
      kind: 'opk' | 'bbt' | 'mucus' | 'pregnancyTest';
      result?: 'negative' | 'positive' | 'unclear';
      temperature?: number;
      unit?: string;
      value?: string;
      estimated: false;
    }>;
  }>;
  bbtHistory: Array<{ date: string; temperature: number; unit: string; source: string }>;
  bbtChartEligible: boolean;
  opkHistory: Array<{ date: string; result: 'negative' | 'positive' | 'unclear'; source: string }>;
  mucusHistory: Array<{ date: string; value: string; source: string }>;
  pregnancyTestHistory: Array<{ date: string; result: 'negative' | 'positive' | 'unclear'; source: string }>;
  honesty: {
    estimatesAreEstimates: boolean;
    observationsAreUserLogged: boolean;
    positiveOpkDoesNotConfirmOvulation: boolean;
    bbtNotInterpreted: boolean;
    mucusNotInterpreted: boolean;
    noConceptionProbability: boolean;
    pregnancyTestDoesNotChangeMode: true;
  };
};

export type CyclePregnancyCarePlannerSummary = {
  available: boolean;
  personalized: boolean;
  reviewRequired: boolean;
  catalogVersion: string;
  next: {
    id: string;
    titleKey: string;
    startWeek: number;
    endWeek: number;
    relation: 'BEFORE_WINDOW' | 'IN_WINDOW' | 'AFTER_WINDOW' | null;
    status: 'PLANNED' | 'COMPLETED' | 'DISMISSED' | 'NOT_APPLICABLE' | null;
  } | null;
};

export type CyclePregnancyCarePlanItem = {
  id: string;
  category:
    | 'APPOINTMENT'
    | 'ULTRASOUND'
    | 'LAB'
    | 'SCREENING'
    | 'VACCINATION_DISCUSSION'
    | 'EDUCATION'
    | 'BIRTH_PLANNING';
  titleKey: string;
  descriptionKey: string;
  whyKey: string;
  disclaimerKey: string | null;
  optional: boolean;
  regionalVariation: boolean;
  timing: {
    startWeek: number;
    endWeek: number;
    relation: 'BEFORE_WINDOW' | 'IN_WINDOW' | 'AFTER_WINDOW' | null;
    type: string;
  };
  plannedDateOutsideWindow: boolean;
  sources: Array<{
    organization: string;
    title: string;
    reviewedAt: string;
    url: string;
  }>;
  userState: {
    status: 'PLANNED' | 'COMPLETED' | 'DISMISSED' | 'NOT_APPLICABLE';
    plannedDate: string | null;
    plannedTime: string | null;
    plannedPlace: string | null;
    completedDate: string | null;
    note: string | null;
    reminderEnabled: boolean;
    reminderOffset: 0 | 1 | 3;
    reminderMode: 'DATE_BASED' | 'EXACT_TIME';
    exactReminderOffsetMinutes: 0 | 30 | 60 | 120 | null;
    reminderPreview?: {
      mode: 'DATE_BASED' | 'EXACT_TIME';
      fireCivilDate: string;
      fireClock: string;
      past: boolean;
    } | null;
  } | null;
};

export type CyclePregnancyCarePlan = {
  version: string;
  reviewedAt: string;
  sourceSet: string;
  available: boolean;
  personalized: boolean;
  reviewRequired: boolean;
  pregnancyActive: boolean;
  pregnancyEpisodeId?: string | null;
  offline?: boolean;
  items: CyclePregnancyCarePlanItem[];
};

export type CyclePregnancyTimelineMilestone = {
  id: string;
  week: number;
  weekRange: [number, number] | null;
  category: 'PREGNANCY_STAGE' | 'GENERAL_DEVELOPMENT' | 'MATERNAL_CHANGE' | 'CLINICAL_WINDOW';
  titleKey: string;
  bodyKey: string;
  sourceKey: string;
  status: 'PAST' | 'CURRENT' | 'UPCOMING';
};

export type CyclePregnancyTimeline = {
  version: string;
  reviewDate: string;
  sourceSet: string;
  available: boolean;
  reviewRequired: boolean;
  currentWeek: number | null;
  currentDay: number | null;
  trimester: number | null;
  progress: {
    kind: 'gestational_calendar';
    currentWeek: number;
    currentDay: number;
    ofWeeks: number;
    fraction: number | null;
  } | null;
  currentMarker: {
    week: number;
    day: number;
    railPosition: number | null;
    betweenMilestones: boolean;
  } | null;
  currentMilestoneId: string | null;
  nextMilestone: { id: string; week: number; titleKey: string; sourceKey: string } | null;
  beyondStandardTerm: boolean;
  estimatedDueDate: { date: string; estimated: true } | null;
  trimesterBands: ReadonlyArray<{ trimester: number; fromWeek: number; toWeek: number }>;
  milestones: CyclePregnancyTimelineMilestone[];
};

export type CyclePregnancyDayObservations = {
  date: string;
  spotting: boolean;
  bleeding?: 'spotting' | 'light' | 'medium' | 'heavy';
  pain: Array<{ type: CyclePainType; severity: CyclePainSeverity }>;
  symptoms: string[];
  wellness: {
    energy?: string;
    sleepQuality?: CycleSleepQuality;
    stressLevel?: CycleStressLevel;
  };
};

export type CyclePregnancyPayload = {
  version: string;
  mode: CycleMode;
  pregnancyActive: boolean;
  capabilities: {
    live: boolean;
    showFertileEstimates: boolean;
    showFertilityLogging: boolean;
    showFertilityShortcuts: boolean;
    showFertilityHistory: boolean;
    showBbtHistory: boolean;
    showOpkHistory: boolean;
    showPregnancyTestLog: boolean;
    showTtcOverview: boolean;
    showPregnancyOverview: boolean;
    showLatePeriod: boolean;
    showNextPeriodForecast: boolean;
  };
  range: { from: string; to: string; queryDays: number };
  episode: {
    id: string;
    referenceDate: string;
    referenceType: 'LMP' | 'USER_SELECTED';
    status: 'ACTIVE' | 'ENDED';
    startedAt: string | null;
    endedAt: string | null;
  } | null;
  referenceDate: string | null;
  referenceType: 'LMP' | 'USER_SELECTED' | null;
  estimatedGestationalAge: {
    week: number;
    day: number;
    dayOfPregnancy: number;
    trimester: number;
  } | null;
  estimatedDueDate: { date: string; estimated: true } | null;
  reviewRequired: boolean;
  weekDevelopment: {
    week: number;
    kind: 'informational' | 'analogy' | 'catalog';
    comparisonKey: string | null;
    lengthCm: number | null;
    weightGrams: number | null;
    measurementType: 'CRL' | 'CHL' | null;
    developmentFactKeys: string[];
    illustrationKey: string | null;
    beyondCatalog?: boolean;
    requestedWeek?: number;
    dataVersion: string;
    sourceVersion: string;
    reviewDate: string;
  } | null;
    timeline: CyclePregnancyTimeline | null;
  carePlannerSummary?: CyclePregnancyCarePlannerSummary | null;
  estimated: true;
  honesty: {
    notADiagnosis: true;
    testIsNotMode: true;
    estimated: true;
    sourceExplicit: boolean;
  };
  todayLogged: {
    flow: string | null;
    spotting: boolean;
    painEntries: CyclePainEntry[];
    symptoms: string[];
    pregnancyTest: 'negative' | 'positive' | 'unclear' | null;
    hasNotes: boolean;
  };
  todayObservations: CyclePregnancyDayObservations | null;
  spottingHistory: Array<{ date: string; flow: string; spotting: boolean; source: string }>;
  pregnancyTestHistory: Array<{
    date: string;
    result: 'negative' | 'positive' | 'unclear';
    source: string;
    doesNotConfirmMode: true;
  }>;
  recentLogs: Array<{
    date: string;
    flow: string | null;
    spotting: boolean;
    symptoms: string[];
    painEntries: CyclePainEntry[];
    pregnancyTest: 'negative' | 'positive' | 'unclear' | null;
    hasNotes: boolean;
  }>;
  recentObservations: CyclePregnancyDayObservations[];
  observationRange: { from: string | null; to: string | null; queryDays: number };
  observationTrends: CyclePregnancyObservationTrendsPayload;
};

export type CyclePostpartumPayload = {
  version: string;
  mode: CycleMode;
  active: boolean;
  capabilities: Record<string, boolean | string[] | undefined>;
  episode: {
    id: string | null;
    referenceDate: string | null;
    status: string | null;
    startedAt: string | null;
    endedAt: string | null;
  } | null;
  referenceDate: string | null;
  elapsed: { days: number; week: number; day: number } | null;
  todayObservations: {
    flow: string | null;
    painEntries: Array<{ type: CyclePainType; severity: CyclePainSeverity }>;
    symptoms: string[];
    moods: string[];
    sleepQuality: CycleSleepQuality | null;
    energy: string | null;
  };
  recentLogs: Array<{
    date: string;
    flow: string | null;
    spotting: boolean;
    symptoms: string[];
    painEntries: Array<{ type: CyclePainType; severity: CyclePainSeverity }>;
    moods: string[];
    sleepQuality: CycleSleepQuality | null;
    energy: string | null;
    hasNotes: boolean;
    classified?: boolean;
  }>;
  bleedEpisodes?: Array<{ start: string; end: string; classified: boolean }>;
  classifiedDates?: string[];
  latestClassified?: { start: string; end: string; source: 'OWNER' } | null;
  honesty: {
    notADiagnosis: boolean;
    notAnOutcome: boolean;
    referenceOwnerEntered: boolean;
    referenceOptional: boolean;
    elapsedNotRecovery: boolean;
  };
};

export type CyclePerimenopausePayload = {
  mode: 'PERIMENOPAUSE';
  capabilities: {
    live: boolean;
    showFertileEstimates: boolean;
    showFertilityLogging: boolean;
    showFertilityShortcuts: boolean;
    showFertilityHistory: boolean;
    showBbtHistory: boolean;
    showOpkHistory: boolean;
    showPregnancyTestLog: boolean;
    showTtcOverview: boolean;
    showPregnancyOverview: boolean;
    showLatePeriod: boolean;
    showNextPeriodForecast: boolean;
    showPerimenopauseTracking: boolean;
    showVariabilityContext: boolean;
  };
  recentBleedingEpisodes: Array<{
    start: string;
    end: string;
    durationDays: number | null;
    intervalDays: number | null;
    flowFacts: string[];
  }>;
  recentCycleIntervals: Array<{ from: string; to: string; days: number }>;
  variabilitySummary: {
    intervalCount: number;
    shortestDays: number | null;
    longestDays: number | null;
    recentIntervalDays: number | null;
    sourceWindow: string;
  };
  lastRecordedBleeding: { date: string; flow: string } | null;
  recentObservations: Array<{
    date: string;
    symptoms: string[];
    moods: string[];
    energy: string | null;
    sleepQuality: string | null;
    pain: Array<{ type: string; severity: string }>;
  }>;
  forecast: {
    showPreciseNextPeriod: boolean;
    nextPeriodStart: string | null;
    nextPeriodEnd: string | null;
    confidence: 'low' | 'medium' | 'high';
  };
  observationSummaries?: CyclePerimenopauseObservationSummariesPayload | null;
};

export type CycleBundle = {
  meta: {
    today: string;
    timezone: string;
  };
  cycleDay: number | null;
  phase: CyclePhaseKind;
  phaseKa: string;
  periodRanges: CyclePeriodRange[];
  averages: CycleAverages;
  partnerShare?: CyclePartnerShare;
  contraception?: CycleContraceptionContext;
  profile: CycleProfile;
  logs: CycleLog[];
  customTags?: CycleCustomTag[];
  dailyMetrics?: CycleDailyMetric[];
  observationInsights?: CycleObservationInsights;
  analytics?: CycleAnalytics;
  pregnancyLogs: PregnancyLog[];
  predictions: {
    nextPeriodStart: string | null;
    nextPeriodEnd: string | null;
    ovulationDate: string | null;
    fertileWindow: { start: string; end: string } | null;
    calendar: Record<string, CycleDayMark>;
    confidence: 'low' | 'medium' | 'high';
    estimated: true;
    phases?: {
      periodStart: string;
      periodEnd: string;
      ovulation: string;
      fertileStart: string;
      fertileEnd: string;
      nextPeriodStart: string;
    }[];
  };
  pregnancy: {
    dueDate: string | null;
    age: { week: number; day: number; dayOfPregnancy: number; trimester: number } | null;
    referenceDate: string | null;
    referenceType: 'LMP' | 'USER_SELECTED' | null;
    estimated: true;
    reviewRequired: boolean;
  } | null;
  inferred: {
    avgCycleLength: number;
    avgPeriodLength: number;
    lastPeriodStart: string | null;
    periodStarts?: string[];
  };
  trends?: {
    cycleLengths: { start: string; length: number }[];
    pmsByDay: { cycleDay: number; count: number; topSymptoms: { key: string; count: number }[] }[];
    pmsByDaysBefore?: { daysBefore: number; count: number; topSymptoms: { key: string; count: number }[] }[];
    topSymptoms90d: { key: string; count: number }[];
    bbtPoints: { date: string; bbt: number }[];
    periodStarts: string[];
    shortestCycle?: number | null;
    longestCycle?: number | null;
    variability?: number | null;
    cycleCount?: number;
    confidence?: 'low' | 'medium' | 'high';
  };
  alerts?: {
    level: 'info' | 'warn' | 'urgent';
    messageKa: string;
    action?: 'chat' | null;
    late?: { status?: string } | null;
  }[];
  perimenopause?: CyclePerimenopausePayload | null;
  classifiedDates?: string[];
  forecastEligibility?: {
    allowed: boolean;
    reason: 'STANDARD' | 'POSTPARTUM_HISTORY_INSUFFICIENT' | 'POSTPARTUM_HISTORY_READY';
  };
  postpartum?: {
    version: string;
    active: boolean;
    referenceDate: string | null;
    elapsed: { days: number; week: number; day: number } | null;
    capabilities?: Record<string, boolean | string[] | undefined>;
    classifiedDates?: string[];
    latestClassified?: { start: string; end: string; source: 'OWNER' } | null;
  } | null;
  summary: CycleDoctorSummary;
  localInsights?: CycleInsights;
};

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  formData?: FormData;
  token?: string | null;
  timeoutMs?: number;
  cache?: RequestCache;
  retryAuthConnection?: boolean;
};

/** Assistant calls keep the original account's token across consent and network awaits. */
export async function assistantRequest<T>(path: 'catalog' | 'state' | 'plan' | 'prepare' | 'execute' | 'transcribe' | 'speak', owner: string,
  body?: unknown, scope: 'human' | 'pet' | 'auto' = 'human'): Promise<T> {
  const { localAccountId } = await import('@/lib/localAccount');
  if (owner !== localAccountId()) throw new ApiError('ანგარიში შეიცვალა.', 401);
  const token = await getToken();
  if (!token || owner !== localAccountId()) throw new ApiError('გთხოვ, შეხვიდე ანგარიშში.', 401);
  const result = await request<T>(`/api/assistant/${path}${path === 'catalog' ? `?scope=${scope}` : ''}`, {
    token, method: path === 'catalog' || path === 'state' ? 'GET' : 'POST', body, timeoutMs: 120000,
  });
  if (owner !== localAccountId()) throw new ApiError('ანგარიში შეიცვალა.', 401);
  return result;
}

export async function ensureAiSharingConsentForRequest(path: string, method = 'POST', suppliedToken?: string | null, settings = false) {
  const { isAiSharingRequest, requestAiSharingPrompt } = await import('@/lib/aiSharingConsent');
  if (!settings && !isAiSharingRequest(path, method)) return;
  const { localAccountId } = await import('@/lib/localAccount');
  const owner = localAccountId(), token = suppliedToken !== undefined ? suppliedToken : await getToken();
  if (!owner || !token) throw new ApiError('გთხოვ, შეხვიდე ანგარიშში.', 401);
  const status = await request<import('@/lib/aiSharingConsent').AiConsentStatus>('/api/ai-consent', { token, timeoutMs: 15_000 });
  if (owner !== localAccountId()) throw new ApiError('ანგარიში შეიცვალა.', 401);
  if (!status.accepted || settings) {
    const accepted = await requestAiSharingPrompt(owner, status, async (decision, version) => {
      try { return await request('/api/ai-consent', { method: 'PUT', body: { decision, version }, token, timeoutMs: 15_000 }); }
      catch (error) {
        if (error instanceof ApiError && error.status === 409) {
          const consentStatus = await request<import('@/lib/aiSharingConsent').AiConsentStatus>('/api/ai-consent', { token, timeoutMs: 15_000 });
          throw Object.assign(new Error('გაზიარების პირობები განახლდა. წაიკითხე ახალი ტექსტი და ხელახლა აირჩიე.'), { consentStatus });
        }
        throw error;
      }
    }, settings);
    if (!accepted && !settings) throw new ApiError('AI-სთან მონაცემების გაზიარება არ არის ნებადართული. არჩევანის შეცვლა პროფილის პარამეტრებიდან შეგიძლია.', 403, { code: 'AI_CONSENT_DECLINED' });
  }
  if (owner !== localAccountId() || token !== await getToken()) throw new ApiError('ანგარიში შეიცვალა.', 401);
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, formData, timeoutMs = 180_000, cache } = options;
  const token = options.token !== undefined ? options.token : await getToken();
  // Check before starting upload/stream timers; the person can read at their own pace.
  if (!path.startsWith('/api/ai-consent')) await ensureAiSharingConsentForRequest(path, method, token);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const perform = async () => {
      const response = await fetch(`${API_BASE_URL}${path}`, {
        method,
        cache: cache ?? 'no-store',
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          'X-Medicard-Platform': Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web',
          'X-Medicard-App-Version': String(Constants.expoConfig?.version || ''),
          ...clientTimezoneHeaders(),
          ...(body ? { 'Content-Type': 'application/json' } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: formData ?? (body ? JSON.stringify(body) : undefined),
      });

      const text = await response.text();
      return parseJsonBody<T>(response.status, text, response.headers.get('Retry-After'));
    };
    return await (options.retryAuthConnection
      ? withAuthConnectionRetry(perform, controller.signal)
      : perform());
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if ((error as Error)?.name === 'AbortError') {
      throw new ApiError(ka.common.requestTimeout, 408);
    }
    console.warn('[api]', method, path, (error as Error)?.message ?? error);
    throw new ApiError(ka.common.networkError, 0);
  } finally {
    clearTimeout(timeout);
  }
}

function retryAfterSeconds(retryRaw: string | null | undefined): number | undefined {
  if (!retryRaw) return undefined;
  const asNumber = Number(retryRaw);
  if (Number.isFinite(asNumber) && asNumber >= 0) return Math.floor(asNumber);
  const when = Date.parse(retryRaw);
  if (!Number.isNaN(when)) return Math.max(0, Math.ceil((when - Date.now()) / 1000));
  return undefined;
}

function headerLookup(headers: Record<string, string> | undefined, name: string): string | null {
  if (!headers) return null;
  const want = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === want) return value;
  }
  return null;
}

function parseJsonBody<T>(status: number, text: string, retryRaw?: string | null): T {
  const payload = text ? safeParse(text) : {};
  if (status < 200 || status >= 300) {
    const serverError = publicApiErrorMessage(
      status,
      payload as Record<string, unknown>,
      retryRaw,
      `${ka.common.error} (${status})`,
    );
    const wait =
      retryAfterSeconds(retryRaw) ??
      (typeof (payload as { retryAfterSeconds?: number })?.retryAfterSeconds === 'number'
        ? Math.floor((payload as { retryAfterSeconds: number }).retryAfterSeconds)
        : undefined);
    throw new ApiError(serverError, status, payload as Record<string, unknown>, wait);
  }
  return payload as T;
}

type UploadFile = { uri: string; name: string; mimeType: string };

async function appendUploadFile(formData: FormData, field: string, file: UploadFile): Promise<void> {
  if (Platform.OS === 'web') {
    const blob = await (await fetch(file.uri)).blob();
    formData.append(field, blob, file.name);
    return;
  }
  formData.append(field, {
    uri: file.uri,
    name: file.name,
    type: file.mimeType,
  } as unknown as Blob);
}

/** Native file upload — RN fetch FormData often throws a fake "network" error on content:// / ph://. */
async function uploadNativeMultipart<T>(
  path: string,
  file: UploadFile,
  fieldName: string,
  parameters: Record<string, string> = {},
): Promise<T> {
  const token = await getToken();
  await ensureAiSharingConsentForRequest(path, 'POST', token);
  try {
    const task = FileSystem.createUploadTask(`${API_BASE_URL}${path}`, file.uri, {
      httpMethod: 'POST',
      uploadType: FileSystem.FileSystemUploadType.MULTIPART,
      fieldName,
      mimeType: file.mimeType,
      sessionType: FileSystem.FileSystemSessionType.FOREGROUND,
      headers: {
        Accept: 'application/json',
        'X-Medicard-Platform': Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web',
        'X-Medicard-App-Version': String(Constants.expoConfig?.version || ''),
        ...clientTimezoneHeaders(),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      parameters,
    });
    const result = await uploadWithDeadline(task);
    return parseJsonBody<T>(result.status, result.body, headerLookup(result.headers, 'Retry-After'));
  } catch (error) {
    if (error instanceof UploadTimeoutError) throw new ApiError(error.message, 408);
    if (error instanceof ApiError) throw error;
    console.warn('[api-upload]', path, (error as Error)?.message ?? error);
    throw new ApiError(ka.upload.failed, 0);
  }
}

function safeParse(text: string): Record<string, unknown> {
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

type AuthResponse = { token: string; user: User; usage: Usage };

export const api = {
  health: () => request<{ status: string }>('/health', { token: null, timeoutMs: 12_000 }),

  app: {
    status: (version: string) =>
      request<{
        settings: {
          maintenanceMode: boolean;
          maintenanceMessage: string;
          minAppVersion: string;
          forceUpdate: boolean;
          allowRegistrations: boolean;
          supportEmail: string;
          consumerPurchasesEnabled?: boolean;
        };
        client: { version: string; needsUpdate: boolean; blockedByForceUpdate: boolean };
        packages?: UserPackage[];
        mapboxToken?: string;
      }>(`/api/app/status?version=${encodeURIComponent(version)}`, { token: null, timeoutMs: 15_000 }),
  },

  auth: {
    register: (body: {
      fullName: string;
      email: string;
      password: string;
      gender?: Gender;
      /** `YYYY-MM-DD` */
      birthDate?: string;
      phone?: string;
    }) =>
      request<AuthResponse>('/api/auth/register', {
        method: 'POST',
        body,
        token: null,
        timeoutMs: 30_000,
      }),

    login: (body: { email: string; password: string }) =>
      request<AuthResponse>('/api/auth/login', { method: 'POST', body, token: null, timeoutMs: 30_000, retryAuthConnection: true }),

    phoneStart: (phone: string) =>
      request<{ sent: boolean; phone: string; message: string; devCode?: string; cooldownSec?: number }>(
        '/api/auth/phone/start',
        {
          method: 'POST',
          body: { phone },
          token: null,
          timeoutMs: 20_000,
        },
      ),

    phoneVerify: (body: { phone: string; code: string; fullName?: string }) =>
      request<AuthResponse>('/api/auth/phone/verify', { method: 'POST', body, token: null, timeoutMs: 20_000 }),

    phoneLinkStart: (phone: string) =>
      request<{ sent: boolean; phone: string; message: string; devCode?: string; cooldownSec?: number }>(
        '/api/auth/phone/link/start',
        {
          method: 'POST',
          body: { phone },
          timeoutMs: 20_000,
        },
      ),

    phoneLinkVerify: (phone: string, code: string) =>
      request<{ ok: boolean; user: User }>('/api/auth/phone/link/verify', {
        method: 'POST',
        body: { phone, code },
        timeoutMs: 20_000,
      }),

    passwordForgot: (email: string) =>
      request<{ sent: boolean; message: string; devCode?: string }>('/api/auth/password/forgot', {
        method: 'POST',
        body: { email },
        token: null,
        timeoutMs: 20_000,
      }),

    passwordReset: (body: { email: string; code: string; password: string; confirmPassword: string }) =>
      request<{ ok: boolean; message: string }>('/api/auth/password/reset', {
        method: 'POST',
        body,
        token: null,
        timeoutMs: 20_000,
      }),

    me: (token?: string | null) =>
      request<{
        user: User;
        usage: Usage;
        stats: { records: number; chats: number; activeMedications: number };
        healthProfile: HealthProfile | null;
        checkIn?: CheckInState | null;
        checkInAwarded?: boolean;
        pointsAwarded?: number;
      }>('/api/auth/me', {
        ...(token !== undefined ? { token } : {}),
        timeoutMs: 20_000,
        retryAuthConnection: true,
      }),

    updateProfile: (body: {
      fullName?: string;
      gender?: Gender;
      birthDate?: string;
      aiEngine?: AiEngineId;
    }) =>
      request<{ user: User }>('/api/auth/me', { method: 'PATCH', body }),

    deleteAccount: () => request<{ ok: boolean }>('/api/auth/me', { method: 'DELETE', timeoutMs: 20_000 }),
  },

  usage: {
    get: () => request<Usage & { label: string }>('/api/usage'),
  },

  checkIn: {
    get: () => request<{ checkIn: CheckInState }>('/api/check-in'),
    claim: () =>
      request<{
        awarded: boolean;
        pointsAwarded: number;
        user: User | null;
        checkIn: CheckInState | null;
      }>('/api/check-in/claim', { method: 'POST' }),
    awardStepsGoal: (goalId: string) =>
      request<{
        awarded: boolean;
        pointsAwarded: number;
        user: User | null;
      }>('/api/check-in/steps-goal', { method: 'POST', body: { goalId } }),
  },

  healthProfile: {
    get: () => request<{ profile: HealthProfile | null }>('/api/health-profile', { timeoutMs: 15_000 }),
    update: (body: Record<string, unknown>) =>
      request<{ profile: HealthProfile; user?: User }>('/api/health-profile', {
        method: 'PUT',
        body,
      }),
    complete: (body: {
      gender: Gender;
      birthDate: string;
      heightCm: number;
      weightKg: number;
    }) =>
      request<{ profile: HealthProfile; user: User }>('/api/health-profile/complete', {
        method: 'POST',
        body,
      }),
    onboardingAnalysis: (opts?: { force?: boolean }) =>
      request<{
        analysis: import('@/types/onboardingAnalysis').OnboardingAnalysis;
        profile: HealthProfile;
        cached: boolean;
      }>('/api/health-profile/onboarding-analysis', {
        method: 'POST',
        body: { force: Boolean(opts?.force) },
        timeoutMs: 120_000,
      }),
  },

  account: {
    getAppState: () => request<{ state: AccountAppState }>('/api/account/app-state', { timeoutMs: 30_000 }),
    putAppState: (body: Partial<AccountAppState>) =>
      request<{ state: AccountAppState }>('/api/account/app-state', { method: 'PUT', body, timeoutMs: 30_000 }),
  },

  healthMetrics: {
    sync: (body: import('@/lib/healthMetricsStorage').HealthMetricsSyncPayload) =>
      request<{ ok: boolean; dailyUpserted: number; stepLogsInserted: number; syncedAt: string }>(
        '/api/health-metrics/sync',
        { method: 'POST', body, timeoutMs: 30_000 },
      ),
    hydrationGoalGet: () =>
      request<{ goalMl: number | null; updatedAt: string | null }>('/api/health-metrics/hydration/goal'),
    hydrationGoalPut: (goalMl: number) =>
      request<{ goalMl: number; updatedAt: string }>('/api/health-metrics/hydration/goal', {
        method: 'PUT',
        body: { goalMl },
      }),
    stepCapabilityGet: () =>
      request<{ status: string; source: string; updatedAt: string | null }>('/api/health-metrics/steps/capability'),
    stepCapabilityPut: (body: { status: string; source?: string }) =>
      request<{ status: string; source: string; updatedAt: string }>('/api/health-metrics/steps/capability', {
        method: 'PUT',
        body,
      }),
    get: (params?: { from?: string; to?: string }) => {
      const qs = new URLSearchParams();
      if (params?.from) qs.set('from', params.from);
      if (params?.to) qs.set('to', params.to);
      const q = qs.toString();
      return request<{
        daily: import('@/lib/healthMetricsStorage').StoredHealthDaily[];
        stepLogs: import('@/lib/healthMetricsStorage').StoredStepLog[];
      }>(`/api/health-metrics${q ? `?${q}` : ''}`, { timeoutMs: 20_000 });
    },
  },

  push: {
    register: (body: { token: string; platform: 'ios' | 'android' | 'web' }) =>
      request<{ ok: boolean }>('/api/push/register', { method: 'POST', body }),
    unregister: (token: string) =>
      request<{ ok: boolean }>('/api/push/register', { method: 'DELETE', body: { token } }),
    templates: () =>
      request<{
        templates: Array<{
          key: string;
          group: string;
          label: string;
          title: string;
          body: string;
          placeholders: string[];
        }>;
      }>('/api/push/templates'),
    logEvent: (body: { source: 'local' | 'qa' | 'broadcast'; key: string; title: string; body: string }) =>
      request<{ ok: boolean; id: string | null }>('/api/push/events', { method: 'POST', body }),
    syncDecisions: (body: {
      decisions: Array<{
        id?: string;
        decisionId?: string;
        candidate?: string;
        family?: string;
        score?: number;
        result?: string;
        decision?: string;
        reason?: string | null;
        blocked?: string | null;
        template?: string;
        templateKey?: string;
        route?: string;
        createdAt?: string;
        scheduledAt?: string | null;
        fireAt?: string | null;
        revalidatedAt?: string;
      }>;
      fatigue?: {
        selectedFrequency?: string;
        baseDailyCap?: number;
        adaptiveDailyCap?: number;
        ewma?: number;
      };
    }) => request<{ ok: boolean; upserted: number; received: number }>('/api/push/decisions', { method: 'POST', body }),
    syncOutcomes: (body: {
      outcomes: Array<{
        decisionId?: string;
        outcome?: string;
        actionKey?: string;
        action?: string;
        occurredAt?: string;
      }>;
    }) => request<{ ok: boolean; upserted: number; received: number; duplicates?: number }>('/api/push/outcomes', { method: 'POST', body }),
    syncPermission: (body: { status: 'enabled' | 'disabled' | 'provisional' | 'unknown'; platform?: 'ios' | 'android' | 'web' }) =>
      request<{ ok: boolean; changed?: boolean; status?: string }>('/api/push/permission', { method: 'POST', body }),
    syncProductEvents: (body: {
      events: Array<{
        kind: string;
        category?: string;
        entityId?: string;
        weekKey?: string;
        insightId?: string;
        source?: string;
        occurredAt?: string;
      }>;
    }) => request<{ ok: boolean; upserted: number }>('/api/push/events/product', { method: 'POST', body }),
    syncDoseEvents: (body: {
      events: Array<{
        medicationId: string;
        date: string;
        time: string;
        status: 'taken' | 'skipped';
        source?: 'app' | 'notification';
        occurredAt?: string;
      }>;
    }) => request<{ ok: boolean; upserted: number }>('/api/push/dose-events', { method: 'POST', body }),
  },

  activity: {
    ping: (activityType?: string) =>
      request<{ ok: boolean }>('/api/check-in/session', {
        method: 'POST',
        body: activityType ? { activityType } : {},
      }),
  },

  location: {
    get: () =>
      request<{ ok: boolean; location: UserLocationSnapshot; profile: HealthProfile | null }>('/api/location'),
    ping: (body: {
      lat?: number;
      lng?: number;
      accuracy?: number | null;
      fixAt?: number;
      enabled?: boolean;
      prompted?: boolean;
      source?: 'grant' | 'skip' | 'heartbeat' | 'watch' | 'revoke';
      timeZone?: string;
      place?: { countryCode: string | null; countryKa: string | null; cityKa: string | null };
    }, token?: string | null) =>
      request<{ ok: boolean; location: UserLocationSnapshot; profile: HealthProfile | null }>('/api/location', {
        method: 'POST',
        body,
        token,
        timeoutMs: 20_000,
      }),
  },

  ai: {
    engines: () =>
      request<{
        selected: AiEngineId;
        engines: Array<{
          id: AiEngineId;
          provider: 'openrouter' | 'evidencemd';
          model: string;
          recommended: boolean;
        }>;
      }>('/api/ai/engines'),

    query: (body: { message: string; mode?: 'DOCTOR' | 'CONSILIUM'; sessionId?: string; context?: string }) =>
      request<{
        sessionId: string;
        title: string;
        mode: 'DOCTOR' | 'CONSILIUM';
        answer: string;
        model: string;
        engine?: string;
        interactionId: string;
        usage: Usage;
      }>('/api/ai/query', { method: 'POST', body }),

    feedback: (body: { interactionId: string; rating: 1 | -1 }) =>
      request<{ feedback: { id: string; rating: number } }>('/api/ai/feedback', { method: 'POST', body }),

    symptomCheck: (body: import('@/types/symptoms').SymptomCheckPayload) =>
      request<{
        recordId: string;
        result: import('@/types/symptoms').SymptomCheckResult;
        interactionId: string;
        usage: Usage;
      }>('/api/ai/symptom-check', { method: 'POST', body }),

    symptomResult: (recordId: string) =>
      request<{
        recordId: string;
        result: import('@/types/symptoms').SymptomCheckResult;
        input?: import('@/types/symptoms').SymptomCheckPayload;
      }>(`/api/ai/symptom-result/${recordId}`),

    extractLab: async (params: {
      files: Array<{ uri: string; name: string; mimeType: string }>;
      context?: string;
      recordId?: string;
      append?: boolean;
    }) => {
      type ExtractLabResponse = {
        record: MedicalRecord;
        notes: string;
        labExtract: import('@/types/lab').LabExtract;
        pipeline: { extractor: { provider: string; model?: string }; reasoning: null };
        usage: Usage;
      };
      const extra: Record<string, string> = {};
      if (params.context) extra.context = params.context;
      if (params.recordId) extra.recordId = params.recordId;
      if (params.append) extra.append = '1';

      if (Platform.OS !== 'web' && params.files.length === 1) {
        return uploadNativeMultipart<ExtractLabResponse>('/api/ai/extract-lab', params.files[0], 'files', extra);
      }

      const formData = new FormData();
      for (const file of params.files) {
        await appendUploadFile(formData, 'files', file);
      }
      for (const [key, value] of Object.entries(extra)) {
        formData.append(key, value);
      }
      return request<ExtractLabResponse>('/api/ai/extract-lab', { method: 'POST', formData });
    },

    alignLab: (analytes: Array<{ key: string; nameKa: string; nameEn: string; unit: string }>) =>
      request<{
        maps: Array<{ from: string; to: string; nameKa: string; nameEn: string }>;
        joined: number;
        already: number;
        leftover: string[];
        model: string;
        engine: string;
        usage: Usage;
      }>('/api/ai/align-lab', { method: 'POST', body: { analytes }, timeoutMs: 90_000 }),

    weightAdvice: (body: {
      weightKg: number;
      heightCm?: number;
      bmi?: number;
      category?: 'underweight' | 'normal' | 'overweight' | 'obese';
      targetKg?: number;
    }) =>
      request<{ blurb: string; tips: string[]; model: string; usage: Usage }>('/api/ai/weight-advice', {
        method: 'POST',
        body,
        timeoutMs: 45_000,
      }),

    explainLab: (body: {
      parameters: import('@/types/lab').LabParameter[];
      visionNotes?: string;
      date?: string;
      context?: string;
      recordId?: string;
    }) =>
      request<{ analysis: string; interactionId: string; usage: Usage }>('/api/ai/explain-lab', {
        method: 'POST',
        body,
      }),

    analyzeImage: async (params: {
      uri: string;
      name: string;
      mimeType: string;
      kind: 'LAB' | 'IMAGING' | 'SKIN';
      context?: string;
    }) => {
      type AnalyzeImageResponse = {
        record: MedicalRecord;
        analysis: string;
        labExtract?: import('@/types/lab').LabExtract | null;
        pipeline: { extractor: { provider: string; model: string }; reasoning: { provider: string; model: string } };
        usage: Usage;
      };
      const file = { uri: params.uri, name: params.name, mimeType: params.mimeType };
      const extra: Record<string, string> = { kind: params.kind };
      if (params.context) extra.context = params.context;

      if (Platform.OS !== 'web') {
        return uploadNativeMultipart<AnalyzeImageResponse>('/api/ai/analyze-image', file, 'file', extra);
      }

      const formData = new FormData();
      await appendUploadFile(formData, 'file', file);
      formData.append('kind', params.kind);
      if (params.context) formData.append('context', params.context);
      return request<AnalyzeImageResponse>('/api/ai/analyze-image', { method: 'POST', formData });
    },

    skincare: (body: { skinType: string; concerns: string[]; age?: number; currentProducts?: string }) =>
      request<{ recordId: string; analysis: string; usage: Usage }>('/api/ai/skincare', {
        method: 'POST',
        body,
      }),

    medicationReview: () =>
      request<{ analysis: string; medicationCount: number; usage: Usage }>('/api/ai/medication-review', {
        method: 'POST',
      }),
  },

  chats: {
    list: () => request<{ sessions: ChatSummary[] }>('/api/chats'),
    get: (id: string) =>
      request<{ session: { id: string; title: string; mode: 'DOCTOR' | 'CONSILIUM'; messages: ChatMessage[] } }>(
        `/api/chats/${id}`,
      ),
    remove: (id: string) => request<{ deleted: boolean }>(`/api/chats/${id}`, { method: 'DELETE' }),
  },

  records: {
    list: (type?: string) =>
      request<{ records: MedicalRecord[]; total: number }>(`/api/records${type ? `?type=${type}` : ''}`),
    get: (id: string) => request<{ record: MedicalRecord }>(`/api/records/${id}`),
    remove: (id: string) => request<{ deleted: boolean }>(`/api/records/${id}`, { method: 'DELETE' }),
  },

  medications: {
    list: () => request<{ medications: Medication[]; schedule: ScheduledDose[] }>('/api/medications'),
    create: (body: {
      medName: string;
      dosage: string;
      frequency: string;
      notes?: string;
      active?: boolean;
      config?: Record<string, unknown>;
    }) => request<{ medication: Medication }>('/api/medications', { method: 'POST', body }),
    update: (
      id: string,
      body: Partial<{
        medName: string;
        dosage: string;
        frequency: string;
        notes: string;
        active: boolean;
        config: Record<string, unknown>;
      }>,
    ) =>
      request<{ medication: Medication }>(`/api/medications/${id}`, { method: 'PATCH', body }),
    remove: (id: string) => request<{ deleted: boolean }>(`/api/medications/${id}`, { method: 'DELETE' }),
  },

  visits: {
    list: () => request<{ visits: DoctorVisit[] }>('/api/visits'),
    create: (body: {
      doctorType: DoctorTypeCode;
      doctorFirstName?: string;
      doctorLastName?: string;
      visitDate: string;
      visitTime: string;
      address?: string;
      addressLabel?: string;
      lat?: number;
      lng?: number;
      notes?: string;
      reminderConfig?: VisitReminderConfig;
      active?: boolean;
    }) => request<{ visit: DoctorVisit }>('/api/visits', { method: 'POST', body }),
    update: (
      id: string,
      body: Partial<{
        doctorType: DoctorTypeCode;
        doctorFirstName: string;
        doctorLastName: string;
        visitDate: string;
        visitTime: string;
        address: string;
        addressLabel: string;
        lat: number;
        lng: number;
        notes: string;
        reminderConfig: VisitReminderConfig;
        active: boolean;
      }>,
    ) => request<{ visit: DoctorVisit }>(`/api/visits/${id}`, { method: 'PATCH', body }),
    remove: (id: string) => request<{ deleted: boolean }>(`/api/visits/${id}`, { method: 'DELETE' }),
    geocode: (q: string) =>
      request<{ results: GeocodeResult[] }>(`/api/visits/geocode?q=${encodeURIComponent(q)}`),
  },

  pets: {
    catalog: () => request<PetsCatalog>('/api/pets/catalog'),
    clinics: () => request<PetClinicsDirectory>('/api/pets/clinics'),
    list: () => request<{ schemaReady: boolean; pets: Pet[] }>('/api/pets'),
    create: (body: PetWriteBody) => request<{ schemaReady: boolean; pet: Pet }>('/api/pets', { method: 'POST', body }),
    get: (id: string) => request<{ schemaReady: boolean; pet: Pet }>(`/api/pets/${id}`),
    update: (id: string, body: Partial<PetWriteBody>) =>
      request<{ schemaReady: boolean; pet: Pet }>(`/api/pets/${id}`, { method: 'PATCH', body }),
    archive: (id: string) => request<{ schemaReady: boolean; archived: boolean }>(`/api/pets/${id}/archive`, { method: 'POST' }),
    uploadPhoto: (id: string, file: UploadFile) =>
      uploadNativeMultipart<{ schemaReady: boolean; pet: Pet }>(`/api/pets/${id}/photo`, file, 'file'),
    removePhoto: (id: string) =>
      request<{ schemaReady: boolean; pet: Pet }>(`/api/pets/${id}/photo`, { method: 'DELETE' }),
    weight: {
      list: (petId: string, params?: { limit?: number; offset?: number }) => {
        const qs = new URLSearchParams();
        if (params?.limit) qs.set('limit', String(params.limit));
        if (params?.offset) qs.set('offset', String(params.offset));
        const query = qs.toString();
        return request<{
          schemaReady: boolean;
          healthSchemaReady: boolean;
          latest: PetWeightLog | null;
          items: PetWeightLog[];
          total: number;
          limit: number;
          offset: number;
        }>(`/api/pets/${petId}/weight${query ? `?${query}` : ''}`);
      },
      create: (petId: string, body: PetWeightWrite) =>
        request<{ schemaReady: boolean; healthSchemaReady: boolean; replayed?: boolean; log: PetWeightLog }>(
          `/api/pets/${petId}/weight`,
          { method: 'POST', body },
        ),
      get: (petId: string, logId: string) =>
        request<{ schemaReady: boolean; healthSchemaReady: boolean; log: PetWeightLog }>(
          `/api/pets/${petId}/weight/${logId}`,
        ),
      update: (petId: string, logId: string, body: Partial<PetWeightWrite>) =>
        request<{ schemaReady: boolean; healthSchemaReady: boolean; log: PetWeightLog }>(
          `/api/pets/${petId}/weight/${logId}`,
          { method: 'PATCH', body },
        ),
      remove: (petId: string, logId: string) =>
        request<{ schemaReady: boolean; healthSchemaReady: boolean; deleted: boolean; latest: PetWeightLog | null }>(
          `/api/pets/${petId}/weight/${logId}`,
          { method: 'DELETE' },
        ),
    },
    allergies: {
      list: (petId: string) =>
        request<{ schemaReady: boolean; healthSchemaReady: boolean; items: PetAllergy[] }>(
          `/api/pets/${petId}/allergies`,
        ),
      create: (petId: string, body: PetAllergyWrite) =>
        request<{ schemaReady: boolean; healthSchemaReady: boolean; replayed?: boolean; allergy: PetAllergy }>(
          `/api/pets/${petId}/allergies`,
          { method: 'POST', body },
        ),
      get: (petId: string, allergyId: string) =>
        request<{ schemaReady: boolean; healthSchemaReady: boolean; allergy: PetAllergy }>(
          `/api/pets/${petId}/allergies/${allergyId}`,
        ),
      update: (petId: string, allergyId: string, body: Partial<PetAllergyWrite>) =>
        request<{ schemaReady: boolean; healthSchemaReady: boolean; allergy: PetAllergy }>(
          `/api/pets/${petId}/allergies/${allergyId}`,
          { method: 'PATCH', body },
        ),
      remove: (petId: string, allergyId: string) =>
        request<{ schemaReady: boolean; healthSchemaReady: boolean; deleted: boolean }>(
          `/api/pets/${petId}/allergies/${allergyId}`,
          { method: 'DELETE' },
        ),
    },
    conditions: {
      list: (petId: string) =>
        request<{ schemaReady: boolean; healthSchemaReady: boolean; items: PetCondition[] }>(
          `/api/pets/${petId}/conditions`,
        ),
      create: (petId: string, body: PetConditionWrite) =>
        request<{ schemaReady: boolean; healthSchemaReady: boolean; replayed?: boolean; condition: PetCondition }>(
          `/api/pets/${petId}/conditions`,
          { method: 'POST', body },
        ),
      get: (petId: string, conditionId: string) =>
        request<{ schemaReady: boolean; healthSchemaReady: boolean; condition: PetCondition }>(
          `/api/pets/${petId}/conditions/${conditionId}`,
        ),
      update: (petId: string, conditionId: string, body: Partial<PetConditionWrite>) =>
        request<{ schemaReady: boolean; healthSchemaReady: boolean; condition: PetCondition }>(
          `/api/pets/${petId}/conditions/${conditionId}`,
          { method: 'PATCH', body },
        ),
      remove: (petId: string, conditionId: string) =>
        request<{ schemaReady: boolean; healthSchemaReady: boolean; deleted: boolean }>(
          `/api/pets/${petId}/conditions/${conditionId}`,
          { method: 'DELETE' },
        ),
    },
    products: {
      list: (petId: string) =>
        request<{ schemaReady: boolean; careSchemaReady: boolean; items: PetProduct[] }>(`/api/pets/${petId}/products`),
      create: (petId: string, body: PetProductWrite) =>
        request<{ schemaReady: boolean; careSchemaReady: boolean; replayed?: boolean; product: PetProduct }>(
          `/api/pets/${petId}/products`,
          { method: 'POST', body },
        ),
      get: (petId: string, productId: string) =>
        request<{ schemaReady: boolean; careSchemaReady: boolean; product: PetProduct }>(
          `/api/pets/${petId}/products/${productId}`,
        ),
      update: (petId: string, productId: string, body: Partial<PetProductWrite>) =>
        request<{ schemaReady: boolean; careSchemaReady: boolean; product: PetProduct }>(
          `/api/pets/${petId}/products/${productId}`,
          { method: 'PATCH', body },
        ),
      archive: (petId: string, productId: string) =>
        request<{ schemaReady: boolean; careSchemaReady: boolean; archived: boolean; product: PetProduct }>(
          `/api/pets/${petId}/products/${productId}/archive`,
          { method: 'POST' },
        ),
    },
    schedules: {
      list: (petId: string) =>
        request<{ schemaReady: boolean; careSchemaReady: boolean; items: PetCareSchedule[] }>(
          `/api/pets/${petId}/schedules`,
        ),
      create: (petId: string, body: PetCareScheduleWrite) =>
        request<{ schemaReady: boolean; careSchemaReady: boolean; replayed?: boolean; schedule: PetCareSchedule }>(
          `/api/pets/${petId}/schedules`,
          { method: 'POST', body },
        ),
      get: (petId: string, scheduleId: string) =>
        request<{ schemaReady: boolean; careSchemaReady: boolean; schedule: PetCareSchedule }>(
          `/api/pets/${petId}/schedules/${scheduleId}`,
        ),
      update: (petId: string, scheduleId: string, body: Partial<PetCareScheduleWrite>) =>
        request<{ schemaReady: boolean; careSchemaReady: boolean; schedule: PetCareSchedule }>(
          `/api/pets/${petId}/schedules/${scheduleId}`,
          { method: 'PATCH', body },
        ),
      cancel: (petId: string, scheduleId: string) =>
        request<{ schemaReady: boolean; careSchemaReady: boolean; schedule: PetCareSchedule }>(
          `/api/pets/${petId}/schedules/${scheduleId}/cancel`,
          { method: 'POST' },
        ),
      complete: (petId: string, scheduleId: string, body: PetCareCompleteWrite) =>
        request<{
          schemaReady: boolean;
          careSchemaReady: boolean;
          replayed?: boolean;
          event: PetCareEvent;
          schedule: PetCareSchedule;
          occurrence: PetCareOccurrence;
        }>(`/api/pets/${petId}/schedules/${scheduleId}/complete`, { method: 'POST', body }),
      skip: (petId: string, scheduleId: string, body: { occurrenceKey: string; revision: number; clientRequestId?: string; note?: string }) =>
        request<{
          schemaReady: boolean;
          careSchemaReady: boolean;
          replayed?: boolean;
          occurrence: PetCareOccurrence;
          schedule: PetCareSchedule;
        }>(`/api/pets/${petId}/schedules/${scheduleId}/skip`, { method: 'POST', body }),
      reminders: (petId: string, scheduleId: string, body: { reminderEnabled: boolean; reminderOffsetsDays?: number[] }) =>
        request<{ schemaReady: boolean; careSchemaReady: boolean; revisionUnchanged?: boolean; schedule: PetCareSchedule }>(
          `/api/pets/${petId}/schedules/${scheduleId}/reminders`,
          { method: 'PATCH', body },
        ),
    },
    care: {
      upcoming: (petId: string) =>
        request<{
          schemaReady: boolean;
          careSchemaReady: boolean;
          overdue: PetCareOccurrence[];
          due: PetCareOccurrence[];
          upcoming: PetCareOccurrence[];
          plannedDisclaimer: boolean;
        }>(`/api/pets/${petId}/care/upcoming`),
    },
    reminders: {
      feed: () =>
        request<{
          schemaReady: boolean;
          careSchemaReady: boolean;
          items: Array<{
            petId: string;
            petName: string;
            petArchived?: boolean;
            schedule: PetCareSchedule;
            occurrence: PetCareOccurrence;
          }>;
          fetchedAt?: string;
        }>('/api/pets/reminders/feed'),
      delivery: (
        petId: string,
        scheduleId: string,
        body: {
          occurrenceKey: string;
          alertKind: string;
          identity: string;
          installId: string;
          status: string;
          fireAtMs?: number;
        },
      ) =>
        request<{ schemaReady: boolean; careSchemaReady: boolean; reminderSchemaReady?: boolean; accepted?: boolean }>(
          `/api/pets/${petId}/schedules/${scheduleId}/reminder-delivery`,
          { method: 'POST', body },
        ),
    },
    events: {
      list: (petId: string, params?: { limit?: number; offset?: number }) => {
        const qs = new URLSearchParams();
        if (params?.limit) qs.set('limit', String(params.limit));
        if (params?.offset) qs.set('offset', String(params.offset));
        const query = qs.toString();
        return request<{
          schemaReady: boolean;
          careSchemaReady: boolean;
          items: PetCareEvent[];
          total: number;
          limit: number;
          offset: number;
        }>(`/api/pets/${petId}/events${query ? `?${query}` : ''}`);
      },
      create: (petId: string, body: PetCareEventWrite) =>
        request<{ schemaReady: boolean; careSchemaReady: boolean; replayed?: boolean; event: PetCareEvent }>(
          `/api/pets/${petId}/events`,
          { method: 'POST', body },
        ),
      get: (petId: string, eventId: string) =>
        request<{ schemaReady: boolean; careSchemaReady: boolean; event: PetCareEvent }>(
          `/api/pets/${petId}/events/${eventId}`,
        ),
      update: (petId: string, eventId: string, body: Partial<PetCareEventWrite> & { confirmRecalculate?: boolean }) =>
        request<{ schemaReady: boolean; careSchemaReady: boolean; event: PetCareEvent }>(
          `/api/pets/${petId}/events/${eventId}`,
          { method: 'PATCH', body },
        ),
      void: (petId: string, eventId: string, body?: { reason?: string; confirmRecalculate?: boolean }) =>
        request<{ schemaReady: boolean; careSchemaReady: boolean; event: PetCareEvent }>(
          `/api/pets/${petId}/events/${eventId}/void`,
          { method: 'POST', body },
        ),
    },
    chats: {
      list: (petId: string) =>
        request<{ schemaReady: boolean; chatSchemaReady: boolean; sessions: PetChatSession[] }>(`/api/pets/${petId}/chats`),
      create: (petId: string) =>
        request<{ schemaReady: boolean; chatSchemaReady: boolean; session: PetChatSession }>(`/api/pets/${petId}/chats`, {
          method: 'POST',
        }),
      get: (petId: string, sessionId: string) =>
        request<{ schemaReady: boolean; chatSchemaReady: boolean; session: PetChatSession }>(
          `/api/pets/${petId}/chats/${sessionId}`,
        ),
      messages: (petId: string, sessionId: string, params?: { limit?: number; before?: string }) => {
        const qs = new URLSearchParams();
        if (params?.limit) qs.set('limit', String(params.limit));
        if (params?.before) qs.set('before', params.before);
        const query = qs.toString();
        return request<{ schemaReady: boolean; chatSchemaReady: boolean; messages: PetChatMessage[] }>(
          `/api/pets/${petId}/chats/${sessionId}/messages${query ? `?${query}` : ''}`,
        );
      },
      remove: (petId: string, sessionId: string) =>
        request<{ schemaReady: boolean; chatSchemaReady: boolean; deleted: boolean }>(
          `/api/pets/${petId}/chats/${sessionId}`,
          { method: 'DELETE' },
        ),
      query: (
        petId: string,
        body: { message: string; sessionId?: string; clientRequestId: string; stream?: boolean },
      ) =>
        request<{
          schemaReady: boolean;
          chatSchemaReady: boolean;
          replayed?: boolean;
          sessionId: string;
          answer: string;
          status: string;
          citations?: PetChatCitation[];
          draft?: PetCareDraft | null;
          grounding?: { status?: string; sourceIds?: string[] } | null;
          usage: Usage;
        }>(`/api/pets/${petId}/chat/query`, { method: 'POST', body }),
    },
  },

  pharmacy: {
    categories: () => request<{ categories: DrugCategoryInfo[] }>('/api/pharmacy/categories'),
    products: (params?: { category?: string; q?: string; sort?: string; page?: number; limit?: number }) => {
      const qs = new URLSearchParams();
      if (params?.category) qs.set('category', params.category);
      if (params?.q) qs.set('q', params.q);
      if (params?.sort) qs.set('sort', params.sort);
      if (params?.page) qs.set('page', String(params.page));
      if (params?.limit) qs.set('limit', String(params.limit));
      const query = qs.toString();
      return request<{ products: CatalogProductSummary[]; pagination: { page: number; limit: number; total: number; pages: number } }>(
        `/api/pharmacy/products${query ? `?${query}` : ''}`,
      );
    },
    product: (id: string) => request<{ product: CatalogProductDetail }>(`/api/pharmacy/products/${id}`),
    syncMeta: () =>
      request<{
        sources: Record<string, { finishedAt: string; itemsFetched: number } | null>;
        catalog?: { products: number; offers: number; comparedProducts: number; offersBySource: Record<string, number> };
      }>('/api/pharmacy/meta/sync'),
  },

  cycle: {
    get: (opts?: { timeoutMs?: number }) =>
      request<CycleBundle>('/api/cycle', { timeoutMs: opts?.timeoutMs ?? 20_000, cache: 'no-store' }),
    exportData: () =>
      request<{
        format: string;
        exportedAt: string;
        includesJournal: boolean;
        profile: Record<string, unknown>;
        logs: CycleLog[];
        customTags: CycleCustomTag[];
        periodStarts: string[];
        periodRanges: CyclePeriodRange[];
        contraception: { method: string | null; startedAt: string | null; label: string };
        pregnancyLogs: PregnancyLog[];
      }>('/api/cycle/export', { cache: 'no-store' }),
    wipeData: () =>
      request<{ ok: true; deleted: Record<string, number>; bundle: CycleBundle }>('/api/cycle/wipe', {
        method: 'POST',
        body: { confirm: 'DELETE_CYCLE_DATA' },
        timeoutMs: 30_000,
      }),
    setLastPeriod: (date: string) =>
      request<CycleBundle>('/api/cycle/last-period', { method: 'POST', body: { date } }),
    updateProfile: (body: Partial<{
      mode: CycleMode;
      avgCycleLength: number;
      avgPeriodLength: number;
      lastPeriodStart: string | null;
      contraceptionMethod: CycleContraceptionMethod | null;
      contraceptionStartedAt: string | null;
      isIrregular: boolean;
      dueDate: string | null;
      pregnancyReferenceDate: string;
      pregnancyReferenceType: 'LMP' | 'USER_SELECTED';
      pregnancyConfirm: true;
      postpartumConfirm: true;
      postpartumReferenceDate: string | null;
      privacyEnabled: boolean;
      enablePartnerShare: boolean;
      sharePermissions: Partial<CycleSharePermissions>;
      conditions: CycleCondition[];
      reminderPrefs: CycleReminderPrefsServer;
    }>) => request<CycleBundle>('/api/cycle/profile', { method: 'PUT', body }),
    createShare: (permissions?: Partial<CycleSharePermissions>) =>
      request<CycleBundle>('/api/cycle/share', { method: 'POST', body: { permissions } }),
    updateShare: (permissions: Partial<CycleSharePermissions>) =>
      request<CycleBundle>('/api/cycle/share', { method: 'PATCH', body: { permissions } }),
    revokeShare: () => request<CycleBundle>('/api/cycle/share', { method: 'DELETE' }),
    acceptShare: (code: string) =>
      request<{ ok: true }>(`/api/cycle/share/${code}/accept`, { method: 'POST', body: {} }),
    peekShare: (code: string) =>
      request<CyclePartnerPayload>(`/api/cycle/share/${code}`, { cache: 'no-store' }),
    upsertLog: (
      date: string,
      body: Partial<{
        flow: string | null;
        symptoms: string[];
        moods: string[];
        sexualActivity: boolean | null;
        libido: number | null;
        bbt: number | null;
        cervicalMucus: string | null;
        ovulationTest: CycleTestResult | null;
        pregnancyTest: CycleTestResult | null;
        notes: string | null;
        painEntries: CyclePainEntry[];
        sleepQuality: CycleSleepQuality | null;
        stressLevel: CycleStressLevel | null;
        exerciseLevel: CycleExerciseLevel | null;
        caffeine: CycleCaffeineLevel | null;
        alcohol: CycleAlcoholLevel | null;
        customTagIds: string[];
        observations: { energy?: CycleEnergyLevel | null } | null;
        energy: CycleEnergyLevel | null;
        observationAssessments: Record<string, 'ABSENT'>;
      }>,
      opts?: { timeoutMs?: number },
    ) =>
      request<{ log: CycleLog; bundle: CycleBundle }>(`/api/cycle/logs/${date}`, {
        method: 'PUT',
        body,
        timeoutMs: opts?.timeoutMs ?? 30_000,
      }),
    removeLog: (date: string, opts?: { timeoutMs?: number }) =>
      request<CycleBundle>(`/api/cycle/logs/${date}`, {
        method: 'DELETE',
        timeoutMs: opts?.timeoutMs ?? 30_000,
      }),
    applyPeriod: (
      body: {
        action: 'start' | 'end' | 'fill';
        date?: string;
        start?: string;
        end?: string;
        flow?: 'light' | 'medium' | 'heavy';
      },
      opts?: { timeoutMs?: number },
    ) =>
      request<CycleBundle>('/api/cycle/period', {
        method: 'PUT',
        body,
        timeoutMs: opts?.timeoutMs ?? 30_000,
      }),
    upsertPregnancy: (
      date: string,
      body: Partial<{
        currentWeek: number | null;
        weightKg: number | null;
        symptoms: string[];
        kickCount: number;
        notes: string | null;
      }>,
    ) => request<{ log: PregnancyLog; bundle: CycleBundle }>(`/api/cycle/pregnancy/${date}`, { method: 'PUT', body }),
    createTag: (body: { name: string; id?: string }) =>
      request<{ tag: CycleCustomTag; bundle: CycleBundle }>('/api/cycle/tags', {
        method: 'POST',
        body,
        timeoutMs: 30_000,
      }),
    renameTag: (id: string, name: string) =>
      request<{ tag: CycleCustomTag; bundle: CycleBundle }>(`/api/cycle/tags/${id}`, {
        method: 'PATCH',
        body: { name },
        timeoutMs: 30_000,
      }),
    archiveTag: (id: string) =>
      request<{ tag: CycleCustomTag; bundle: CycleBundle }>(`/api/cycle/tags/${id}`, {
        method: 'DELETE',
        timeoutMs: 30_000,
      }),
    insights: (refresh = false) =>
      request<{
        insights: CycleInsights;
        cached: boolean;
        localInsights?: CycleInsights;
        model?: string;
        engine?: string;
        usage?: Usage;
      }>('/api/cycle/insights', { method: 'POST', body: { refresh } }),
    predictionHistory: () =>
      request<CyclePredictionHistory>('/api/cycle/prediction-history', { cache: 'no-store' }),
    observationTrends: () =>
      request<CycleObservationTrendsPayload>('/api/cycle/observation-trends', { cache: 'no-store' }),
    ttc: () => request<CycleTtcPayload>('/api/cycle/ttc', { cache: 'no-store' }),
    pregnancy: () => request<CyclePregnancyPayload>('/api/cycle/pregnancy', { cache: 'no-store' }),
    postpartum: () => request<CyclePostpartumPayload>('/api/cycle/postpartum', { cache: 'no-store' }),
    updatePostpartumReference: (referenceDate: string | null) =>
      request<CycleBundle>('/api/cycle/postpartum', { method: 'PUT', body: { referenceDate } }),
    classifyPostpartumBleed: (date: string) =>
      request<CycleBundle>('/api/cycle/postpartum/bleed-classifications', {
        method: 'PUT',
        body: { date },
        timeoutMs: 30_000,
      }),
    unclassifyPostpartumBleed: (date: string) =>
      request<CycleBundle>('/api/cycle/postpartum/bleed-classifications', {
        method: 'DELETE',
        body: { date },
        timeoutMs: 30_000,
      }),
    pregnancyCarePlan: () =>
      request<CyclePregnancyCarePlan>('/api/cycle/pregnancy/care-plan', { cache: 'no-store' }),
    upsertPregnancyCareItem: (
      careItemId: string,
      body: {
        status: 'PLANNED' | 'COMPLETED' | 'DISMISSED' | 'NOT_APPLICABLE' | 'CLEAR' | null;
        plannedDate?: string | null;
        plannedTime?: string | null;
        plannedPlace?: string | null;
        completedDate?: string | null;
        note?: string | null;
        reminderEnabled?: boolean;
        reminderOffset?: 0 | 1 | 3;
        reminderMode?: 'DATE_BASED' | 'EXACT_TIME';
        exactReminderOffsetMinutes?: 0 | 30 | 60 | 120 | null;
      },
    ) =>
      request<CyclePregnancyCarePlan>(
        `/api/cycle/pregnancy/care-plan/${encodeURIComponent(careItemId)}`,
        {
          method: 'PUT',
          body: {
            ...body,
            status: body.status === null ? 'CLEAR' : body.status,
          },
        },
      ),
    doctorSummary: (opts?: {
      from?: string;
      to?: string;
      includeFertility?: boolean;
      includeSexual?: boolean;
      includeNotes?: boolean;
    }) => {
      const qs = new URLSearchParams();
      if (opts?.from) qs.set('from', opts.from);
      if (opts?.to) qs.set('to', opts.to);
      if (opts?.includeFertility) qs.set('includeFertility', '1');
      if (opts?.includeSexual) qs.set('includeSexual', '1');
      if (opts?.includeNotes) qs.set('includeNotes', '1');
      const q = qs.toString();
      return request<CycleDoctorSummary>(`/api/cycle/doctor-summary${q ? `?${q}` : ''}`, {
        cache: 'no-store',
      });
    },
  },

  quests: {
    dashboard: (timezone?: string) => {
      const qs = timezone ? `?timezone=${encodeURIComponent(timezone)}` : '';
      return request<import('@/lib/quest/api').QuestDashboard>(`/api/quests${qs}`);
    },
    history: (params?: { take?: number; cursor?: string }) => {
      const qs = new URLSearchParams();
      if (params?.take) qs.set('take', String(params.take));
      if (params?.cursor) qs.set('cursor', params.cursor);
      const q = qs.toString();
      return request<{ items: import('@/lib/quest/api').QuestItem[]; nextCursor: string | null }>(
        `/api/quests/history${q ? `?${q}` : ''}`,
      );
    },
    rewards: () =>
      request<{
        balance: { coins: number; xp: number };
        totalEarned: { coins: number; xp: number };
        totalSpent: { coins: number; xp: number };
        transactions: Array<{
          id: string;
          currency: string;
          amount: number;
          transactionType: string;
          sourceType: string;
          sourceId: string;
          createdAt: string;
        }>;
      }>('/api/quests/rewards'),
    claim: (id: string) => request<import('@/lib/quest/api').QuestClaimResult>(`/api/quests/${id}/claim`, { method: 'POST' }),
    timezone: (timezone: string) =>
      request<{ ok: boolean; timezone: string }>('/api/quests/timezone', { method: 'PUT', body: { timezone } }),
  },

  achievements: {
    overview: () => request<import('@/lib/quest/achievements').AchievementsOverview>('/api/achievements'),
    claim: (id: string) =>
      request<import('@/lib/quest/achievements').AchievementClaimResult>(`/api/achievements/${id}/claim`, {
        method: 'POST',
      }),
  },

  rewards: {
    catalog: () => request<import('@/lib/quest/rewardsApi').StoreCatalog>('/api/rewards'),
    get: (id: string) => request<import('@/lib/quest/rewardsApi').StoreReward>(`/api/rewards/${id}`),
    redeem: (id: string, idempotencyKey: string) =>
      request<import('@/lib/quest/rewardsApi').RedeemResult>(`/api/rewards/${id}/redeem`, {
        method: 'POST',
        body: { idempotencyKey },
      }),
    mine: () =>
      request<{
        active: import('@/lib/quest/rewardsApi').RedemptionItem[];
        used: import('@/lib/quest/rewardsApi').RedemptionItem[];
        expired: import('@/lib/quest/rewardsApi').RedemptionItem[];
        items: import('@/lib/quest/rewardsApi').RedemptionItem[];
      }>('/api/rewards/redemptions'),
    redemption: (id: string) =>
      request<import('@/lib/quest/rewardsApi').RedemptionItem>(`/api/rewards/redemptions/${id}`),
    entitlements: () =>
      request<{ items: Array<{ entitlementKey: string; startsAt: string; endsAt: string }> }>(
        '/api/rewards/entitlements',
      ),
  },

  mediCompanion: {
    overview: (query?: {
      weatherKey?: string | null;
      isComeback?: boolean;
      recentEventKey?: string | null;
      reducedMotion?: boolean;
    }) => {
      const qs = new URLSearchParams();
      if (query?.weatherKey) qs.set('weatherKey', query.weatherKey);
      if (query?.isComeback) qs.set('comeback', '1');
      if (query?.recentEventKey) qs.set('recentEventKey', query.recentEventKey);
      if (query?.reducedMotion) qs.set('reducedMotion', '1');
      const q = qs.toString();
      return request<import('@/lib/companion/api').CompanionOverview>(
        `/api/medi-companion${q ? `?${q}` : ''}`,
      );
    },
    journey: () =>
      request<import('@/lib/companion/api').CompanionJourneyResponse>('/api/medi-companion/journey'),
    collection: () =>
      request<import('@/lib/companion/api').CompanionCollectionResponse>('/api/medi-companion/collection'),
    putEquipment: (patch: Partial<import('@/lib/companion/api').CompanionEquipment>) =>
      request<{ ok: boolean; equipment: import('@/lib/companion/api').CompanionEquipment }>(
        '/api/medi-companion/equipment',
        { method: 'PUT', body: patch },
      ),
    reconcile: () =>
      request<{
        ok: boolean;
        units: number;
        newlyUnlockedKeys: string[];
        aggregateUnlockCount: number;
      }>(      '/api/medi-companion/reconcile', { method: 'POST' }),
  },

};

export function absoluteUrl(path: string | null): string | null {
  if (!path) return null;
  return path.startsWith('http') ? path : `${API_BASE_URL}${path}`;
}
