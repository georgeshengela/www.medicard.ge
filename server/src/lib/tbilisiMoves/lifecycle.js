import { ROUND_STATUS } from './constants.js';
import { addDaysYmd, tbilisiMidnight, tbilisiYmd } from './time.js';

/**
 * Server-side round lifecycle. Client clocks never decide finalization.
 * VOIDED is unused: existing pause flags do not void a round.
 */
export function roundLifecycle(round, now = new Date()) {
  if (!round) {
    return {
      phase: 'UNOPENED',
      canFinalize: false,
      canCorrect: false,
      ingestOpen: false,
      blocker: 'ROUND_NOT_OPEN',
      graceEndsAt: null,
    };
  }

  const graceEndsAt = new Date(round.graceEndsAt);
  const graceIso = graceEndsAt.toISOString();
  if (round.status === ROUND_STATUS.FINALIZED) {
    return {
      phase: 'FINALIZED',
      canFinalize: false,
      canCorrect: true,
      ingestOpen: false,
      blocker: 'ALREADY_FINALIZED',
      graceEndsAt: graceIso,
      resultRevision: round.resultRevision || 0,
    };
  }

  const today = tbilisiYmd(now);
  const dayEnd = tbilisiMidnight(addDaysYmd(round.date, 1));
  if (now.getTime() < dayEnd.getTime()) {
    return {
      phase: 'OPEN',
      canFinalize: false,
      canCorrect: false,
      ingestOpen: now.getTime() < graceEndsAt.getTime(),
      blocker: 'DAY_STILL_OPEN',
      graceEndsAt: graceIso,
    };
  }
  if (now.getTime() < graceEndsAt.getTime()) {
    return {
      phase: 'GRACE',
      canFinalize: false,
      canCorrect: false,
      ingestOpen: true,
      blocker: 'GRACE_ACTIVE',
      graceEndsAt: graceIso,
    };
  }
  return {
    phase: 'READY',
    canFinalize: true,
    canCorrect: false,
    ingestOpen: false,
    blocker: null,
    graceEndsAt: graceIso,
  };
}

export function assertCanFinalize(lifecycle) {
  if (lifecycle.phase === 'FINALIZED') return lifecycle;
  if (!lifecycle.canFinalize) {
    const err = new Error(
      lifecycle.phase === 'GRACE'
        ? 'გრეისის ვადა ჯერ არ ამოწურულა.'
        : lifecycle.phase === 'OPEN'
          ? 'დღე ჯერ არ დასრულებულა.'
          : 'რაუნდის ფინალიზაცია ამ მომენტში შეუძლებელია.',
    );
    err.status = 409;
    err.code = lifecycle.blocker || 'FINALIZE_BLOCKED';
    throw err;
  }
  return lifecycle;
}
