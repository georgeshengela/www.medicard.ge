export type Fast = {
  id: string;
  startedAt: string;
  endedAt: string | null;
  targetMinutes: number;
  protocol: string;
  note: string;
  minutes: number;
  completed: boolean;
  goalAt: string;
};
export type FastingScreeningAnswers = {
  eatingDisorder: boolean;
  pregnancy: boolean;
  diabetesMedication: boolean;
  doctorApproved: boolean;
};
export type FastingEligibility = {
  eligible: boolean;
  needsScreening: boolean;
  blocked: boolean;
  reasons: string[];
  needsDoctor: boolean;
  doctorReasons: string[];
  maxMinutes: number;
};
export type FastingState = {
  eligibility: FastingEligibility;
  settings: { protocol: string; targetMinutes: number; notify: boolean; screened: boolean };
  screening: (FastingScreeningAnswers & { answeredAt: string }) | null;
  active: Fast | null;
  history: Fast[];
  stats: {
    total: number;
    completed: number;
    week: { count: number; completed: number; averageMinutes: number | null };
    longestMinutes: number | null;
    streak: number;
  };
};
/** Daily eating windows only, 10–20 hours; the server enforces the same bounds. */
export const FASTING_PROTOCOLS = [
  { key: "12:12", hours: 12, label: "12:12", detail: "დასაწყისისთვის — ღამე და ცოტა მეტი" },
  { key: "14:10", hours: 14, label: "14:10", detail: "რბილი ნაბიჯი წინ" },
  { key: "16:8", hours: 16, label: "16:8", detail: "ყველაზე გავრცელებული" },
  { key: "18:6", hours: 18, label: "18:6", detail: "გამოცდილთათვის" },
  { key: "20:4", hours: 20, label: "20:4", detail: "მაქსიმუმი აპში" },
] as const;
export const FAST_MIN_HOURS = 10;
export const FAST_MAX_HOURS = 20;

export function fastElapsedMinutes(fast: Pick<Fast, "startedAt" | "endedAt">, now = Date.now()) {
  const end = fast.endedAt ? new Date(fast.endedAt).getTime() : now;
  return Math.max(0, Math.floor((end - new Date(fast.startedAt).getTime()) / 60000));
}
export function fastProgress(fast: Pick<Fast, "startedAt" | "endedAt" | "targetMinutes">, now = Date.now()) {
  return Math.min(1, fastElapsedMinutes(fast, now) / fast.targetMinutes);
}
/** 16:05 style: hours and minutes, for the running clock. */
export function clockLabel(minutes: number) {
  const m = Math.max(0, Math.floor(minutes));
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
}
/** Seconds too, for the big live clock. */
export function clockLabelSeconds(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), s = total % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
export function hoursLabel(minutes: number | null | undefined) {
  if (minutes == null) return "—";
  const h = Math.floor(minutes / 60), m = minutes % 60;
  return m ? `${h} სთ ${m} წთ` : `${h} სთ`;
}
export function timeLabel(iso: string) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
/** Plain-language milestones by share of the goal; no physiological claims about the hours. */
export function fastMilestone(progress: number) {
  if (progress >= 1) return "მიზანი შესრულებულია — დაასრულე, როცა მზად იქნები.";
  if (progress >= 0.75) return "ბოლო მეოთხედია. წყალი და უშაქრო ჩაი დაგეხმარება.";
  if (progress >= 0.5) return "ნახევარზე მეტი გავლილია.";
  if (progress >= 0.25) return "კარგად მიდიხარ. თუ თავს ცუდად გრძნობ, შეწყვიტე — ეს ნორმალურია.";
  return "დაწყებულია. წყალი, უშაქრო ჩაი და ყავა შეიძლება.";
}
/** Protocol key for a target length: a preset when it matches, otherwise custom. */
export function protocolFor(hours: number) {
  return FASTING_PROTOCOLS.find((p) => p.hours === hours)?.key ?? "custom";
}
