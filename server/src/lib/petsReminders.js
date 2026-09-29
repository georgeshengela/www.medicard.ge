/**
 * Phase 5 — pet care reminder preferences and honest delivery telemetry.
 * Reminder PATCH must not bump schedule revision or change nextDueOn.
 */
import { t } from './i18n.js';

const OFFSET_ALLOWLIST = new Set([0, 1, 3]);
export const PET_REMINDER_OFFSETS = Object.freeze([0, 1, 3]);
export const PET_REMINDER_DELIVERY_STATUSES = Object.freeze([
  'SCHEDULED_LOCAL',
  'SCHEDULE_FAILED',
  'CANCELLED',
  'RECEIVED_CALLBACK',
  'USER_RESPONSE',
  'COMPLETION_CONFIRMED',
]);

const FORBIDDEN_TELEMETRY = ['title', 'body', 'notes', 'petName', 'productName', 'jwt', 'token', 'copy'];

function fail(message) {
  const error = new Error(message);
  error.status = 400;
  throw error;
}

export function isPetReminderOffset(value) {
  return OFFSET_ALLOWLIST.has(Number(value));
}

export function normalizeReminderOffsetsDays(value, lang = 'ka') {
  const raw = Array.isArray(value) ? value : [0];
  const unique = [...new Set(raw.map((row) => Number(row)))].filter(isPetReminderOffset).sort((a, b) => b - a);
  if (!unique.length) return [0];
  if (unique.length > 3) fail(t(lang, 'შეხსენების წინსვლა ძალიან ბევრია.', 'Too many advance reminders.'));
  return unique;
}

export function reminderPatchChangesCareRevision() {
  return false;
}

export function normalizeReminderPatch(input, lang = 'ka') {
  if (input == null || typeof input !== 'object') fail(t(lang, 'შეხსენების პარამეტრები არასწორია.', 'Reminder settings are invalid.'));
  if ('timeMode' in input || 'dueTime' in input || 'times' in input || 'startOn' in input || 'revision' in input) {
    fail(t(lang, 'შეხსენება არ ცვლის მოვლის გეგმას.', "A reminder doesn't change the care plan."));
  }
  return {
    reminderEnabled: Boolean(input.reminderEnabled),
    reminderOffsetsDays: normalizeReminderOffsetsDays(input.reminderOffsetsDays, lang),
  };
}

export function reminderWriteData(patch) {
  return {
    reminderEnabled: patch.reminderEnabled === true,
    reminderOffsetsDays: normalizeReminderOffsetsDays(patch.reminderOffsetsDays),
  };
}

export function isPetReminderDeliveryStatus(value) {
  return PET_REMINDER_DELIVERY_STATUSES.includes(String(value || ''));
}

export function sanitizeReminderTelemetry(body, lang = 'ka') {
  if (body == null || typeof body !== 'object') fail(t(lang, 'ტელემეტრია არასწორია.', 'Telemetry is invalid.'));
  for (const key of FORBIDDEN_TELEMETRY) {
    if (Object.prototype.hasOwnProperty.call(body, key)) fail(t(lang, 'შეტყობინების ტექსტი არ იგზავნება.', 'Notification text is not sent.'));
  }
  const occurrenceKey = String(body.occurrenceKey || '').trim();
  if (!/^r\d+\|\d{4}-\d{2}-\d{2}\|[^|]+\|\d+$/.test(occurrenceKey)) fail(t(lang, 'მოვლის შემთხვევა არასწორია.', 'Care occurrence is invalid.'));
  const alertKind = String(body.alertKind || 'due').trim();
  if (!/^(due|advance:\d+|followup:\d+|snooze)$/.test(alertKind)) fail(t(lang, 'შეხსენების ტიპი არასწორია.', 'Reminder type is invalid.'));
  const identity = String(body.identity || '').trim();
  if (!identity.startsWith('pets:') || identity.length > 320) fail(t(lang, 'შეხსენების იდენტობა არასწორია.', 'Reminder identity is invalid.'));
  const installId = String(body.installId || '').trim();
  if (!installId || installId.length > 80) fail(t(lang, 'მოწყობილობის იდენტიფიკატორი არასწორია.', 'Device identifier is invalid.'));
  const status = String(body.status || '');
  if (!isPetReminderDeliveryStatus(status)) fail(t(lang, 'მდგომარეობა არასწორია.', 'Status is invalid.'));
  const fireAtMs = body.fireAtMs == null ? null : Number(body.fireAtMs);
  if (fireAtMs != null && (!Number.isFinite(fireAtMs) || fireAtMs < 0)) fail(t(lang, 'დრო არასწორია.', 'Time is invalid.'));
  return {
    occurrenceKey,
    alertKind,
    identity,
    installId,
    status,
    fireAtMs,
  };
}

export function petsReminderSchemaUnavailable() {
  return {
    status: 202,
    body: {
      schemaReady: true,
      careSchemaReady: true,
      reminderSchemaReady: false,
      accepted: false,
    },
  };
}
