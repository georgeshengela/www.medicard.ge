/** True only for background → active. `inactive` alone (iOS system sheets) is not leaving the app. */
export function isReturnFromBackground(previous: string | null | undefined, next: string): boolean {
  return next === 'active' && previous === 'background';
}
