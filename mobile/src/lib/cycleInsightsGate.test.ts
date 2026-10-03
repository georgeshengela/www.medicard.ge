// W3-2: /cycle's „დღის რჩევები“ never opens the AI consent sheet because the screen opened.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cycleInsightsMountGate, cycleInsightsNeedsConsentRead, cycleInsightsShowsAiCards } from './cycleInsightsGate.ts';

describe('cycleInsightsMountGate', () => {
  it('consent missing, declined or unreadable → local tips + the quiet row (no AI request)', () => {
    assert.equal(cycleInsightsMountGate({ offline: false, consent: { accepted: false } }), 'ask');
    assert.equal(cycleInsightsMountGate({ offline: false, consent: { accepted: null } }), 'ask');
    assert.equal(cycleInsightsMountGate({ offline: false, consent: null }), 'ask');
    assert.equal(cycleInsightsMountGate({ offline: false }), 'ask');
  });

  it('accepted (read now or remembered this session) → loads as before', () => {
    assert.equal(cycleInsightsMountGate({ offline: false, consent: { accepted: true } }), 'on');
    assert.equal(cycleInsightsMountGate({ offline: false, freshConsent: true }), 'on');
  });

  it('offline → cached only, nothing read or requested', () => {
    assert.equal(cycleInsightsMountGate({ offline: true, consent: { accepted: true } }), 'offline');
    assert.equal(cycleInsightsNeedsConsentRead({ offline: true }), false);
    assert.equal(cycleInsightsNeedsConsentRead({ offline: false, freshConsent: true }), false);
    assert.equal(cycleInsightsNeedsConsentRead({ offline: false }), true);
  });

  it('AI cards (and the cached seed) show only once AI is on', () => {
    assert.equal(cycleInsightsShowsAiCards('ask'), false);
    assert.equal(cycleInsightsShowsAiCards(null), false);
    assert.equal(cycleInsightsShowsAiCards('on'), true);
    assert.equal(cycleInsightsShowsAiCards('offline'), true);
  });
});

describe('CycleInsights.tsx mounts without asking for consent', () => {
  const src = readFileSync(new URL('../components/cycle/CycleInsights.tsx', import.meta.url), 'utf8');
  const effect = src.slice(src.indexOf('useEffect(() => {\n    if (offline) {'), src.indexOf('// eslint-disable-next-line react-hooks/exhaustive-deps -- mount once'));

  it('the mount effect reads consent quietly and loads only when the gate is on', () => {
    assert.ok(effect.length > 0, 'mount effect found');
    assert.match(effect, /api\.aiConsent\.read\(\)/);
    assert.match(effect, /cycleInsightsMountGate/);
    // The one load on mount sits behind the gate; nothing else in the effect reaches the AI route.
    assert.deepEqual(effect.match(/\bload\(/g), ['load(']);
    assert.match(effect, /if \(next === 'on'\) void load\(false\);/);
    assert.doesNotMatch(effect, /api\.cycle\.insights|ensureAiSharingConsentForRequest|requestAiSharingPrompt/);
  });

  it('the quiet row is the only other entry and passes `asked`', () => {
    assert.match(src, /const enableAi = \(\) => \{[\s\S]*?void load\(false, true\);/);
    assert.ok(src.includes("tx('Medi-ს რჩევები ჩანაწერების მიხედვით', \"Medi's tips from your logs\")"));
    assert.ok(src.includes("tx('ჩართვა', 'Turn on')"));
  });

  it('never pre-accepts', () => {
    assert.doesNotMatch(src, /aiConsent\.save|decideAiSharing|accepted: true/);
  });
});
