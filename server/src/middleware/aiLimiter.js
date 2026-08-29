import { getUsage } from '../lib/usage.js';
import { consumeUsage } from '../lib/usage.js';

export const QUOTA_EXCEEDED_MESSAGE_KA =
  'დღიური ლიმიტი ამოიწურა. განახლდება ხვალ ამავე საათზე, ან აირჩიეთ უფრო მაღალი გეგმა.';

/**
 * Enforces the user's daily AI cap before any AI engine is called.
 * The 24h countdown starts when they hit the last query, not at midnight / month end.
 */
export async function enforceAiQuota(req, res, next) {
  try {
    const quota = await getUsage(req.user.id);

    if (quota.exceeded) {
      return res.status(429).json({
        error: QUOTA_EXCEEDED_MESSAGE_KA,
        code: 'DAILY_LIMIT_REACHED',
        upsell: {
          title: 'განაახლეთ გეგმა',
          body: 'სტანდარტი — 50 AI / დღე · ულტიმატი — შეუზღუდავი.',
          cta: 'გეგმის არჩევა',
        },
        usage: quota,
      });
    }

    req.usage = quota;
    let spent = false;
    req.consumeAiCredit = async () => {
      if (spent) return req.usage;
      spent = true;
      req.usage = await consumeUsage(req.user.id);
      return req.usage;
    };

    return next();
  } catch (error) {
    return next(error);
  }
}
