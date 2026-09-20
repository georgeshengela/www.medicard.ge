-- Owner-requested removal. Apply after backing up the eleven retired tables.
-- Explicit RESTRICT: fail rather than remove a dependency from another feature.
-- MEDIRUN / MEDIPULSI, User, HealthMetricDaily and StepLog are not modified.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DELETE FROM public."AdminAuditLog"
WHERE starts_with(action, 'tbilisi_moves.')
   OR starts_with("targetType", 'tbilisi_moves_');

UPDATE public."Admin" a
SET capabilities = (
  SELECT COALESCE(jsonb_agg(value ORDER BY ordinal), '[]'::jsonb)
  FROM jsonb_array_elements(a.capabilities) WITH ORDINALITY AS c(value, ordinal)
  WHERE value NOT IN (
    '"TBILISI_MOVES_VIEW"'::jsonb, '"TBILISI_MOVES_MANAGE"'::jsonb,
    '"TBILISI_MOVES_REVIEW"'::jsonb, '"TBILISI_MOVES_CORRECT"'::jsonb
  )
)
WHERE jsonb_typeof(capabilities) = 'array'
  AND capabilities ?| ARRAY[
    'TBILISI_MOVES_VIEW', 'TBILISI_MOVES_MANAGE',
    'TBILISI_MOVES_REVIEW', 'TBILISI_MOVES_CORRECT'
  ];

DROP TABLE IF EXISTS
  public."TbilisiMovesAward",
  public."TbilisiMovesConfig",
  public."TbilisiMovesCredit",
  public."TbilisiMovesDistrict",
  public."TbilisiMovesDistrictDay",
  public."TbilisiMovesIngestHold",
  public."TbilisiMovesMembership",
  public."TbilisiMovesMembershipPeriod",
  public."TbilisiMovesObservation",
  public."TbilisiMovesResultRevision",
  public."TbilisiMovesRound"
RESTRICT;

COMMIT;
