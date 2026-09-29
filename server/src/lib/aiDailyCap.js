/**
 * Per-user daily fuse on AI routes that cost money but sit outside enforceAiQuota
 * (onboarding analysis, nutrition estimate, Medi voice). In the free release the AI quota has no
 * daily limit, so a client retry loop could otherwise make thousands of paid calls per user a day.
 * Caps are far above real use; reaching one means a bug or abuse, so the owner is told (throttled).
 * Counters are per instance (memory store) — with N instances the effective cap is up to N×.
 */
import rateLimit from 'express-rate-limit';
import { RATE_LIMIT_VALIDATE } from './rateLimitKey.js';
import { loopNotifier } from './loopGuard.js';

const DAY_MS = 24 * 60 * 60 * 1000;

export const AI_DAILY_CAPS = Object.freeze({
  onboardingAnalysis: 20,
  nutritionEstimate: 150,
  assistantPlan: 500,
  assistantTranscribe: 400,
  assistantSpeak: 500,
});

export function aiDailyCapMessage(retryAfterSeconds) {
  const hours = Math.max(1, Math.ceil(Number(retryAfterSeconds || 0) / 3600));
  return {
    error: `დღევანდელი ლიმიტი ამოიწურა. ისევ სცადე დაახლოებით ${hours} საათში.`,
    code: 'AI_DAILY_CAP',
    retryAfterSeconds: Math.max(1, Math.floor(Number(retryAfterSeconds) || 0)),
  };
}

export function aiDailyCap(name, { limit = AI_DAILY_CAPS[name], windowMs = DAY_MS } = {}) {
  if (!Number.isFinite(limit) || limit < 1) throw new Error(`unknown AI daily cap: ${name}`);
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    validate: RATE_LIMIT_VALIDATE,
    keyGenerator: (req) => `ai-day:${name}:${req.user?.id || 'anon'}`,
    handler: (req, res) => {
      const reset = req.rateLimit?.resetTime;
      const seconds = reset instanceof Date ? Math.ceil(Math.max(0, reset.getTime() - Date.now()) / 1000) : windowMs / 1000;
      if (req.rateLimit?.used === limit + 1) loopNotifier.aiCapHit(req, name, limit);
      res.setHeader('Retry-After', String(Math.max(1, seconds)));
      res.setHeader('X-Medicard-Limiter', `ai-day:${name}`);
      res.status(429).json(aiDailyCapMessage(seconds));
    },
  });
}
