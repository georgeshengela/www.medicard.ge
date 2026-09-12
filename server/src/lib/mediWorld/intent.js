import { createHash } from 'node:crypto';

export function fingerprintWorldIntent(intent = {}) {
  const parts = [
    String(intent.userId || ''),
    String(intent.transactionType || ''),
    String(intent.energyType || ''),
    String(intent.sourceType || ''),
    String(intent.sourceId || ''),
    String(intent.adapterId || ''),
    String(intent.progressState || ''),
    String(intent.personalTarget ?? ''),
    String(intent.completedAmount ?? ''),
    String(intent.requestedAmount ?? ''),
    String(intent.logicalEventId || ''),
    String(intent.rulesetVersion || ''),
  ];
  return createHash('sha256').update(parts.join('\0')).digest('hex');
}

export function assertIdempotencyMatch(existing, intent) {
  const error = new Error('Medi World idempotency conflict.');
  error.status = 409;
  error.code = 'WORLD_IDEMPOTENCY_CONFLICT';
  if (!existing) throw error;
  if (existing.userId !== intent.userId) throw error;
  const expected = fingerprintWorldIntent(intent);
  if (existing.intentFingerprint) {
    if (existing.intentFingerprint !== expected) throw error;
    return;
  }
  if (
    existing.transactionType !== intent.transactionType ||
    existing.energyType !== intent.energyType ||
    existing.sourceType !== intent.sourceType ||
    existing.sourceId !== intent.sourceId ||
    existing.adapterId !== intent.adapterId
  ) {
    throw error;
  }
}

export async function loadLedgerByIdempotency(tx, idempotencyKey) {
  if (typeof tx?.mediWorldLedger?.findUnique === 'function') {
    const byKey = await tx.mediWorldLedger.findUnique({ where: { idempotencyKey } }).catch(() => null);
    if (byKey) return byKey;
  }
  return tx.mediWorldLedger.findFirst({ where: { idempotencyKey } });
}
