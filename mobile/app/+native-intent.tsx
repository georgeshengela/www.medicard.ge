import { redirectCycleWidgetPath } from '@/lib/cycleWidgetLink';

/**
 * Incoming system URLs (expo-router). Only the cycle widget's „დაიწყო“ link is taken over: it is
 * claimed once and opened by the root layout after the signed-in shell is ready
 * (`src/lib/cycleWidgetLink.ts`). Every other URL goes to the router unchanged.
 */
export function redirectSystemPath({ path, initial }: { path: string; initial: boolean }): string {
  try {
    // `null` (a repeat event while the app is open) makes expo-router ignore the URL.
    return redirectCycleWidgetPath(path, initial) as string;
  } catch {
    return path;
  }
}
