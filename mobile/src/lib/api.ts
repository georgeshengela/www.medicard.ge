import Constants from 'expo-constants';
import { ka } from '@/i18n/ka';
import { getToken } from './storage';

/**
 * Resolves the API base URL.
 *
 * Default (Expo Go, dev, preview, production): https://medicard.ge (Render)
 * Override only when explicitly set via EXPO_PUBLIC_API_URL (e.g. local backend).
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

export type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  interactionId?: string;
  feedbackRating?: 1 | -1;
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

  constructor(message: string, status: number, payload?: Record<string, unknown>) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = payload?.code as string | undefined;
    this.fields = payload?.fields as ApiError['fields'];
    this.usage = payload?.usage as Usage | undefined;
    this.upsell = payload?.upsell as Upsell | undefined;
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
}

export type CycleMode = 'TRACK_PERIOD' | 'TRY_TO_CONCEIVE' | 'PREGNANCY';

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

export type CycleReminderPrefsServer = {
  enabled?: boolean;
  periodDaysBefore?: number;
  ovulation?: boolean;
  dailyLog?: boolean;
  pms?: boolean;
  maskNotifications?: boolean;
  maskStyle?: 'neutral' | 'wellness' | 'calendar' | 'notes';
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
  aiInsights?: CycleInsights | null;
  aiInsightsAt?: string | null;
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
  notes: string | null;
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

export type CycleDayMark = {
  period?: boolean;
  fertile?: boolean;
  ovulation?: boolean;
  predicted?: boolean;
  logged?: boolean;
  flow?: string;
};

export type CycleBundle = {
  profile: CycleProfile;
  logs: CycleLog[];
  pregnancyLogs: PregnancyLog[];
  predictions: {
    nextPeriodStart: string | null;
    nextPeriodEnd: string | null;
    ovulationDate: string | null;
    fertileWindow: { start: string; end: string } | null;
    calendar: Record<string, CycleDayMark>;
  };
  pregnancy: {
    dueDate: string;
    age: { week: number; day: number; dayOfPregnancy: number; trimester: number } | null;
    insight: { week: number; size: string; note: string };
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
    topSymptoms90d: { key: string; count: number }[];
    bbtPoints: { date: string; bbt: number }[];
    periodStarts: string[];
  };
  alerts?: {
    level: 'info' | 'warn' | 'urgent';
    messageKa: string;
    action?: 'chat' | null;
  }[];
  summary: {
    mode: CycleMode;
    avgCycleLength: number;
    avgPeriodLength: number;
    isIrregular: boolean;
    loggedDays: number;
    periodDaysLogged: number;
    nextPeriodStart: string | null;
    ovulationDate: string | null;
    fertileWindow: { start: string; end: string } | null;
    topSymptoms: { key: string; count: number }[];
    topMoods: { key: string; count: number }[];
    generatedAt: string;
  };
  localInsights?: CycleInsights;
};

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  formData?: FormData;
  token?: string | null;
  timeoutMs?: number;
};

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, formData, timeoutMs = 180_000 } = options;
  const token = options.token !== undefined ? options.token : await getToken();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData ?? (body ? JSON.stringify(body) : undefined),
    });

    const text = await response.text();
    const payload = text ? safeParse(text) : {};

    if (!response.ok) {
      throw new ApiError(
        (payload?.error as string) ?? ka.common.error,
        response.status,
        payload as Record<string, unknown>,
      );
    }

    return payload as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if ((error as Error)?.name === 'AbortError') {
      throw new ApiError('მოთხოვნის დრო ამოიწურა. სცადეთ ხელახლა.', 408);
    }
    throw new ApiError(ka.common.networkError, 0);
  } finally {
    clearTimeout(timeout);
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
  health: () => request<{ status: string }>('/health', { token: null }),

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
        };
        client: { version: string; needsUpdate: boolean; blockedByForceUpdate: boolean };
        packages?: UserPackage[];
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
        timeoutMs: 15_000,
      }),

    login: (body: { email: string; password: string }) =>
      request<AuthResponse>('/api/auth/login', { method: 'POST', body, token: null, timeoutMs: 15_000 }),

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

    me: () =>
      request<{
        user: User;
        usage: Usage;
        stats: { records: number; chats: number; activeMedications: number };
        healthProfile: HealthProfile | null;
        checkIn?: CheckInState | null;
        checkInAwarded?: boolean;
        pointsAwarded?: number;
      }>('/api/auth/me'),

    updateProfile: (body: { fullName?: string; gender?: Gender; birthDate?: string }) =>
      request<{ user: User }>('/api/auth/me', { method: 'PATCH', body }),
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
    onboardingAnalysis: () =>
      request<{
        analysis: import('@/types/onboardingAnalysis').OnboardingAnalysis;
        profile: HealthProfile;
        cached: boolean;
      }>('/api/health-profile/onboarding-analysis', { method: 'POST', timeoutMs: 120_000 }),
  },

  healthMetrics: {
    sync: (body: import('@/lib/healthMetricsStorage').HealthMetricsSyncPayload) =>
      request<{ ok: boolean; dailyUpserted: number; stepLogsInserted: number; syncedAt: string }>(
        '/api/health-metrics/sync',
        { method: 'POST', body, timeoutMs: 30_000 },
      ),
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
  },

  ai: {
    query: (body: { message: string; mode?: 'DOCTOR' | 'CONSILIUM'; sessionId?: string; context?: string }) =>
      request<{
        sessionId: string;
        title: string;
        mode: 'DOCTOR' | 'CONSILIUM';
        answer: string;
        model: string;
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

    analyzeImage: (params: {
      uri: string;
      name: string;
      mimeType: string;
      kind: 'LAB' | 'IMAGING' | 'SKIN';
      context?: string;
    }) => {
      const formData = new FormData();
      // React Native's FormData takes this shape; the DOM typings disagree, hence the cast.
      formData.append('file', {
        uri: params.uri,
        name: params.name,
        type: params.mimeType,
      } as unknown as Blob);
      formData.append('kind', params.kind);
      if (params.context) formData.append('context', params.context);

      return request<{
        record: MedicalRecord;
        analysis: string;
        pipeline: { extractor: { provider: string; model: string }; reasoning: { provider: string; model: string } };
        usage: Usage;
      }>('/api/ai/analyze-image', { method: 'POST', formData });
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
    get: () => request<CycleBundle>('/api/cycle'),
    updateProfile: (body: Partial<{
      mode: CycleMode;
      avgCycleLength: number;
      avgPeriodLength: number;
      lastPeriodStart: string | null;
      isIrregular: boolean;
      dueDate: string | null;
      privacyEnabled: boolean;
      enablePartnerShare: boolean;
      conditions: CycleCondition[];
      reminderPrefs: CycleReminderPrefsServer;
    }>) => request<CycleBundle>('/api/cycle/profile', { method: 'PATCH', body }),
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
        notes: string | null;
      }>,
    ) => request<{ log: CycleLog; bundle: CycleBundle }>(`/api/cycle/logs/${date}`, { method: 'PUT', body }),
    removeLog: (date: string) => request<CycleBundle>(`/api/cycle/logs/${date}`, { method: 'DELETE' }),
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
    insights: (refresh = false) =>
      request<{
        insights: CycleInsights;
        cached: boolean;
        localInsights?: CycleInsights;
        model?: string;
        engine?: string;
        usage?: Usage;
      }>('/api/cycle/insights', { method: 'POST', body: { refresh } }),
  },
};

export function absoluteUrl(path: string | null): string | null {
  if (!path) return null;
  return path.startsWith('http') ? path : `${API_BASE_URL}${path}`;
}
