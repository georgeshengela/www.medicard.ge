import { useMemo } from 'react';
import { useFeatureState } from '@/lib/featureFlags';
import { useCyclePrivacyLock } from '@/lib/cycleReminderPrefs';
import { resolveHomeLayout, storedHomeLayout, type HomeLayoutResolution } from '@/lib/home/homeLayout';
import { useHomeLayoutPending } from '@/lib/home/homeLayoutStore';
import { useAuth } from '@/store/AuthContext';

/**
 * The Home layout to render now (synchronous on the first frame: the server value came with
 * /auth/me, an unsent device choice was restored before `ready`). Flag and gender changes apply
 * at once; the stored choice itself is never rewritten by them.
 */
export function useHomeLayout(): HomeLayoutResolution & { cycleLocked: boolean | null } {
  const { user, healthProfile } = useAuth();
  const features = useFeatureState();
  const pending = useHomeLayoutPending();
  const cycleLocked = useCyclePrivacyLock();
  const extra = healthProfile?.extraAnswers;
  const userId = user?.id;
  const gender = user?.gender;
  return useMemo(() => {
    const server = storedHomeLayout(extra);
    const mine = pending && pending.account === userId ? pending : null;
    const chosen = mine?.layout ?? server.layout;
    const offerDone = Boolean(mine?.offerDone) || server.offerDone;
    return {
      ...resolveHomeLayout({ chosen, offerDone, gender, features, cycleLocked: cycleLocked !== false }),
      cycleLocked,
    };
  }, [extra, pending, userId, gender, features, cycleLocked]);
}
