/**
 * Login as Cycle Phase 6 QA user and print server-owned Cycle facts.
 * Usage: node scripts/cycle-phase6-qa-verify.js [--api=https://medicard.ge]
 */
import 'dotenv/config';

const EMAIL = 'cycle.qa.phase6@medicard.ge';
const PASSWORD = 'CycleQaPhase6!';
const API = (process.argv.find((a) => a.startsWith('--api=')) || '').slice(6) || 'https://medicard.ge';

async function main() {
  const loginRes = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const loginBody = await loginRes.json();
  if (!loginRes.ok) {
    console.error('LOGIN_FAIL', loginRes.status, loginBody);
    process.exit(1);
  }
  const token = loginBody.token;
  const cycleRes = await fetch(`${API}/api/cycle`, {
    headers: { Authorization: `Bearer ${token}`, 'X-Client-Timezone': 'Asia/Tbilisi' },
  });
  const bundle = await cycleRes.json();
  if (!cycleRes.ok) {
    console.error('CYCLE_FAIL', cycleRes.status, bundle);
    process.exit(1);
  }

  const today = bundle.today ?? bundle.civilToday;
  const pred = bundle.predictions || {};
  const summary = {
    api: API,
    userId: loginBody.user?.id,
    gender: loginBody.user?.gender,
    today,
    phase: bundle.phase ?? bundle.current?.phase ?? pred.phase,
    cycleDay: bundle.cycleDay ?? bundle.current?.cycleDay ?? bundle.current?.day,
    confidence: pred.confidence,
    late: (bundle.alerts || []).some((a) => a.type === 'late' || a.late || a.kind === 'late'),
    alerts: bundle.alerts,
    nextPeriod: pred.nextPeriodStart ?? pred.nextPeriod,
    fertileWindow: pred.fertileWindow ?? pred.fertile,
    ovulation: pred.ovulationDate ?? pred.ovulation,
    showFertilityMarkers: bundle.showFertilityMarkers ?? bundle.contraception?.showFertilityMarkers,
    contraception: bundle.contraception,
    logCount: Array.isArray(bundle.logs) ? bundle.logs.length : undefined,
    historyCount: bundle.history?.length ?? bundle.periodHistory?.length,
  };
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
