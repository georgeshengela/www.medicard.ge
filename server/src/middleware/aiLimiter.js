import { getUsage, reserveAiCredit, commitAiCredit, releaseAiCredit } from '../lib/usage.js';

export const QUOTA_EXCEEDED_MESSAGE_KA =
  'დღიური ლიმიტი ამოიწურა. განახლდება ხვალ ამავე საათზე, ან აირჩიეთ უფრო მაღალი გეგმა.';

export const AI_RATE_LIMIT_MESSAGE_KA = 'ძალიან ბევრი AI მოთხოვნა. ცოტა ხანში სცადე.';

function quotaBody(usage, { code = 'DAILY_LIMIT_REACHED', error = QUOTA_EXCEEDED_MESSAGE_KA } = {}) {
  return {
    error,
    code,
    upsell: {
      title: 'განაახლეთ გეგმა',
      body: 'სტანდარტი — 50 AI / დღე · ულტიმატი — შეუზღუდავი.',
      cta: 'გეგმის არჩევა',
    },
    usage,
  };
}

/**
 * Enforces the user's daily AI cap before any AI engine is called.
 * Unused credits reset at Tbilisi midnight. Hitting the last query starts a 24h countdown from that moment.
 * One COMPLETE request consumes once; replay/cancel/fail/partial release the reservation and do not consume.
 */
export async function enforceAiQuota(req, res, next) {
  try {
    const quota = await getUsage(req.user.id);

    if (quota.exceeded) {
      return res.status(429).json(quotaBody(quota));
    }

    const reservation = await reserveAiCredit(req.user.id);
    if (!reservation.ok) {
      const status = reservation.reason === 'RATE_LIMITED' ? 429 : 429;
      const error = reservation.reason === 'RATE_LIMITED' ? AI_RATE_LIMIT_MESSAGE_KA : QUOTA_EXCEEDED_MESSAGE_KA;
      return res.status(status).json(
        quotaBody(reservation.usage, { code: reservation.reason || 'DAILY_LIMIT_REACHED', error }),
      );
    }

    req.usage = reservation.usage;
    const state = { reserved: reservation.reserved, committed: false, released: false };

    req.consumeAiCredit = async () => {
      if (state.committed) return req.usage;
      if (!state.reserved) {
        state.committed = true;
        req.usage = reservation.usage;
        return req.usage;
      }
      req.usage = await commitAiCredit(req.user.id);
      state.committed = true;
      return req.usage;
    };

    req.markAiCreditSettled = () => {
      state.committed = true;
    };

    req.releaseAiCredit = async () => {
      if (state.committed || state.released || !state.reserved) return;
      state.released = true;
      await releaseAiCredit(req.user.id);
    };

    const releaseIfUnused = () => {
      void req.releaseAiCredit();
    };
    res.on('finish', releaseIfUnused);
    res.on('close', releaseIfUnused);

    return next();
  } catch (error) {
    return next(error);
  }
}
