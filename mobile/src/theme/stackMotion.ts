export type StackMotionIntent = 'detail' | 'peer' | 'completion';

/** Motion describes the relationship, not the feature's branding.
 * Native detail transitions retain iOS interactive back and Android defaults.
 * Peers/completions have no horizontal direction. Reduced Motion is immediate.
 * Duration only customizes animations supported by the native stack (e.g. fade).
 */
export function stackMotion(intent: StackMotionIntent, reduced: boolean) {
  if (reduced) return { animation: 'none' as const, freezeOnBlur: true };
  if (intent === 'peer' || intent === 'completion') {
    return { animation: 'fade' as const, animationDuration: 180, freezeOnBlur: true };
  }
  return { animation: 'default' as const, freezeOnBlur: true };
}
