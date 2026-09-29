import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  JWT_EXPIRES_IN: z.string().default('30d'),

  EVIDENCEMD_API_KEY: z.string().min(1, 'EVIDENCEMD_API_KEY is required'),
  EVIDENCEMD_BASE_URL: z.string().url().default('https://evidencemd.ai/api/v1'),
  EVIDENCEMD_MODEL: z.string().default('evidencemd-pro'),

  // Vision + default chat: OpenRouter. User can switch to Ling or EvidenceMD in Profile.
  OPENROUTER_API_KEY: z.string().default(''),
  OPENROUTER_BASE_URL: z.string().url().default('https://openrouter.ai/api/v1'),
  OPENROUTER_MODEL: z.string().default('google/gemini-3.8-flash'),

  // Optional Georgian reply voice. Keys stay on the server; never EXPO_PUBLIC.
  AZURE_SPEECH_KEY: z.string().default(''),
  AZURE_SPEECH_REGION: z.string().regex(/^[a-z0-9-]*$/).default(''),
  AZURE_SPEECH_VOICE: z.enum(['ka-GE-EkaNeural', 'ka-GE-GiorgiNeural']).default('ka-GE-EkaNeural'),
  // English Medi voice; same list as ENGLISH_SPEECH_VOICES in lib/assistantSpeech.js (not imported: it imports env).
  AZURE_SPEECH_VOICE_EN: z.enum(['en-US-AvaNeural', 'en-US-JennyNeural', 'en-US-AndrewNeural', 'en-GB-SoniaNeural']).optional(),

  ANTHROPIC_API_KEY: z.string().default(''),
  ANTHROPIC_MODEL: z.string().default('claude-3-5-sonnet-latest'),
  OPENAI_API_KEY: z.string().default(''),
  OPENAI_MODEL: z.string().default('gpt-4o'),

  FREE_DAILY_AI_LIMIT: z.coerce.number().int().positive().default(3),
  FREE_MONTHLY_AI_LIMIT: z.coerce.number().int().positive().default(90),

  ADMIN_EMAIL: z.string().email().default('admin@medicard.ge'),
  // The seed policy requires an explicit secret for a new production admin.
  ADMIN_PASSWORD: z.union([z.literal(''), z.string().min(8)]).default(''),
  ADMIN_FULL_NAME: z.string().default('Medicard Admin'),

  RESEND_API_KEY: z.string().default(''),
  RESEND_FROM: z.string().default('Medicard <noreply@medicard.ge>'),
  /** Svix signing secret (whsec_…) of the Resend webhook → POST /api/email/webhook. Empty = webhook refused (503). */
  RESEND_WEBHOOK_SECRET: z.string().default(''),
  /** Replies to any Medicard email go here. */
  EMAIL_REPLY_TO: z.string().default('support@medicard.ge'),
  /**
   * Optional Resend key with "Full access", used ONLY to read received mail (support inbox):
   * GET /emails/receiving/{id} and its attachments. A "Sending access" key can only send, so
   * without this the inbox keeps webhook metadata only (sender, subject, attachment names).
   */
  RESEND_INBOUND_API_KEY: z.string().default(''),
  /** Sender of admin replies from #/support. */
  SUPPORT_FROM: z.string().default('MEDICARD მხარდაჭერა <support@medicard.ge>'),
  /** Owner notice on new support threads (subject only, max 1 per 10 min). Empty = off. */
  SUPPORT_NOTIFY_EMAIL: z.string().default(''),
  /** Store links for the welcome email; empty = https://medicard.ge/#download. */
  APP_STORE_URL: z.string().default(''),
  PLAY_STORE_URL: z.string().default(''),

  SMS_OFFICE_API_KEY: z.string().default(''),
  SMS_OFFICE_SENDER: z.string().default('MEDICARD'),

  /** QA master OTP. Set to 0000 while testers work; leave empty to turn off. */
  QA_OTP_CODE: z.string().default(''),

  /**
   * App Review sign-in (Guideline 2.1): one Georgian number whose SMS is never sent and
   * which accepts this fixed 4-digit code, production included. Both empty = off.
   * Set only in the host's env and App Store Connect review notes, never in the repo.
   */
  APP_REVIEW_PHONE: z.string().default(''),
  APP_REVIEW_OTP: z.union([z.literal(''), z.string().regex(/^\d{4}$/)]).default(''),

  // Optional. Required only if the Expo project has Enhanced Push Security on.
  EXPO_ACCESS_TOKEN: z.string().default(''),

  /** Mapbox public token (pk.*) for the admin user-country map. */
  MAPBOX_PUBLIC_TOKEN: z.string().default(''),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  • ${i.path.join('.')}: ${i.message}`).join('\n');
  console.error(`\n[medicard] Invalid environment configuration:\n${issues}\n`);
  process.exit(1);
}

export const env = parsed.data;

export const hasVisionProvider = Boolean(
  env.OPENROUTER_API_KEY || env.ANTHROPIC_API_KEY || env.OPENAI_API_KEY,
);
