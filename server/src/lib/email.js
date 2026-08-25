import { Resend } from 'resend';
import { env } from '../config/env.js';

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

function resetEmailHtml({ code, fullName }) {
  const greeting = fullName?.trim() ? `გამარჯობა, ${fullName.trim()}!` : 'გამარჯობა!';
  return `<!DOCTYPE html>
<html lang="ka">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Medicard — პაროლის აღდგენა</title>
</head>
<body style="margin:0;padding:0;background:#f5f4f1;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f4f1;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:480px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(15,23,42,0.08);">
          <tr>
            <td style="background:linear-gradient(135deg,#0d9488 0%,#14b8a6 100%);padding:28px 32px;text-align:center;">
              <div style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">Medicard.GE</div>
              <div style="font-size:13px;color:rgba(255,255,255,0.85);margin-top:4px;">ჭკვიანი სამედიცინო ასისტენტი</div>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 12px;font-size:16px;line-height:24px;color:#0f172a;font-weight:600;">${greeting}</p>
              <p style="margin:0 0 24px;font-size:15px;line-height:24px;color:#64748b;">
                მიიღეთ ეს კოდი Medicard აპში პაროლის აღსადგენად. კოდი მოქმედებს <strong style="color:#0f172a;">10 წუთის</strong> განმავლობაში.
              </p>
              <div style="text-align:center;margin:28px 0;">
                <div style="display:inline-block;background:#f0fdfa;border:2px dashed #14b8a6;border-radius:16px;padding:20px 36px;">
                  <div style="font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#0d9488;margin-bottom:8px;">აღდგენის კოდი</div>
                  <div style="font-size:36px;font-weight:700;letter-spacing:0.35em;color:#0f172a;font-family:'Courier New',monospace;padding-left:0.35em;">${code}</div>
                </div>
              </div>
              <p style="margin:0 0 8px;font-size:13px;line-height:20px;color:#94a3b8;text-align:center;">
                თუ პაროლის აღდგენა არ მოგითხოვიათ, უგულებელყოთ ეს წერილი.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px 28px;border-top:1px solid #ecebe7;text-align:center;">
              <p style="margin:0;font-size:12px;line-height:18px;color:#94a3b8;">
                © Medicard.GE · <a href="mailto:support@medicard.ge" style="color:#14b8a6;text-decoration:none;">support@medicard.ge</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** Sends a 6-digit password reset code. Falls back to console in dev when Resend is not configured. */
export async function sendPasswordResetCode({ to, code, fullName }) {
  const html = resetEmailHtml({ code, fullName });

  if (!resend) {
    console.log(`[email] password reset code for ${to}: ${code}`);
    return { id: 'dev-log' };
  }

  const { data, error } = await resend.emails.send({
    from: env.RESEND_FROM,
    to: [to],
    subject: 'Medicard — პაროლის აღდგენის კოდი',
    html,
  });

  if (error) {
    throw new Error(error.message ?? 'ელ-ფოსტის გაგზავნა ვერ მოხერხდა.');
  }

  return data;
}
