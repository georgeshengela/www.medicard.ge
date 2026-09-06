import type { Router } from 'expo-router';

type WeightRouter = Pick<Router, 'replace' | 'push'> & {
  dismissTo?: (href: string) => void;
};

const HUB = '/health-metrics/weight';
const PROGRESS = '/health-metrics/weight/goal';
const WIZARD_TARGET = '/health-metrics/weight/goal/target';

function dismissToHub(router: WeightRouter) {
  if (typeof router.dismissTo === 'function') {
    try {
      router.dismissTo(HUB);
      return true;
    } catch {
      /* route may not be in the stack */
    }
  }
  return false;
}

/** Leave the wizard. Home and back always land on the weight hub. */
export function goToWeightHub(router: WeightRouter) {
  if (!dismissToHub(router)) router.replace(HUB as never);
}

/** After saving a goal: started page, with no wizard screens underneath. */
export function goToGoalStarted(router: WeightRouter) {
  if (dismissToHub(router)) {
    router.push(PROGRESS as never);
    return;
  }
  router.replace(PROGRESS as never);
}

export function goToGoalProgress(router: WeightRouter) {
  router.push(PROGRESS as never);
}

/** Only when there is no active goal, or they explicitly start a new one. */
export function startWeightGoalWizard(router: WeightRouter) {
  router.push(WIZARD_TARGET as never);
}
