/**
 * Phase 5 — pet care reminder preferences and honest delivery telemetry.
 * Reminder PATCH must not bump schedule revision or change nextDueOn.
 */

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

export function normalizeReminderOffsetsDays(value) {
  const raw = Array.isArray(value) ? value : [0];
  const unique = [...new Set(raw.map((row) => Number(row)))].filter(isPetReminderOffset).sort((a, b) => b - a);
  if (!unique.length) return [0];
  if (unique.length > 3) fail('შეხსენების წინსვლა ძალიან ბევრია.');
  return unique;
}

export function reminderPatchChangesCareRevision() {
  return false;
}

export function normalizeReminderPatch(input) {
  if (input == null || typeof input !== 'object') fail('შეხსენების პარამეტრები არასწორია.');
  if ('timeMode' in input || 'dueTime' in input || 'times' in input || 'startOn' in input || 'revision' in input) {
    fail('შეხსენება არ ცვლის მოვლის გეგმას.');
  }
  return {
    reminderEnabled: Boolean(input.reminderEnabled),
    reminderOffsetsDays: normalizeReminderOffsetsDays(input.reminderOffsetsDays),
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

export function sanitizeReminderTelemetry(body) {
  if (body == null || typeof body !== 'object') fail('ტელემეტრია არასწორია.');
  for (const key of FORBIDDEN_TELEMETRY) {
    if (Object.prototype.hasOwnProperty.call(body, key)) fail('შეტყობინების ტექსტი არ იგზავნება.');
  }
  const occurrenceKey = String(body.occurrenceKey || '').trim();
  if (!/^r\d+\|\d{4}-\d{2}-\d{2}\|[^|]+\|\d+$/.test(occurrenceKey)) fail('მოვლის შემთხვევა არასწორია.');
  const alertKind = String(body.alertKind || 'due').trim();
  if (!/^(due|advance:\d+|followup:\d+|snooze)$/.test(alertKind)) fail('შეხსენების ტიპი არასწორია.');
  const identity = String(body.identity || '').trim();
  if (!identity.startsWith('pets:') || identity.length > 320) fail('შეხსენების იდენტობა არასწორია.');
  const installId = String(body.installId || '').trim();
  if (!installId || installId.length > 80) fail('მოწყობილობის იდენტიფიკატორი არასწორია.');
  const status = String(body.status || '');
  if (!isPetReminderDeliveryStatus(status)) fail('მდგომარეობა არასწორია.');
  const fireAtMs = body.fireAtMs == null ? null : Number(body.fireAtMs);
  if (fireAtMs != null && (!Number.isFinite(fireAtMs) || fireAtMs < 0)) fail('დრო არასწორია.');
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
