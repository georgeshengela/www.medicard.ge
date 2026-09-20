import { usePrefersReducedMotion } from './usePrefersReducedMotion';
import { stackMotion, type StackMotionIntent } from '@/theme/stackMotion';

/** Use inside every navigator; nested stacks do not inherit parent options. */
export function useStackMotion(intent: StackMotionIntent = 'detail') {
  return stackMotion(intent, usePrefersReducedMotion());
}
