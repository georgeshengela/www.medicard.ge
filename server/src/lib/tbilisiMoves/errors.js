export function tbilisiMovesError(status, code, message, extra = {}) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  Object.assign(err, extra);
  return err;
}

const PHASE4_OBJECTS =
  /TbilisiMoves|leaderRecognitionEnabled|leaderRewardedRanks|districtGoalBadgeEnabled|resultRevision|latestResultId|TbilisiMovesResultRevision|TbilisiMovesAward/i;

export function isTbilisiMovesSchemaMissing(error) {
  const blob = `${error?.meta?.modelName || ''} ${error?.meta?.table || ''} ${error?.meta?.column || ''} ${error?.message || ''}`;
  if (error?.code === 'P2021') {
    if (!error?.meta?.modelName && !error?.meta?.table) return true;
    return PHASE4_OBJECTS.test(blob);
  }
  if (error?.code === 'P2022' && PHASE4_OBJECTS.test(blob)) return true;
  return /does not exist/i.test(blob) && PHASE4_OBJECTS.test(blob);
}

export function schemaUnavailableBody() {
  return {
    schemaReady: false,
    error: 'თბილისი მოძრაობს ჯერ მზად არ არის.',
    code: 'SCHEMA_NOT_READY',
  };
}

export function schemaUnavailable() {
  return tbilisiMovesError(503, 'SCHEMA_NOT_READY', 'თბილისი მოძრაობს ჯერ მზად არ არის.');
}

export function featureDisabled() {
  return tbilisiMovesError(404, 'FEATURE_DISABLED', 'თბილისი მოძრაობს ამჟამად მიუწვდომელია.');
}
