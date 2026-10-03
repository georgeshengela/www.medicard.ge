/**
 * Cache keys of the cycle module in the server-data cache (`['acct', accountId, ...key]`).
 * Every key starts with 'cycle', so any successful write under /api/cycle (queryInvalidation.ts)
 * and every offline-queue write (enqueueCycleOp → invalidate('cycle')) marks all of them stale.
 * Pure (no React Native imports) so node tests can check that contract.
 */
export const CYCLE_QUERY_KEYS = {
  /** Local-first bundle (loadCycleView, offline overlay included) — Home card and every cycle screen. */
  view: ['cycle', 'view'],
  /** GET /api/cycle/pregnancy — pregnancy timeline and week screens. */
  pregnancy: ['cycle', 'pregnancy'],
  /** GET /api/cycle/pregnancy/care-plan. */
  pregnancyCarePlan: ['cycle', 'pregnancy-care-plan'],
  /** GET /api/cycle/observation-trends — trends screen and the journal pane. */
  observationTrends: ['cycle', 'observation-trends'],
  /** GET /api/cycle/prediction-history — journal pane. */
  predictionHistory: ['cycle', 'prediction-history'],
} as const;
