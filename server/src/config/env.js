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

  ANTHROPIC_API_KEY: z.string().default(''),
  ANTHROPIC_MODEL: z.string().default('claude-3-5-sonnet-latest'),
  OPENAI_API_KEY: z.string().default(''),
  OPENAI_MODEL: z.string().default('gpt-4o'),

  FREE_DAILY_AI_LIMIT: z.coerce.number().int().positive().default(3),
  FREE_MONTHLY_AI_LIMIT: z.coerce.number().int().positive().default(90),

  ADMIN_EMAIL: z.string().email().default('admin@medicard.ge'),
  ADMIN_PASSWORD: z.string().min(8).default('MedicardAdmin1!'),
  ADMIN_FULL_NAME: z.string().default('Medicard Admin'),

  RESEND_API_KEY: z.string().default(''),
  RESEND_FROM: z.string().default('Medicard <noreply@medicard.ge>'),

  SMS_OFFICE_API_KEY: z.string().default(''),
  SMS_OFFICE_SENDER: z.string().default('MEDICARD'),

  /** QA master OTP. Set to 0000 while testers work; leave empty to turn off. */
  QA_OTP_CODE: z.string().default(''),

  // Optional. Required only if the Expo project has Enhanced Push Security on.
  EXPO_ACCESS_TOKEN: z.string().default(''),

  /** Mapbox public token (pk.*) for the admin user-country map. */
  MAPBOX_PUBLIC_TOKEN: z.string().default(''),
  /** Medi World. Unset: on. Set `0` to hide. */
  MEDI_WORLD_ENABLED: z.string().optional().default(''),
  /** Medi World Explore. Unset: follows Medi World. */
  MEDI_WORLD_EXPLORE_ENABLED: z.string().optional().default(''),
  /** Medi World Movement. Unset: follows Medi World. */
  MEDI_WORLD_MOVEMENT_ENABLED: z.string().optional().default(''),
  /** Medi World Garden. Unset: follows Medi World. */
  MEDI_WORLD_GARDEN_ENABLED: z.string().optional().default(''),
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
