/**
 * The web server is one Node process on one CPU: a long synchronous loop stops every other request
 * (2026-10-13: rebuilding the pharmacy compare index froze the whole server ~1 s every few minutes).
 * A long loop asks `due()` between items and, when the current slice has run `ms`, awaits `pause()`
 * so other requests get a turn.
 */
export function cpuSlicer(ms = 8) {
  let start = performance.now();
  return {
    due: () => performance.now() - start >= ms,
    pause: () =>
      new Promise((resolve) => {
        setImmediate(() => {
          start = performance.now();
          resolve();
        });
      }),
  };
}
