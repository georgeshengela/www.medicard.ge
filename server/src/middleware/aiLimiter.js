import { getUsage } from '../lib/usage.js';
import { consumeUsage } from '../lib/usage.js';

export const QUOTA_EXCEEDED_MESSAGE_KA =
  'თვიური ლიმიტი ამოიწურა. განაახლეთ გამოწერა ან დაელოდეთ ახალ პერიოდს.';

/**
 * Enforces the user's monthly package quota before any AI engine is called.
 */
export async function enforceAiQuota(req, res, next) {
  try {
    const quota = await getUsage(req.user.id);

    if (quota.exceeded) {
      return res.status(429).json({
        error: QUOTA_EXCEEDED_MESSAGE_KA,
        code: 'MONTHLY_LIMIT_REACHED',
        upsell: {
          title: 'განაახლეთ თვიური გამოწერა',
          body: 'სტანდარტი — 1 500 AI / თვე · ულტიმატი — შეუზღუდავი. ყველა პაკეტი 30-დღიანი პერიოდით.',
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
