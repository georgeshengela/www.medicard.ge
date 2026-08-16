import { getUsage } from '../lib/usage.js';
import { consumeUsage } from '../lib/usage.js';

export const QUOTA_EXCEEDED_MESSAGE_KA =
  'დღიური ლიმიტი ამოიწურა. განაახლეთ პაკეტი ან სცადეთ ხვალ.';

/**
 * Enforces the user's package quota before any AI engine is called.
 */
export async function enforceAiQuota(req, res, next) {
  try {
    const quota = await getUsage(req.user.id);

    if (quota.exceeded) {
      return res.status(429).json({
        error: QUOTA_EXCEEDED_MESSAGE_KA,
        code: 'DAILY_LIMIT_REACHED',
        upsell: {
          title: 'გახსენით უკეთესი პაკეტი',
          body: 'სტანდარტი ან ულტიმატი — მეტი AI კონსულტაცია და სრული მოდულები.',
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
