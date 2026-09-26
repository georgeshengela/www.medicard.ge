/**
 * Face ID / Touch ID is no longer an onboarding step (2026-09-27). It is offered once,
 * on Home, from the person's second app launch — after they have seen the app work.
 * Pure decision; the host component does the I/O.
 */
export type BiometricOfferInput = {
  completed: boolean;
  alreadyPrompted: boolean;
  launches: number;
  available: boolean;
  enrolled: boolean;
  onHome: boolean;
  otherPromptOpen: boolean;
};

export function shouldOfferBiometric(input: BiometricOfferInput): boolean {
  return (
    input.completed &&
    !input.alreadyPrompted &&
    input.launches >= 2 &&
    input.available &&
    input.enrolled &&
    input.onHome &&
    !input.otherPromptOpen
  );
}
