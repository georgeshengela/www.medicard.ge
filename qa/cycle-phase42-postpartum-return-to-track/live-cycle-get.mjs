/**
 * Login as Cycle QA and print forecastEligibility + prediction leak fields.
 * Usage: node qa/cycle-phase42-postpartum-return-to-track/live-cycle-get.mjs
 */
const API = process.env.CYCLE_API || 'http://localhost:4000';
const EMAIL = 'cycle.qa.phase6@medicard.ge';
const PASSWORD = 'CycleQaPhase6a';

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
const cycleRes = await fetch(`${API}/api/cycle`, {
  headers: {
    Authorization: `Bearer ${loginBody.token}`,
    'X-Client-Timezone': 'Asia/Tbilisi',
  },
});
const bundle = await cycleRes.json();
if (!cycleRes.ok) {
  console.error('CYCLE_FAIL', cycleRes.status, bundle);
  process.exit(1);
}
const pred = bundle.predictions || {};
const profile = bundle.profile || {};
console.log(
  JSON.stringify(
    {
      mode: profile.mode,
      profileHasForecastGateKind: Object.hasOwn(profile, 'forecastGateKind'),
      profileHasForecastGateEpisodeId: Object.hasOwn(profile, 'forecastGateEpisodeId'),
      forecastEligibility: bundle.forecastEligibility,
      phase: bundle.phase ?? pred.phase,
      nextPeriodStart: pred.nextPeriodStart ?? null,
      ovulationDate: pred.ovulationDate ?? null,
      fertileWindow: pred.fertileWindow ?? null,
      late: (bundle.alerts || []).some((a) => a.type === 'late' || a.kind === 'late'),
      classifiedDates: bundle.classifiedDates || [],
    },
    null,
    2,
  ),
);
