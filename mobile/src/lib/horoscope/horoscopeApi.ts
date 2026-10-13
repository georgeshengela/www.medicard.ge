/**
 * MEDIHOROSCOPE client (server: server/src/routes/horoscope.routes.js). Reads go through useAccountQuery with
 * keys ['horoscope', …]; writes invalidate ['horoscope'] via queryInvalidation.ts. Birth time and place never
 * travel in a URL.
 */
import { horoscopeRequest } from '@/lib/api';
import type { AspectKey, PlanetKey, PointKey, SignKey } from './names';

export type Scores = { love: number; money: number; mood: number };
export type Reading = {
  kind: 'day' | 'week' | 'month' | 'year';
  periodKey: string;
  headline: string;
  general: string;
  love: string;
  money: string;
  mood: string;
  tip: string;
  scores: Scores | null;
  lucky?: { number: number; color: string; time: string };
  bestDay?: string | null;
  keyDates?: { date: string; text: string }[];
  highlights?: { month: string; text: string }[];
};
export type Readings = { today: Reading | null; tomorrow: Reading | null; week: Reading | null; month: Reading | null; year: Reading | null };

export type SkyBody = { key: PlanetKey; lon: number; sign: SignKey; degree: number; retro: boolean };
export type SkyEvent = { type: string; at: string; body: string | null; sign: SignKey | null; from?: string | null; kind?: string | null; retro?: boolean };
export type Moon = { key: string; angle: number; illumination: number; waxing: boolean; lunarDay: number; sign: SignKey; text?: string | null };
export type Sky = { today: string; bodies: SkyBody[]; moon: Moon; retrograde: PlanetKey[]; events: SkyEvent[] };

export type Transit = { transit: PlanetKey; aspect: AspectKey; natal: PointKey; orb: number; applying: boolean; title: string | null; text: string | null };
export type TarotCard = { id: string; n: number; roman: string; name: string; glyph: string; keywords?: string[]; text?: string; advice?: string };
export type HoroscopeProfile = { birthTime: string | null; placeName: string | null; placeDetail: string | null; hasPlace: boolean; showOnHome: boolean };

export type Hub = {
  today: string;
  sign: { key: SignKey; degree: number; cusp: SignKey[] | null; viewing: SignKey } | null;
  viewing: SignKey | null;
  needBirthDate: boolean;
  readings: Readings | null;
  sky: Sky;
  personal: { timeKnown: boolean; hasPlace: boolean; transits: Transit[] | null } | null;
  profile: HoroscopeProfile;
  tarot: TarotCard;
  numbers: { lifePath: number; personalDay: number; personalYear: number; lifePathText: any; dayText: any; yearText: any } | null;
  chinese: { animal: string; element: string; year: number; headline: string | null } | null;
  oracle: { enabled: boolean; name: string };
  homeCard: boolean;
  ready: boolean;
};

export type HomeCard = { show: boolean; sign?: SignKey; headline?: string | null; scores?: Scores | null; moon?: { key: string; angle: number; sign: SignKey } };

export type ChartBody = SkyBody & { minute: number; house: number | null; signText: string | null; houseText: string | null; planetText: string | null; retroText: string | null };
export type Chart = {
  birth: { date: string; time: string | null; placeName: string | null; timeKnown: boolean };
  system: string | null;
  bodies: ChartBody[];
  angles: { asc: { lon: number; sign: SignKey; degree: number; minute: number; text: string | null }; mc: { lon: number; sign: SignKey; degree: number; minute: number } } | null;
  houses: { n: number; lon: number; sign: SignKey; degree: number; title: string | null; text: string | null }[] | null;
  aspects: { a: PointKey; b: PointKey; aspect: AspectKey; orb: number; text: string | null }[];
  elements: Record<string, number>;
  modalities: Record<string, number>;
  elementTexts: Record<string, string | null>;
  moonUncertain: SignKey[] | null;
};
export type ChartResponse = { needBirthDate?: boolean; chart?: Chart; sign?: Hub['sign']; profile: HoroscopeProfile };

export type Place = { id: string; name: string; detail: string; lat: number; lon: number; tz: string };
export type Compat = { a: SignKey; b: SignKey; score: number; headline?: string; text?: string; love?: number; friendship?: number; work?: number; loveText?: string; friendText?: string; workText?: string };
export type SignPage = { profile: { key: SignKey; element: string; modality: string; ruler: PlanetKey; title?: string; text?: string; strengths?: string[]; challenges?: string[]; love?: string; work?: string }; readings: Readings };
export type Numerology = { needBirthDate?: boolean; lifePath: number; personalDay: number; personalYear: number; lifePathText: { title?: string; text?: string; strengths?: string[]; love?: string; work?: string } | null; dayText: { title?: string; text?: string } | null; yearText: { title?: string; text?: string } | null };
export type Chinese = { needBirthDate?: boolean; year: number; animal: string; element: string; yin: boolean; newYear: string; bestMatches: string[]; forecastYear: number; profile: { title?: string; text?: string; strengths?: string[]; love?: string; work?: string } | null; yearForecast: { headline?: string; text?: string; love?: string; work?: string } | null };
export type SkyPage = Sky & { retroTexts: Record<string, string | null>; calendar: { month: string; days: { date: string; key: string; angle: number; illumination: number; sign: SignKey }[] } };
export type Tarot = { date: string; card: TarotCard; spread: TarotCard[] };
export type DreamSymbol = { id: string; word: string; ready?: boolean };
export type Dream = { id: string; word: string; text?: string; variants?: string[] };

export type OracleMessage = { id: string; role: 'user' | 'assistant'; content: string; status: string; cards: OracleCard[] | null; createdAt: string };
export type OracleCard = { id: string; n: number; roman: string; ka: string; en: string; glyph: string };
export type OracleThread = { enabled: boolean; name: string; sessionId: string | null; sessions: { id: string; title: string; updatedAt: string }[]; messages: OracleMessage[] };

export const horoscopeApi = {
  hub: (sign?: SignKey) => horoscopeRequest<Hub>(sign ? `?sign=${sign}` : ''),
  home: () => horoscopeRequest<HomeCard>('/home'),
  sign: (sign: SignKey) => horoscopeRequest<SignPage>(`/sign/${sign}`),
  chart: () => horoscopeRequest<ChartResponse>('/chart'),
  saveProfile: (body: { birthTime?: string | null; place?: Omit<Place, 'id'> & { detail?: string } | null; showOnHome?: boolean }) =>
    horoscopeRequest<{ profile: HoroscopeProfile }>('/profile', 'PUT', body),
  places: (q: string) => horoscopeRequest<{ places: Place[] }>(`/places?q=${encodeURIComponent(q)}`),
  sky: (month?: string) => horoscopeRequest<SkyPage>(month ? `/sky?month=${month}` : '/sky'),
  compat: (a: SignKey, b: SignKey) => horoscopeRequest<Compat>(`/compat?a=${a}&b=${b}`),
  numerology: () => horoscopeRequest<Numerology>('/numerology'),
  chinese: () => horoscopeRequest<Chinese>('/chinese'),
  tarot: () => horoscopeRequest<Tarot>('/tarot'),
  dreams: (q?: string) => horoscopeRequest<{ symbols?: DreamSymbol[]; results?: Dream[] }>(q ? `/dreams?q=${encodeURIComponent(q)}` : '/dreams'),
  dream: (id: string) => horoscopeRequest<Dream>(`/dreams/${id}`),
  oracle: (session?: string) => horoscopeRequest<OracleThread>(session ? `/oracle?session=${session}` : '/oracle'),
  deleteOracle: (sessionId: string) => horoscopeRequest<{ ok: true }>(`/oracle/${sessionId}`, 'DELETE'),
};

export function newOracleRequestId(): string {
  return `o-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
