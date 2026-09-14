import { decideOwnedRecordAccess } from './ownerAccess.js';

export const PET_NOT_FOUND = { error: 'ცხოველი ვერ მოიძებნა.' };

const HEALTH_TABLE_RE = /PetWeightLog|PetAllergy|PetCondition/;
const CARE_TABLE_RE = /PetProduct|PetCareSchedule|PetCareOccurrence|PetCareEvent/;
const REMINDER_TABLE_RE = /PetReminderDelivery/;
const CHAT_TABLE_RE = /PetChatSession|PetChatMessage/;

export function isPetsSchemaMissing(error) {
  return error?.code === 'P2021' || /does not exist/i.test(error?.message || '');
}

export function prismaMissingBlob(error) {
  return `${error?.meta?.modelName || ''} ${error?.meta?.table || ''} ${error?.message || ''}`;
}

export function isPetsHealthSchemaMissing(error) {
  if (!isPetsSchemaMissing(error)) return false;
  return HEALTH_TABLE_RE.test(prismaMissingBlob(error));
}

export function petsSchemaUnavailable() {
  return {
    status: 503,
    body: {
      schemaReady: false,
      error: 'ცხოველების მოდული ჯერ მზად არ არის.',
    },
  };
}

export function petsHealthSchemaUnavailable() {
  return {
    status: 503,
    body: {
      schemaReady: false,
      healthSchemaReady: false,
      error: 'ცხოველის ჯანმრთელობის ჩანაწერები ჯერ მზად არ არის.',
    },
  };
}

export function isPetsCareSchemaMissing(error) {
  if (!isPetsSchemaMissing(error)) return false;
  return CARE_TABLE_RE.test(prismaMissingBlob(error));
}

export function isPetsReminderSchemaMissing(error) {
  const blob = `${prismaMissingBlob(error)} ${error?.message || ''}`;
  if (REMINDER_TABLE_RE.test(blob)) return true;
  return Boolean(isPetsSchemaMissing(error) && REMINDER_TABLE_RE.test(prismaMissingBlob(error)));
}

export function petsCareSchemaUnavailable() {
  return {
    status: 503,
    body: {
      schemaReady: false,
      careSchemaReady: false,
      error: 'ცხოველის მოვლის ჩანაწერები ჯერ მზად არ არის.',
    },
  };
}

export function isPetsChatSchemaMissing(error) {
  if (!isPetsSchemaMissing(error)) return false;
  return CHAT_TABLE_RE.test(prismaMissingBlob(error));
}

export function petsChatSchemaUnavailable() {
  return {
    status: 503,
    body: {
      schemaReady: false,
      chatSchemaReady: false,
      error: 'Medi Vet-ის საუბარი ჯერ მზად არ არის.',
    },
  };
}

export function ownedPetWhere(userId, petId) {
  return { id: petId, userId };
}

/** Active (non-archived) owned pet. Miss / other owner / archived → 404 body. */
export function decideOwnedActivePet(record, viewerUserId) {
  const access = decideOwnedRecordAccess(record, viewerUserId);
  if (access.status !== 200) return { status: 404, body: null };
  if (record.archivedAt) return { status: 404, body: null };
  return access;
}
