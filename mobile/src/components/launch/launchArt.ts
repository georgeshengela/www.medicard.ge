/**
 * Geometry of the launch screen (owner 2026-10-17, train 1.0.0.26): the native splash shows the welcome
 * screen's velvet heartbeat disc on the velvet surface, and the JS launch curtain starts from the very
 * same picture. Plain constants with no imports, so `scripts/generate-launch-art.mjs` can read them too.
 */

/** Disc diameter in points on the native splash and the curtain's first frame. */
export const SPLASH_DISC = 184;

/** Side of the square splash image in points (`imageWidth` in app.json): the disc plus room for its shadows. */
export const SPLASH_ART = 320;
