/**
 * Cron flag for თბილისი მოძრაობს finalization. Keep false on the API web
 * service. Only the prepared cron sets TBILISI_MOVES_FINALIZE_SCHEDULED=true.
 */
export function finalizeSchedulerConfigured(env = process.env) {
  const raw = String(env.TBILISI_MOVES_FINALIZE_SCHEDULED || '').trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes';
}
