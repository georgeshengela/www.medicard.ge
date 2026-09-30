import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { asyncHandler } from '../middleware/error.js';
import { clientIp } from '../lib/rateLimitKey.js';
import { contactSchema, submitContactForm } from '../lib/support/contactForm.js';
import { t } from '../lib/i18n.js';

/**
 * POST /api/contact — the site contact form (medicard.ge/contact). No auth; its own IP limit
 * (never a global /api limiter). The message becomes a thread in admin #/support.
 */
export const contactRouter = Router();

const contactLimiter = rateLimit({
  windowMs: 60 * 60_000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  keyGenerator: (req) => clientIp(req),
  message: (req) => ({
    error: t(req, 'ძალიან ბევრი წერილი. სცადე ერთ საათში ან მოგვწერე support@medicard.ge-ზე.', 'Too many messages. Try again in an hour or write to support@medicard.ge.'),
    code: 'RATE_LIMITED',
  }),
});

contactRouter.post(
  '/',
  contactLimiter,
  asyncHandler(async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const parsed = contactSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({
        error: t(req, 'შეავსე სახელი, ელფოსტა და წერილი.', 'Please fill in your name, email and message.'),
        code: 'CONTACT_INVALID',
      });
    }
    const result = await submitContactForm(parsed.data);
    if (!result.ok) {
      return res.status(400).json({ error: t(req, 'ელფოსტის მისამართი არასწორია.', 'That email address is not valid.'), code: result.code });
    }
    return res.status(201).json({ ok: true });
  }),
);
