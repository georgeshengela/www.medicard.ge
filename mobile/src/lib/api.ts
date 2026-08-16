import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { ka } from '@/i18n/ka';
import { getToken } from './storage';

/**
 * Resolves the API base URL.
 *
 * Priority: EXPO_PUBLIC_API_URL → app.json `extra.apiUrl` → LAN / emulator defaults.
 */
function resolveBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL?.trim();
  const fromExtra = Constants.expoConfig?.extra?.apiUrl as string | undefined;
  const explicit = (fromEnv || fromExtra || '').replace(/\/$/, '');
  if (explicit) return explicit;

  // Production web is served from the same Express origin as /api and /health.
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const { hostname, origin } = window.location;
    if (hostname && hostname !== 'localhost' && hostname !== '127.0.0.1') {
      return origin;
    }
  }

  const port = 4000;
  const hostUri = Constants.expoConfig?.hostUri ?? Constants.expoGoConfig?.debuggerHost;
  const lanHost = hostUri?.split(':')[0];

  if (lanHost && lanHost !== 'localhost' && lanHost !== '127.0.0.1') {
    return `http://${lanHost}:${port}`;
  }
  if (Platform.OS === 'android') return `http://10.0.2.2:${port}`;
  return `http://localhost:${port}`;
}

export const API_BASE_URL = resolveBaseUrl();

export type Usage = {
  date: string;
  used: number;
  limit: number;
  remaining: number;
  exceeded: boolean;
  resetsInMs: number;
};

export type Gender = 'MALE' | 'FEMALE' | 'OTHER';

export type User = {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  gender: Gender | null;
  /** `YYYY-MM-DD`, or null for accounts that predate the medical profile. */
  birthDate: string | null;
  age: number | null;
  createdAt: string;
};

export type ChatMessage = { role: 'user' | 'assistant'; content: string; timestamp: string };

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
  type: 'LAB' | 'XRAY' | 'CT_MRI' | 'SKIN' | 'SKINCARE' | 'PRESCRIPTION';
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
  createdAt: string;
};

export type ScheduledDose = {
  medicationId: string;
  medName: string;
  dosage: string;
  notes: string | null;
  time: string;
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
    return this.status === 429 && this.code === 'DAILY_LIMIT_REACHED';
  }

  get isUnauthorized() {
    return this.status === 401;
  }
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
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

  auth: {
    register: (body: {
      fullName: string;
      email: string;
      password: string;
      gender: Gender;
      /** `YYYY-MM-DD` */
      birthDate: string;
      phone?: string;
    }) => request<AuthResponse>('/api/auth/register', { method: 'POST', body, token: null }),

    login: (body: { email: string; password: string }) =>
      request<AuthResponse>('/api/auth/login', { method: 'POST', body, token: null }),

    phoneStart: (phone: string) =>
      request<{ sent: boolean; phone: string; message: string; devCode?: string }>('/api/auth/phone/start', {
        method: 'POST',
        body: { phone },
        token: null,
      }),

    phoneVerify: (body: { phone: string; code: string; fullName?: string }) =>
      request<AuthResponse>('/api/auth/phone/verify', { method: 'POST', body, token: null }),

    me: () =>
      request<{
        user: User;
        usage: Usage;
        stats: { records: number; chats: number; activeMedications: number };
      }>('/api/auth/me'),

    updateProfile: (body: { fullName?: string; gender?: Gender; birthDate?: string }) =>
      request<{ user: User }>('/api/auth/me', { method: 'PATCH', body }),
  },

  usage: {
    get: () => request<Usage & { label: string }>('/api/usage'),
  },

  ai: {
    query: (body: { message: string; mode?: 'DOCTOR' | 'CONSILIUM'; sessionId?: string; context?: string }) =>
      request<{
        sessionId: string;
        title: string;
        mode: 'DOCTOR' | 'CONSILIUM';
        answer: string;
        model: string;
        usage: Usage;
      }>('/api/ai/query', { method: 'POST', body }),

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
    create: (body: { medName: string; dosage: string; frequency: string; notes?: string }) =>
      request<{ medication: Medication }>('/api/medications', { method: 'POST', body }),
    update: (id: string, body: Partial<{ medName: string; dosage: string; frequency: string; notes: string; active: boolean }>) =>
      request<{ medication: Medication }>(`/api/medications/${id}`, { method: 'PATCH', body }),
    remove: (id: string) => request<{ deleted: boolean }>(`/api/medications/${id}`, { method: 'DELETE' }),
  },
};

export function absoluteUrl(path: string | null): string | null {
  if (!path) return null;
  return path.startsWith('http') ? path : `${API_BASE_URL}${path}`;
}
