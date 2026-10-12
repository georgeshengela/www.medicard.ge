// MEDIFAMILY reminder feed: the phone turns it into local notifications (prefix „family:“). Rhythm from the
// evidence (Cochrane reminder/recall; 2026 Australian trial): 14 days before, on the day, then 7 and 30 days
// after if the dose is still not marked. Month-birthdays until 24 months carry the age guide's note.
import { addDays, daysBetween, toYmd } from './age.js';
import { monthNote } from './guide.js';
import { vaccineView } from './view.js';

const MONTHS_KA = ['იან', 'თებ', 'მარ', 'აპრ', 'მაი', 'ივნ', 'ივლ', 'აგვ', 'სექ', 'ოქტ', 'ნოე', 'დეკ'];
const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const VACCINE_OFFSETS = Object.freeze([-14, 0, 7, 30]);
export const HORIZON_DAYS = 120;
export const VACCINE_HOUR = 10;
export const MONTH_HOUR = 11;

export function shortDate(ymd, lang = 'ka') {
  const [, m, d] = ymd.split('-').map(Number);
  return lang === 'en' ? `${MONTHS_EN[m - 1]} ${d}` : `${d} ${MONTHS_KA[m - 1]}`;
}

function vaccineCopy(offset, name, abbrs, dueOn, lang) {
  const date = shortDate(dueOn, lang);
  if (lang === 'en') {
    if (offset < 0) return { title: `${name}: vaccines in 2 weeks`, body: `${abbrs} · ${date}. Time to book the pediatrician.` };
    if (offset === 0) return { title: `${name}: vaccine day`, body: `${abbrs}. Every calendar vaccine is free.` };
    if (offset === 7) return { title: `${name}: vaccine not marked yet`, body: `${abbrs} — if it’s done, mark it; if not, plan it with your pediatrician.` };
    return { title: `${name}: a vaccine is still waiting`, body: 'A late dose still protects — the series never starts over.' };
  }
  if (offset < 0) return { title: `${name}: აცრა 2 კვირაში`, body: `${abbrs} · ${date}. დროა ჩაეწერო პედიატრთან.` };
  if (offset === 0) return { title: `${name}: დღეს აცრის დღეა`, body: `${abbrs}. კალენდრის ყველა აცრა უფასოა.` };
  if (offset === 7) return { title: `${name}: აცრა ჯერ არ ჩანს`, body: `${abbrs} — თუ უკვე გაკეთდა, მონიშნე; თუ არა, დაგეგმე პედიატრთან.` };
  return { title: `${name}: აცრა ისევ ელოდება`, body: 'გვიან გაკეთებული აცრაც იცავს — სერია თავიდან არ იწყება.' };
}

/** Next month-birthdays (1–24 months) on or after today, at most `count`. */
export function upcomingMonthBirthdays(birthYmd, todayYmd, count = 2) {
  const out = [];
  const [by, bm, bd] = birthYmd.split('-').map(Number);
  for (let n = 1; n <= 24 && out.length < count; n += 1) {
    const total = bm - 1 + n;
    const y = by + Math.floor(total / 12);
    const mo = total % 12;
    const last = new Date(Date.UTC(y, mo + 1, 0)).getUTCDate();
    const on = new Date(Date.UTC(y, mo, Math.min(bd, last))).toISOString().slice(0, 10);
    if (on >= todayYmd) out.push({ month: n, on });
  }
  return out;
}

/**
 * rows: [{ member, doses }]. Returns notification points: { id, memberId, kind, fireOn, hour, title, body,
 * route }. Ids are stable so the phone only reschedules what changed.
 */
export function buildReminderFeed(rows, todayYmd, lang = 'ka') {
  const points = [];
  for (const { member, doses } of rows) {
    const name = String(member.name || '').trim() || (lang === 'en' ? 'Your child' : 'შვილი');
    const route = `/family/${member.id}/vaccines`;
    const view = vaccineView(member, doses, todayYmd, lang);
    const open = view.items.filter((i) => ['due', 'overdue', 'soon', 'upcoming'].includes(i.status) && daysBetween(todayYmd, i.dueOn) <= HORIZON_DAYS);
    const byDate = new Map();
    for (const item of open) byDate.set(item.dueOn, [...(byDate.get(item.dueOn) || []), item]);
    for (const [dueOn, items] of byDate) {
      const abbrs = items.map((i) => i.abbr).join(' · ');
      for (const offset of VACCINE_OFFSETS) {
        const fireOn = addDays(dueOn, offset);
        if (fireOn < todayYmd) continue;
        points.push({ id: `vac:${member.id}:${dueOn}:${offset}`, memberId: member.id, kind: 'vaccine', fireOn, hour: VACCINE_HOUR, route, ...vaccineCopy(offset, name, abbrs, dueOn, lang) });
      }
    }
    for (const extra of view.extras) {
      if (!extra.nextOn || extra.nextOn < todayYmd || daysBetween(todayYmd, extra.nextOn) > HORIZON_DAYS) continue;
      points.push({ id: `extra:${member.id}:${extra.id}`, memberId: member.id, kind: 'extra', fireOn: extra.nextOn, hour: VACCINE_HOUR, route, ...vaccineCopy(0, name, extra.name, extra.nextOn, lang) });
    }
    const birth = toYmd(member.birthDate);
    for (const { month, on } of upcomingMonthBirthdays(birth, todayYmd)) {
      const note = monthNote(month, lang) || (lang === 'en' ? 'See what changes at this age.' : 'ნახე, რა იცვლება ამ ასაკში.');
      points.push({
        id: `month:${member.id}:${month}`, memberId: member.id, kind: 'month', fireOn: on, hour: MONTH_HOUR, route: `/family/${member.id}`,
        title: lang === 'en' ? `${name} is ${month} month${month === 1 ? '' : 's'} old today` : `${name} დღეს ${month} თვისაა`,
        body: note,
      });
    }
  }
  return points.sort((a, b) => (a.fireOn < b.fireOn ? -1 : a.fireOn > b.fireOn ? 1 : 0));
}
