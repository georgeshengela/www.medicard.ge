/**
 * Runs before expo-router. Production JS fatals must not SIGABRT the TestFlight process.
 * The 1.8.61 crash lived ~98s, then RCTExceptionsManager.reportFatal aborted after the
 * 60s window. Keep swallowing fatals for the whole session in release.
 */
(function installProductionBootGuard() {
  const inDev = typeof __DEV__ !== 'undefined' && __DEV__;
  if (inDev) return;
  const EU = globalThis.ErrorUtils;
  if (!EU || typeof EU.getGlobalHandler !== 'function' || typeof EU.setGlobalHandler !== 'function') {
    return;
  }
  EU.setGlobalHandler((error) => {
    console.error('[Medicard] production fatal suppressed:', error);
    try {
      const Settings = require('react-native').Settings;
      if (Settings && typeof Settings.set === 'function') {
        const message = error instanceof Error ? error.message : String(error);
        Settings.set({ 'medicard.lastFatal': message.slice(0, 1800) });
      }
    } catch {
      /* never rethrow from the handler */
    }
  });
})();
