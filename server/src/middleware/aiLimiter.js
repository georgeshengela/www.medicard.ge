import { consumeUsage, getUsage } from '../lib/usage.js';

export const QUOTA_EXCEEDED_MESSAGE_KA =
  'დღიური 3 უფასო შეკითხვა ამოიწურა. გთხოვთ, სცადეთ ხვალ.';

/**
 * Enforces the free tier before any AI engine is called, then hands the route a
 * `req.consumeAiCredit()` callback. The credit is only spent once a generation has
 * actually succeeded, so a failed upstream call never costs the user a query.
 */
export async function enforceAiQuota(req, res, next) {
  try {
    const quota = await getUsage(req.user.id);

    if (quota.exceeded) {
      return res.status(429).json({
        error: QUOTA_EXCEEDED_MESSAGE_KA,
        code: 'DAILY_LIMIT_REACHED',
        upsell: {
          title: 'გახსენით Medicard Premium',
          body: 'შეუზღუდავი AI კონსულტაციები, ანალიზების გაშიფვრა და კონსილიუმი — თვეში 19.99 ₾.',
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
