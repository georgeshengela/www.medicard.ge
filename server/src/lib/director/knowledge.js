/**
 * What the Director may tell people who write to support. Built from the public FAQ on the landing
 * page (single source of truth, read once) plus a few operational facts. If an answer is not here,
 * the Director must not guess — it asks the owner.
 */
import { readFileSync } from 'node:fs';

const FACTS = `
- MEDICARD (medicard.ge) — ქართული ჯანმრთელობის მობილური აპი (iOS და Android). საიტიდან ანგარიშში შესვლა არ ხდება.
- ყველა ფუნქცია უფასოა. ფასიანი პაკეტი, გამოწერა ან კვოტა არ არსებობს.
- Medi — აპის AI ასისტენტი. ინფორმაციას იძლევა, არა დიაგნოზს ან რეცეპტს. სასწრაფო შემთხვევაში — 112.
- ანგარიშის წაშლა: აპში პროფილი → ანგარიშის წაშლა; ან ინსტრუქცია https://medicard.ge/delete-account
- კონფიდენციალურობის პოლიტიკა: https://medicard.ge/privacy ; წესები: https://medicard.ge/terms
- ანგარიში 18 წლიდან იხსნება.
- მხარდაჭერა: support@medicard.ge, სამუშაო დრო ორშაბათი–პარასკევი 10:00–19:00.
- MEDIRUN — სირბილის/სეირნობის თამაში რუკაზე, საჩუქრებით. Medi Coins — აპის ქულები, ფულადი ღირებულება არ აქვს და ნაღდ ფულად არ იცვლება.
`.trim();

let cached = null;

export function faqText(html) {
  const m = /<section[^>]*id="faq"[^>]*>([\s\S]*?)<\/section>/i.exec(html || '');
  if (!m) return '';
  return m[1]
    .replace(/<\/(summary|p|details|h\d|li)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .split('\n').map((l) => l.trim()).filter(Boolean).join('\n')
    .slice(0, 8000);
}

export function supportKnowledge() {
  if (cached) return cached;
  let faq = '';
  try {
    faq = faqText(readFileSync(new URL('../../../public/index.html', import.meta.url), 'utf8'));
  } catch {
    faq = '';
  }
  cached = `ძირითადი ფაქტები:\n${FACTS}\n\nსაიტის FAQ:\n${faq || '(ვერ ჩაიტვირთა)'}`;
  return cached;
}
