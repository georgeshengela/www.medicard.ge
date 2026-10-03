/**
 * What „დღის რჩევები“ on /cycle does when it mounts (W3-2). The AI cards need AI consent; opening the
 * cycle screen must never open the consent sheet by itself — after a decline it used to ask again on
 * every visit. So the screen only reads the consent state quietly:
 *
 *  - accepted (or answered „yes“ earlier in this session) → load the AI cards as before;
 *  - not answered / declined / the state could not be read → the local tips only, plus one quiet row
 *    „Medi-ს რჩევები ჩანაწერების მიხედვით · ჩართვა“ that asks for consent only when tapped;
 *  - offline → whatever is cached, nothing is requested.
 *
 * Never pre-accepts. Pure: node tests load it.
 */

export type CycleInsightsGate = 'offline' | 'on' | 'ask';

export function cycleInsightsMountGate({
  offline,
  freshConsent = false,
  consent = null,
}: {
  offline: boolean;
  /** The session already remembers an accepted consent (no read needed). */
  freshConsent?: boolean;
  /** `GET /api/ai-consent` result, or null when it was not / could not be read. */
  consent?: { accepted?: boolean | null } | null;
}): CycleInsightsGate {
  if (offline) return 'offline';
  if (freshConsent) return 'on';
  return consent?.accepted === true ? 'on' : 'ask';
}

/** Whether the mount needs the quiet consent read at all (offline and a remembered „yes“ do not). */
export function cycleInsightsNeedsConsentRead({ offline, freshConsent = false }: { offline: boolean; freshConsent?: boolean }): boolean {
  return !offline && !freshConsent;
}

/** AI cards (and the seeded cached ones) are shown only once AI is on; otherwise the local tips alone. */
export function cycleInsightsShowsAiCards(gate: CycleInsightsGate | null): boolean {
  return gate === 'on' || gate === 'offline';
}
