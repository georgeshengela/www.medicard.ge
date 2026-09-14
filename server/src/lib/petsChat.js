import { normalizeClientRequestId } from './petsHealth.js';

export const VET_MESSAGE_MIN = 2;
export const VET_MESSAGE_MAX = 4000;
export const VET_HISTORY_PAGE = 50;
export const VET_HISTORY_PAGE_MAX = 100;
export const VET_CONCURRENT_PER_PET = 1;
export const VET_TITLE_MAX = 40;

export const MESSAGE_STATUSES = Object.freeze(['PENDING', 'PARTIAL', 'COMPLETE', 'FAILED', 'CANCELLED']);
export const MESSAGE_ROLES = Object.freeze(['user', 'assistant']);

export function requireVetMessage(value) {
  const text = String(value || '').trim();
  if (text.length < VET_MESSAGE_MIN) {
    const error = new Error('შეკითხვა ძალიან მოკლეა.');
    error.status = 400;
    error.code = 'UNSUPPORTED_INPUT';
    throw error;
  }
  if (text.length > VET_MESSAGE_MAX) {
    const error = new Error('შეკითხვა ძალიან გრძელია.');
    error.status = 400;
    error.code = 'UNSUPPORTED_INPUT';
    throw error;
  }
  return text;
}

export function requireClientRequestId(value) {
  const id = normalizeClientRequestId(value);
  if (!id) {
    const error = new Error('მოთხოვნის იდენტიფიკატორი სავალდებულოა.');
    error.status = 400;
    error.code = 'UNSUPPORTED_INPUT';
    throw error;
  }
  return id;
}

export function buildSessionTitle(message) {
  const compact = String(message || '').replace(/\s+/g, ' ').trim();
  if (!compact) return 'ახალი საუბარი';
  return compact.length <= VET_TITLE_MAX ? compact : `${compact.slice(0, VET_TITLE_MAX - 1)}…`;
}

export function publicChatSession(row) {
  return {
    id: row.id,
    petId: row.petId,
    title: row.title,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : row.updatedAt,
  };
}

export function publicChatMessage(row) {
  return {
    id: row.id,
    sessionId: row.sessionId,
    petId: row.petId,
    role: row.role,
    content: row.content,
    status: row.status,
    clientRequestId: row.clientRequestId ?? null,
    citations: Array.isArray(row.citations) ? row.citations : row.citations ?? [],
    draft: row.draft ?? null,
    grounding: row.grounding ?? null,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
  };
}

export function rejectClientConversationPayload(body) {
  if (!body || typeof body !== 'object') return;
  if (Array.isArray(body.messages) || Array.isArray(body.history) || body.role || body.system) {
    const error = new Error('საუბრის ისტორიას სერვერი აკონტროლებს.');
    error.status = 400;
    error.code = 'UNSUPPORTED_INPUT';
    throw error;
  }
}

export function shouldConsumeVetCredit({ replayed, assistantStatus }) {
  return !replayed && assistantStatus === 'COMPLETE';
}

export function isInFlightStatus(status) {
  return status === 'PENDING' || status === 'PARTIAL';
}
