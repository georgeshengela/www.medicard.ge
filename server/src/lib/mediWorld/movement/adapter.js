import { processWorldActivityInTx } from '../engine.js';
import { MOVEMENT_RULESET_ID } from './rules.js';

export function movementRewardIdempotencyKey(sessionId) {
  return `movement-session:${sessionId}`;
}

export async function awardMovementSessionInTx(tx, userId, session, options = {}) {
  const accepted = Math.max(0, Math.floor(Number(session.acceptedDurationSec) || 0));
  const target = Math.max(1, Math.floor(Number(session.targetDurationSec) || 0));
  const verified = session.verificationStatus === 'verified' && accepted > 0 && session.acceptedSegmentCount > 0;
  return processWorldActivityInTx(
    tx,
    userId,
    {
      sourceType: 'MOVEMENT_SESSION',
      sourceId: session.id,
      idempotencyKey: movementRewardIdempotencyKey(session.id),
      adapterId: 'activity.movement_session',
      energyType: 'movement',
      progressState: verified ? 'verified' : 'rejected',
      personalTarget: target,
      completedAmount: Math.min(accepted, target),
      logicalEventId: movementRewardIdempotencyKey(session.id),
      metadata: {
        origin: 'movement_session',
        ruleset: MOVEMENT_RULESET_ID,
        mode: session.movementMode,
        distanceBand: session.distanceBand,
      },
    },
    options,
  );
}
