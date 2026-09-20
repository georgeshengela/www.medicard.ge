import { getUsage, reserveAiCredit, commitAiCredit, releaseAiCredit } from '../lib/usage.js';
import { FREE_CONSUMER_RELEASE } from '../lib/consumerAccess.js';

export const QUOTA_EXCEEDED_MESSAGE_KA =
  'დღიური ლიმიტი ამოიწურა. განახლდება ხვალ ამავე საათზე, ან აირჩიეთ უფრო მაღალი გეგმა.';

export const AI_RATE_LIMIT_MESSAGE_KA = 'ძალიან ბევრი AI მოთხოვნა. ცოტა ხანში სცადე.';

function quotaBody(usage, { code = 'DAILY_LIMIT_REACHED', error = QUOTA_EXCEEDED_MESSAGE_KA } = {}) {
  if (FREE_CONSUMER_RELEASE || code === 'AI_BUSY' || code === 'RATE_LIMITED') return { error, code, usage };
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
      const error = reservation.reason === 'RATE_LIMITED' ? AI_RATE_LIMIT_MESSAGE_KA : reservation.reason === 'AI_BUSY' ? 'ანალიზი უკვე მიმდინარეობს. დაელოდე დასრულებას და ხელახლა სცადე.' : QUOTA_EXCEEDED_MESSAGE_KA;
      return res.status(status).json(
        quotaBody(reservation.usage, { code: reservation.reason || 'DAILY_LIMIT_REACHED', error }),
      );
    }

    req.usage = reservation.usage;
    const state = { reserved: reservation.reserved, committed: false, released: false };
    let settlement = null;
    let releasePromise = null;
    // Close/finish must not release a slot while its completion transaction is committing.
    req.settleAiOperation = (work) => {
      if (settlement) return settlement;
      if (state.released) return Promise.reject(new Error('AI_REQUEST_ALREADY_RELEASED'));
      settlement = Promise.resolve().then(work).then(result => {
        state.committed = true;
        return result;
      });
      return settlement;
    };

    req.consumeAiCredit = async () => {
      if (state.committed) return req.usage;
      if (!state.reserved) {
        state.committed = true;
        req.usage = reservation.usage;
        return req.usage;
      }
      req.usage = await req.settleAiOperation(() => commitAiCredit(req.user.id));
      state.committed = true;
      return req.usage;
    };

    req.markAiCreditSettled = () => {
      state.committed = true;
    };

    req.releaseAiCredit = async () => {
      if (!releasePromise) releasePromise = (async () => {
        if (settlement) await settlement.catch(() => undefined);
        if (state.committed || state.released || !state.reserved) return;
        state.released = true;
        await releaseAiCredit(req.user.id);
      })();
      return releasePromise;
    };

    const releaseIfUnused = () => {
      void req.releaseAiCredit().catch(() => console.warn('[ai] reservation cleanup failed'));
    };
    res.on('finish', releaseIfUnused);
    res.on('close', releaseIfUnused);

    return next();
  } catch (error) {
    return next(error);
  }
}
