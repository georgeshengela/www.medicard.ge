/**
 * Runs before expo-router. JS fatals still call RCTExceptionsManager.reportFatal
 * unless ErrorUtils is hooked on the real global — import { ErrorUtils } can be a no-op.
 */
const BOOT_FATAL_GUARD_MS = 60_000;
const bootStartedAt = Date.now();

(function installProductionBootGuard() {
  const EU = globalThis.ErrorUtils;
  if (!EU || typeof EU.getGlobalHandler !== 'function' || typeof EU.setGlobalHandler !== 'function') {
    return;
  }
  const previous = EU.getGlobalHandler();
  EU.setGlobalHandler((error, isFatal) => {
    if (isFatal && Date.now() - bootStartedAt < BOOT_FATAL_GUARD_MS) {
      console.error('[Medicard] boot fatal suppressed:', error);
      return;
    }
    if (typeof previous === 'function') previous(error, isFatal);
  });
})();
