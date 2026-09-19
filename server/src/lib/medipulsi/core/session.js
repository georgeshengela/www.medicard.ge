// Generated from medipulsi/src by build-core.mjs.
import { parkProgress } from './journey.js';
export function pauseJourney(s, reason = 'manual', now = Date.now()) { return { ...s, speed: 0, pauseReason: reason, pausedAt: new Date(now).toISOString(), ...(s.source === 'gps' ? { lastFix: null, lastRaw: null, match: null } : {}) }; }
export function resetSession(s) { return { ...pauseJourney(s), meters: 0, seconds: 0, movingSeconds: 0, steps: 0, speed: 0, maxSpeed: 0, sessionStartCoverage: parkProgress(s).unique, pauseReason: null, pausedAt: null, startedAt: new Date().toISOString() }; }
