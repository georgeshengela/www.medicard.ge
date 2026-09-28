/**
 * Email templates: code defaults + admin overrides (EmailTemplate rows), one branded layout.
 *
 * Content fields (subject, preheader, heading, body, ctaLabel, ctaUrl) use {{variable}}
 * placeholders from a per-template allow-list. Values are HTML-escaped; in links they must be
 * https:// or mailto: or the link is dropped. The body is a tiny markdown subset: paragraphs
 * (blank line), **bold**, "- " / "1. " lists, [text](https://… | mailto:…) links. A paragraph that
 * is only {{code}} renders as the one-time-code box.
 *
 * Never put health data in a template or a variable. The allow-lists below are the guard.
 */

export const SITE_URL = 'https://medicard.ge';
export const LOGO_URL = `${SITE_URL}/icon.png`;
export const PRIVACY_URL = `${SITE_URL}/privacy`;
export const BRAND = Object.freeze({ wordmark: 'მედიქარდი', tagline: 'ჯიბის სამედიცინო ასისტენტი', teal: '#0D9488', tealLight: '#14B8A6', dark: '#030712' });

export const COMMON_VARS = Object.freeze(['name', 'appUrl', 'supportEmail']);

/** Code defaults. `vars` is the allow-list; `required` must appear somewhere in the content. */
export const DEFAULT_TEMPLATES = Object.freeze({
  welcome: {
    key: 'welcome',
    name: 'მისალმება ახალ ანგარიშზე',
    category: 'transactional',
    trigger: 'ახალი ანგარიში ელფოსტით (/register). ერთხელ თითო ანგარიშზე.',
    vars: [...COMMON_VARS, 'appStoreUrl', 'playStoreUrl'],
    required: [],
    subject: 'კეთილი იყოს შენი მობრძანება მედიქარდში',
    preheader: 'სამი მარტივი ნაბიჯი, რომ მედიქარდი პირველივე დღიდან დაგეხმაროს.',
    heading: 'გამარჯობა, {{name}}!',
    body: [
      'მადლობა, რომ შემოგვიერთდი. მედიქარდი შენი ჯიბის სამედიცინო ასისტენტია — წამლები, კვება და აფთიაქის ფასები ერთ ადგილას.',
      '**დაიწყე ამ სამით:**',
      '- **დაამატე პირველი წამალი** — Medi დროულად შეგახსენებს მიღებას.\n- **ჩაწერე კვება** — ფოტოთი, ძებნით ან უბრალოდ აღწერით.\n- **შეამოწმე აფთიაქის ფასები** — იპოვე შენი წამალი ყველაზე ხელსაყრელად.',
      'აპი ტელეფონზე ჯერ არ გაქვს? ჩამოტვირთე: [App Store]({{appStoreUrl}}) · [Google Play]({{playStoreUrl}})',
      'კითხვა გაქვს? უბრალოდ უპასუხე ამ წერილს ან მოგვწერე [{{supportEmail}}](mailto:{{supportEmail}}).',
    ].join('\n\n'),
    ctaLabel: 'გახსენი მედიქარდი',
    ctaUrl: '{{appUrl}}',
  },
  password_reset: {
    key: 'password_reset',
    name: 'პაროლის აღდგენის კოდი',
    category: 'transactional',
    trigger: 'პაროლის აღდგენის მოთხოვნა (/api/auth/password/forgot).',
    vars: [...COMMON_VARS, 'code', 'minutes'],
    required: ['code'],
    subject: 'მედიქარდი — პაროლის აღდგენის კოდი',
    preheader: 'შენი კოდი მოქმედებს {{minutes}} წუთის განმავლობაში.',
    heading: 'გამარჯობა, {{name}}!',
    body: [
      'შეიყვანე ეს კოდი მედიქარდის აპში პაროლის აღსადგენად. კოდი მოქმედებს **{{minutes}} წუთის** განმავლობაში.',
      '{{code}}',
      'თუ პაროლის აღდგენა არ მოგითხოვია, უბრალოდ უგულებელყავი ეს წერილი — შენი ანგარიში უსაფრთხოდაა.',
    ].join('\n\n'),
    ctaLabel: '',
    ctaUrl: '',
  },
  account_deleted: {
    key: 'account_deleted',
    name: 'ანგარიშის წაშლის დადასტურება',
    category: 'transactional',
    trigger: 'ანგარიშის წაშლა აპიდან (DELETE /api/auth/me), წაშლის დასრულების შემდეგ.',
    vars: [...COMMON_VARS],
    required: [],
    subject: 'შენი მედიქარდის ანგარიში წაიშალა',
    preheader: 'ანგარიში და მასთან დაკავშირებული მონაცემები წაიშალა.',
    heading: 'ნახვამდის, {{name}}',
    body: [
      'შენი ანგარიში და მასთან დაკავშირებული მონაცემები წაიშალა, როგორც მოითხოვე. ეს წერილი მხოლოდ დადასტურებაა — პასუხი საჭირო არ არის.',
      'თუ ანგარიში შენ არ წაგიშლია, დაუყოვნებლივ მოგვწერე: [{{supportEmail}}](mailto:{{supportEmail}}).',
      'მადლობა, რომ ჩვენთან იყავი. ნებისმიერ დროს შეგიძლია დაბრუნდე.',
    ].join('\n\n'),
    ctaLabel: '',
    ctaUrl: '',
  },
});

/** Campaign content is edited per campaign; this is only its variable allow-list. */
export const CAMPAIGN_VARS = Object.freeze([...COMMON_VARS]);
export const TEMPLATE_FIELDS = Object.freeze(['subject', 'preheader', 'heading', 'body', 'ctaLabel', 'ctaUrl']);

/** Realistic sample values for admin previews and test sends (never real user data). */
export const SAMPLE_VARS = Object.freeze({
  name: 'ნინო',
  appUrl: SITE_URL,
  supportEmail: 'support@medicard.ge',
  appStoreUrl: `${SITE_URL}/#download`,
  playStoreUrl: `${SITE_URL}/#download`,
  code: '482913',
  minutes: '10',
});

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const VAR_RE = /\{\{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*\}\}/g;

/** Variable names used in a set of content fields. */
export function usedVars(fields) {
  const out = new Set();
  for (const key of TEMPLATE_FIELDS) {
    for (const m of String(fields?.[key] ?? '').matchAll(VAR_RE)) out.add(m[1]);
  }
  return [...out];
}

/** { ok, unknown, missing } — admin saves are refused on unknown or missing required variables. */
export function validateTemplateVars(fields, { vars = CAMPAIGN_VARS, required = [] } = {}) {
  const used = usedVars(fields);
  const unknown = used.filter((v) => !vars.includes(v));
  const missing = required.filter((v) => !used.includes(v));
  return { ok: !unknown.length && !missing.length, unknown, missing };
}

/** Only https:// and mailto: links survive; anything else (javascript:, data:, http:) is dropped. */
export function safeUrl(value) {
  const url = String(value ?? '').trim();
  if (/^https:\/\/[^\s"'<>]+$/i.test(url)) return url;
  if (/^mailto:[^\s"'<>@]+@[^\s"'<>]+$/i.test(url)) return url;
  return '';
}

/** Substitutes allow-listed variables as plain text (subject, plain-text body). Unknown → ''. */
export function fillText(text, vars, allowed) {
  return String(text ?? '').replace(VAR_RE, (_m, name) => (allowed.includes(name) && vars[name] != null ? String(vars[name]) : ''));
}

const CODE_TOKEN = '\u0000CODE\u0000';

/**
 * Markdown subset → HTML with {{vars}} still in place. The source is escaped first, so admin
 * text can never inject tags; links are recognised on the escaped text.
 */
function markdownToHtml(src, styles) {
  const blocks = String(src ?? '').replace(/\r\n/g, '\n').split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  const inline = (text) => escapeHtml(text)
    .replace(/\*\*([^*]+?)\*\*/g, `<strong style="${styles.strong}">$1</strong>`)
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label, href) => `<a href="${href}" style="${styles.link}">${label}</a>`)
    .replace(/\n/g, '<br>');
  return blocks.map((block) => {
    if (/^\{\{\s*code\s*\}\}$/.test(block)) return CODE_TOKEN;
    const lines = block.split('\n');
    if (lines.every((l) => /^[-*]\s+/.test(l))) {
      return `<ul style="${styles.list}">${lines.map((l) => `<li style="${styles.li}">${inline(l.replace(/^[-*]\s+/, ''))}</li>`).join('')}</ul>`;
    }
    if (lines.every((l) => /^\d+[.)]\s+/.test(l))) {
      return `<ol style="${styles.list}">${lines.map((l) => `<li style="${styles.li}">${inline(l.replace(/^\d+[.)]\s+/, ''))}</li>`).join('')}</ol>`;
    }
    return `<p style="${styles.p}">${inline(block)}</p>`;
  }).join('\n');
}

/** Fills {{vars}} in generated HTML: link targets must stay https/mailto, everything else is escaped. */
function fillHtml(html, vars, allowed) {
  const value = (name) => (allowed.includes(name) && vars[name] != null ? String(vars[name]) : '');
  const withLinks = html.replace(/<a href="([^"]*)" style="([^"]*)">([\s\S]*?)<\/a>/g, (_m, href, style, label) => {
    const raw = href.replace(/&amp;/g, '&').replace(VAR_RE, (_x, name) => value(name));
    const url = safeUrl(raw);
    return url ? `<a href="${escapeHtml(url)}" style="${style}">${label}</a>` : label;
  });
  return withLinks.replace(VAR_RE, (_m, name) => escapeHtml(value(name)));
}

function markdownToText(src, vars, allowed) {
  const blocks = String(src ?? '').replace(/\r\n/g, '\n').split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  return blocks.map((block) => {
    if (/^\{\{\s*code\s*\}\}$/.test(block)) return `    ${fillText('{{code}}', vars, allowed)}`;
    return block.split('\n').map((line) => {
      let l = line.replace(/^[-*]\s+/, '• ');
      l = l.replace(/\*\*([^*]+?)\*\*/g, '$1');
      l = l.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label, href) => {
        const url = safeUrl(fillText(href, vars, allowed));
        const text = fillText(label, vars, allowed);
        if (!url) return text;
        const bare = url.replace(/^mailto:/i, '');
        return text === bare ? text : `${text} (${bare})`;
      });
      return fillText(l, vars, allowed);
    }).join('\n');
  }).join('\n\n');
}

/** Resolved template = code default + non-null override fields. */
export function mergeTemplate(key, row) {
  const base = DEFAULT_TEMPLATES[key];
  if (!base) return null;
  const merged = { ...base, enabled: row ? row.enabled !== false : true, overridden: false, updatedAt: row?.updatedAt || null, updatedBy: row?.updatedBy || null };
  if (row) {
    for (const f of TEMPLATE_FIELDS) {
      if (row[f] != null) {
        merged[f] = row[f];
        if (row[f] !== base[f]) merged.overridden = true;
      }
    }
  }
  return merged;
}

const FONT = "'Noto Sans Georgian','FiraGO','BPG Arial','Sylfaen','Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const STYLES = {
  p: 'margin:0 0 16px;font-size:15px;line-height:24px;color:#334155;',
  strong: 'color:#0f172a;font-weight:700;',
  link: 'color:#0D9488;text-decoration:underline;',
  list: 'margin:0 0 16px;padding:0 0 0 20px;font-size:15px;line-height:24px;color:#334155;',
  li: 'margin:0 0 8px;',
};

function codeBox(code) {
  const digits = escapeHtml(code);
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:8px 0 24px;">
  <tr><td align="center">
    <table role="presentation" cellspacing="0" cellpadding="0" class="mc-code" style="background:#f0fdfa;border:2px dashed #14B8A6;border-radius:16px;">
      <tr><td style="padding:18px 32px;text-align:center;">
        <div style="font-family:${FONT};font-size:12px;font-weight:700;letter-spacing:0.08em;color:#0D9488;margin:0 0 8px;">ერთჯერადი კოდი</div>
        <div class="mc-code-digits" style="font-family:'Courier New',Courier,monospace;font-size:34px;font-weight:700;letter-spacing:0.3em;color:#0f172a;padding-left:0.3em;">${digits}</div>
      </td></tr>
    </table>
  </td></tr>
</table>`;
}

/**
 * Renders a full message.
 * @returns {{ subject: string, preheader: string, html: string, text: string }}
 */
export function renderEmail({ content, vars = {}, allowed = CAMPAIGN_VARS, category = 'transactional', unsubscribeUrl = '' }) {
  const v = { ...vars };
  const subject = fillText(content.subject, v, allowed).replace(/\s+/g, ' ').trim().slice(0, 200);
  const preheader = fillText(content.preheader, v, allowed).replace(/\s+/g, ' ').trim();
  const heading = fillText(content.heading, v, allowed).trim();
  const ctaLabel = fillText(content.ctaLabel, v, allowed).trim();
  const ctaUrl = safeUrl(fillText(content.ctaUrl, v, allowed));
  const marketing = category === 'marketing';
  const unsub = marketing ? safeUrl(unsubscribeUrl) : '';
  const support = String(v.supportEmail || 'support@medicard.ge');

  let bodyHtml = fillHtml(markdownToHtml(content.body, STYLES), v, allowed);
  bodyHtml = bodyHtml.split(CODE_TOKEN).join(codeBox(allowed.includes('code') ? v.code ?? '' : ''));

  const cta = ctaLabel && ctaUrl
    ? `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:8px 0 8px;"><tr><td style="border-radius:12px;background:#0D9488;">
        <a href="${escapeHtml(ctaUrl)}" class="mc-btn" style="display:inline-block;padding:14px 28px;font-family:${FONT};font-size:15px;font-weight:700;line-height:20px;color:#ffffff;text-decoration:none;border-radius:12px;">${escapeHtml(ctaLabel)}</a>
      </td></tr></table>`
    : '';

  const MARKETING_NOTE = 'ეს წერილი მიიღე, რადგან აპში ჩართე „სიახლეები და რჩევები ელფოსტით“.';
  const SERVICE_NOTE = 'ეს სერვისული წერილია შენი მედიქარდის ანგარიშის შესახებ.';
  const unsubLinks = unsub
    ? ` <a href="${escapeHtml(unsub)}" style="color:#64748b;text-decoration:underline;">გამოწერის გაუქმება</a> · <a href="${escapeHtml(unsub)}" style="color:#64748b;text-decoration:underline;" lang="en">Unsubscribe</a>`
    : '';
  // 'support' = an admin's answer from #/support: no marketing or account footer, just who wrote.
  const SUPPORT_NOTE = 'ეს არის მედიქარდის მხარდაჭერის პასუხი შენს წერილზე. უბრალოდ უპასუხე ამ წერილს.';
  const footerNoteHtml = marketing ? `${escapeHtml(MARKETING_NOTE)}${unsubLinks}` : escapeHtml(category === 'support' ? SUPPORT_NOTE : SERVICE_NOTE);

  const html = `<!DOCTYPE html>
<html lang="ka" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${escapeHtml(subject)}</title>
<style>
  body { margin:0; padding:0; -webkit-text-size-adjust:100%; }
  a { color:#0D9488; }
  @media (max-width: 600px) { .mc-pad { padding-left:20px !important; padding-right:20px !important; } .mc-h1 { font-size:22px !important; line-height:30px !important; } }
  @media (prefers-color-scheme: dark) {
    .mc-bg { background:#030712 !important; }
    .mc-card { background:#111827 !important; }
    .mc-h1, .mc-card strong, .mc-code-digits, .mc-word { color:#ffffff !important; }
    .mc-card p, .mc-card li, .mc-card ul, .mc-card ol { color:#D1D5DB !important; }
    .mc-foot, .mc-foot a, .mc-tag { color:#9CA3AF !important; }
    .mc-code { background:#042F2E !important; }
    .mc-line { border-color:#1F2937 !important; }
  }
  [data-ogsc] .mc-bg { background:#030712 !important; }
  [data-ogsc] .mc-card { background:#111827 !important; }
</style>
</head>
<body class="mc-bg" style="margin:0;padding:0;background:#f3f5f6;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;font-size:1px;line-height:1px;color:#f3f5f6;">${escapeHtml(preheader)}${'&#8204;&nbsp;'.repeat(40)}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" class="mc-bg" style="background:#f3f5f6;">
  <tr><td align="center" style="padding:32px 12px;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;">
      <tr><td class="mc-pad" style="padding:0 8px 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0"><tr>
          <td style="vertical-align:middle;"><img src="${LOGO_URL}" width="40" height="40" alt="" style="display:block;border:0;border-radius:10px;"></td>
          <td style="vertical-align:middle;padding-left:10px;">
            <div class="mc-word" style="font-family:${FONT};font-size:18px;font-weight:700;line-height:22px;color:#0f172a;">${BRAND.wordmark}</div>
            <div class="mc-tag" style="font-family:${FONT};font-size:12px;line-height:16px;color:#64748b;">${BRAND.tagline}</div>
          </td>
        </tr></table>
      </td></tr>
      <tr><td class="mc-card mc-pad" style="background:#ffffff;border-radius:22px;padding:32px 32px 24px;font-family:${FONT};">
        ${heading ? `<h1 class="mc-h1" style="margin:0 0 16px;font-family:${FONT};font-size:24px;line-height:32px;font-weight:700;color:#0f172a;">${escapeHtml(heading)}</h1>` : ''}
        ${bodyHtml}
        ${cta}
      </td></tr>
      <tr><td class="mc-pad mc-foot" style="padding:20px 16px 0;font-family:${FONT};font-size:12px;line-height:19px;color:#64748b;text-align:center;">
        <p style="margin:0 0 6px;">${footerNoteHtml}</p>
        <p style="margin:0 0 6px;"><a href="mailto:${escapeHtml(support)}" style="color:#64748b;text-decoration:underline;">${escapeHtml(support)}</a> · <a href="${PRIVACY_URL}" style="color:#64748b;text-decoration:underline;">კონფიდენციალურობა</a> · <a href="${SITE_URL}" style="color:#64748b;text-decoration:underline;">medicard.ge</a></p>
        <p style="margin:0;">© ${BRAND.wordmark} · ${BRAND.tagline}</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;

  const textParts = [
    heading,
    markdownToText(content.body, v, allowed),
    ctaLabel && ctaUrl ? `${ctaLabel}: ${ctaUrl}` : '',
    '—',
    `${BRAND.wordmark} · ${BRAND.tagline}`,
    `${support} · ${PRIVACY_URL}`,
    marketing
      ? `ეს წერილი მიიღე, რადგან აპში ჩართე „სიახლეები და რჩევები ელფოსტით“.${unsub ? `\nგამოწერის გაუქმება / Unsubscribe: ${unsub}` : ''}`
      : category === 'support' ? SUPPORT_NOTE : 'ეს სერვისული წერილია შენი მედიქარდის ანგარიშის შესახებ.',
  ].filter(Boolean);

  return { subject, preheader, html, text: textParts.join('\n\n') };
}
