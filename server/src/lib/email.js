/**
 * Compatibility entry point. The email system lives in ./email/ (templates, log, webhooks,
 * campaigns); passwordReset.js keeps importing sendPasswordResetCode from here.
 */
export { sendPasswordResetCode, sendEmailVerifyCode, queueWelcomeEmail, queueAccountDeletedEmail, sendEmail } from './email/index.js';
