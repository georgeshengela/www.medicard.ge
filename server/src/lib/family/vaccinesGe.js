// Georgia's national immunization calendar for children and the rules MEDIFAMILY follows when a dose is
// late. Source: Minister's order №01-60/ნ of 16.09.2019, Annex 1 (calendar table replaced by order
// №52/ნ of 13.07.2023, vaccine rules by order №01-51/ნ of 20.05.2020) — matsne.gov.ge 4647335, 4869455,
// 5843261; checked 2026-10-12 (no later amendment). All calendar vaccines are free for children.
// Vaccines follow CHRONOLOGICAL age, also for babies born early.
import { addDays, addMonths, addYears, daysBetween, toYmd } from './age.js';

export const GE_CALENDAR_SOURCE = Object.freeze({
  ka: 'პროფილაქტიკური აცრების ეროვნული კალენდარი — მინისტრის ბრძანება №01-60/ნ (16.09.2019), ბოლო ცვლილება №52/ნ (13.07.2023).',
  en: 'Georgia’s national immunization calendar — Minister’s order №01-60/ნ (16 Sep 2019), last amended by №52/ნ (13 Jul 2023).',
  url: 'https://matsne.gov.ge/ka/document/view/4647335',
  checkedOn: '2026-10-12',
});

const L = (ka, en) => ({ ka, en });

export const GE_VACCINES = Object.freeze([
  { code: 'hepb', abbr: L('ჰეპB', 'Hep B'), name: L('B ჰეპატიტი', 'Hepatitis B'), protects: L('B ჰეპატიტისგან — ღვიძლის ვირუსული ანთება.', 'Hepatitis B — a viral liver infection.'), live: false },
  { code: 'bcg', abbr: L('ბცჟ', 'BCG'), name: L('ტუბერკულოზის საწინააღმდეგო', 'Tuberculosis (BCG)'), protects: L('ტუბერკულოზის მძიმე ფორმებისგან ჩვილებში.', 'Severe forms of tuberculosis in babies.'), live: true },
  { code: 'hexa', abbr: L('ჰექსა', 'Hexa'), name: L('ჰექსავალენტური ვაქცინა', 'Hexavalent vaccine'), protects: L('დიფთერია, ყივანახველა, ტეტანუსი, B ჰეპატიტი, ჰიბ-ინფექცია და პოლიომიელიტი — ერთი ნემსით.', 'Diphtheria, whooping cough, tetanus, hepatitis B, Hib and polio — in one shot.'), live: false },
  { code: 'pcv', abbr: L('პნევმო', 'PCV'), name: L('პნევმოკოკური ვაქცინა', 'Pneumococcal vaccine'), protects: L('პნევმოკოკისგან — პნევმონია, მენინგიტი, შუა ყურის ანთება.', 'Pneumococcus — pneumonia, meningitis, ear infections.'), live: false },
  { code: 'rota', abbr: L('როტა', 'Rota'), name: L('როტავირუსული ვაქცინა (წვეთები პირში)', 'Rotavirus vaccine (oral drops)'), protects: L('როტავირუსული დიარეისა და გაუწყლოებისგან.', 'Rotavirus diarrhoea and dehydration.'), live: true },
  { code: 'mmr', abbr: L('წწყ', 'MMR'), name: L('წითელა, წითურა, ყბაყურა', 'Measles, mumps, rubella'), protects: L('წითელა, წითურა და ყბაყურა.', 'Measles, rubella and mumps.'), live: true },
  { code: 'dtapipv', abbr: L('დყატ/პ', 'DTaP-IPV'), name: L('დიფთერია, ყივანახველა, ტეტანუსი, პოლიომიელიტი', 'Diphtheria, whooping cough, tetanus, polio'), protects: L('განმეორებითი დოზა: დიფთერია, ყივანახველა, ტეტანუსი, პოლიომიელიტი.', 'Booster: diphtheria, whooping cough, tetanus, polio.'), live: false },
  { code: 'td', abbr: L('ტდ', 'Td'), name: L('ტეტანუსი და დიფთერია', 'Tetanus and diphtheria'), protects: L('ტეტანუსი და დიფთერია; შემდეგ ყოველ 10 წელიწადში.', 'Tetanus and diphtheria; then every 10 years.'), live: false },
  { code: 'hpv', abbr: L('აპვ', 'HPV'), name: L('ადამიანის პაპილომავირუსი', 'Human papillomavirus'), protects: L('აპვ-ით გამოწვეული კიბოსგან — გოგონებსა და ბიჭებს.', 'HPV-related cancers — for girls and boys.'), live: false },
]);

/** Ages on the calendar, in the order a parent reads them. */
export const GE_STAGES = Object.freeze([
  { key: 'birth', label: L('დაბადებისას', 'At birth') },
  { key: 'm2', label: L('2 თვე', '2 months') },
  { key: 'm3', label: L('3 თვე', '3 months') },
  { key: 'm4', label: L('4 თვე', '4 months') },
  { key: 'm12', label: L('12 თვე', '12 months') },
  { key: 'm18', label: L('18 თვე', '18 months') },
  { key: 'y5', label: L('5 წელი', '5 years') },
  { key: 'y10', label: L('10–12 წელი', '10–12 years') },
  { key: 'y14', label: L('14 წელი', '14 years') },
]);

const MONTH = 30;
/**
 * One row per calendar dose. `due` = calendar age; `gapDays` = minimum days after the previous dose of the
 * same vaccine; `maxDays` = age after which the dose is no longer given (catch-up stops).
 */
export const GE_DOSES = Object.freeze([
  { id: 'hepb-1', code: 'hepb', dose: 1, stage: 'birth', due: { days: 0 }, maxDays: 30 },
  { id: 'bcg-1', code: 'bcg', dose: 1, stage: 'birth', due: { days: 0 }, maxDays: 365 },
  { id: 'hexa-1', code: 'hexa', dose: 1, stage: 'm2', due: { months: 2 }, maxDays: 730 },
  { id: 'pcv-1', code: 'pcv', dose: 1, stage: 'm2', due: { months: 2 }, maxDays: 1826 },
  { id: 'rota-1', code: 'rota', dose: 1, stage: 'm2', due: { months: 2 }, maxDays: 112 },
  { id: 'hexa-2', code: 'hexa', dose: 2, stage: 'm3', due: { months: 3 }, gapDays: 28, maxDays: 730 },
  { id: 'rota-2', code: 'rota', dose: 2, stage: 'm3', due: { months: 3 }, gapDays: 28, maxDays: 168 },
  { id: 'hexa-3', code: 'hexa', dose: 3, stage: 'm4', due: { months: 4 }, gapDays: 28, maxDays: 730 },
  { id: 'pcv-2', code: 'pcv', dose: 2, stage: 'm4', due: { months: 4 }, gapDays: 56, maxDays: 1826 },
  { id: 'mmr-1', code: 'mmr', dose: 1, stage: 'm12', due: { months: 12 } },
  { id: 'pcv-3', code: 'pcv', dose: 3, stage: 'm12', due: { months: 12 }, gapDays: 6 * MONTH, maxDays: 1826 },
  { id: 'dtapipv-1', code: 'dtapipv', dose: 1, stage: 'm18', due: { months: 18 } },
  { id: 'mmr-2', code: 'mmr', dose: 2, stage: 'y5', due: { years: 5 }, gapDays: 28 },
  { id: 'dtapipv-2', code: 'dtapipv', dose: 2, stage: 'y5', due: { years: 5 }, gapDays: 28 },
  { id: 'hpv-1', code: 'hpv', dose: 1, stage: 'y10', due: { years: 10 } },
  { id: 'hpv-2', code: 'hpv', dose: 2, stage: 'y10', due: { years: 10, months: 6 }, gapDays: 6 * MONTH },
  { id: 'hpv-3', code: 'hpv', dose: 3, stage: 'y10', due: { years: 15, months: 6 }, gapDays: 4 * MONTH, conditional: true },
  { id: 'td-1', code: 'td', dose: 1, stage: 'y14', due: { years: 14 } },
]);

/** Vaccines outside the free state calendar that Georgian pediatricians often suggest (paid). */
export const EXTRA_VACCINES = Object.freeze([
  { code: 'varicella', name: L('ჩუტყვავილა', 'Chickenpox (varicella)') },
  { code: 'hepa', name: L('A ჰეპატიტი', 'Hepatitis A') },
  { code: 'flu', name: L('გრიპი (ყოველწლიურად, 6 თვიდან)', 'Flu (yearly, from 6 months)') },
  { code: 'menacwy', name: L('მენინგოკოკი ACWY', 'Meningococcal ACWY') },
  { code: 'menb', name: L('მენინგოკოკი B', 'Meningococcal B') },
  { code: 'covid', name: L('COVID-19', 'COVID-19') },
  { code: 'other', name: L('სხვა ვაქცინა', 'Other vaccine') },
]);

export const RECORD_STATUSES = Object.freeze(['GIVEN', 'GIVEN_UNKNOWN_DATE', 'SKIPPED']);
/** A dose stays "now" for a month after its calendar date; later it is overdue. */
export const DUE_WINDOW_DAYS = 30;
/** "Soon" = within the next 30 days. */
export const SOON_DAYS = 30;

const DOSE_BY_ID = new Map(GE_DOSES.map((d) => [d.id, d]));
const VACCINE_BY_CODE = new Map(GE_VACCINES.map((v) => [v.code, v]));
const EXTRA_BY_CODE = new Map(EXTRA_VACCINES.map((v) => [v.code, v]));

export function isCalendarDoseId(id) {
  return DOSE_BY_ID.has(id);
}

export function isExtraCode(code) {
  return EXTRA_BY_CODE.has(code);
}

export function calendarDueOn(birthYmd, due) {
  let on = birthYmd;
  if (due.years) on = addYears(on, due.years);
  if (due.months) on = addMonths(on, due.months);
  if (due.days) on = addDays(on, due.days);
  return on;
}

function maxYmd(a, b) {
  if (!a) return b;
  if (!b) return a;
  return a > b ? a : b;
}

const NOTES = {
  hepbCovered: L('დაბადებისას თუ გამოტოვდა, B ჰეპატიტის დოზებს ჰექსა ფარავს — ექიმს დაუზუსტე.', 'If missed at birth, the hexa shots cover hepatitis B — check with your doctor.'),
  bcgCatchup: L('ბცჟ კეთდება 1 წლამდე — დაგეგმე უახლოეს ვიზიტზე.', 'BCG can be given until 1 year — plan it at the next visit.'),
  bcgExpired: L('12 თვის შემდეგ ბცჟ აღარ კეთდება.', 'BCG is not given after 12 months.'),
  rotaExpired: L('როტა ვაქცინა მხოლოდ 24 კვირამდე კეთდება (პირველი დოზა — 16 კვირამდე).', 'Rotavirus vaccine is only given until 24 weeks (first dose by 16 weeks).'),
  hexaExpired: L('24 თვის შემდეგ ჰექსა აღარ კეთდება — გამოტოვებულს ექიმი სხვა ვაქცინით დაგეგმავს.', 'Hexa is not used after 24 months — the doctor plans missed doses with another vaccine.'),
  pcvTwoDoses: L('12 თვის შემდეგ დაწყებისას საკმარისია 2 დოზა, ≥ 8 კვირის ინტერვალით.', 'Started after 12 months, 2 doses at least 8 weeks apart are enough.'),
  pcvExpired: L('5 წლის შემდეგ ჯანმრთელ ბავშვს პნევმო აღარ სჭირდება.', 'Healthy children do not need PCV after 5 years.'),
  hpvThree: L('15 წლიდან დაწყებისას 3 დოზაა: 0 – 2 – 6 თვე.', 'Started at 15 or older, it is 3 doses: 0 – 2 – 6 months.'),
  shortGap: L('წინა დოზიდან 4 კვირაზე ნაკლები გავიდა — ასეთი დოზა არ ითვლება, ექიმს დაუზუსტე.', 'Less than 4 weeks after the previous dose — such a dose does not count; check with your doctor.'),
  free: L('სახელმწიფო კალენდრის ყველა აცრა ბავშვებისთვის უფასოა.', 'Every calendar vaccine is free for children.'),
};

export function vaccineNote(key, lang = 'ka') {
  const pair = NOTES[key];
  return pair ? pair[lang === 'en' ? 'en' : 'ka'] : null;
}

/**
 * Builds the child's calendar: every dose with its due date, status and note.
 * records: [{ code, dose, status, givenOn }] (calendar doses only; extras are listed separately).
 * Statuses: done · skipped · due (in its month) · overdue · soon (≤ 30 days) · upcoming · expired (age limit
 * passed) · not_needed (PCV dose 3 when started after 12 months; HPV dose 3 when started before 15).
 */
export function buildGeSchedule({ birthYmd, todayYmd, records = [] }) {
  const ageToday = daysBetween(birthYmd, todayYmd);
  const byId = new Map();
  for (const r of records) {
    const id = `${r.code}-${r.dose}`;
    if (DOSE_BY_ID.has(id)) byId.set(id, { ...r, givenOn: toYmd(r.givenOn) });
  }
  const isDone = (rec) => rec && (rec.status === 'GIVEN' || rec.status === 'GIVEN_UNKNOWN_DATE');

  // PCV: the number of doses depends on the age at the first dose (or today, if none yet).
  const pcv1 = byId.get('pcv-1');
  const pcvStartAge = isDone(pcv1) && pcv1.givenOn ? daysBetween(birthYmd, pcv1.givenOn) : (isDone(pcv1) ? 60 : ageToday);
  const pcvTwoDose = pcvStartAge >= 365;
  const pcvLateStart = pcvStartAge >= 7 * 30 && pcvStartAge < 365;
  // HPV: three doses only when the course started at 15 or later.
  const hpv1 = byId.get('hpv-1');
  const hpvStartAge = isDone(hpv1) && hpv1.givenOn ? daysBetween(birthYmd, hpv1.givenOn) : (isDone(hpv1) ? 10 * 365 : ageToday);
  const hpvThree = hpvStartAge >= 15 * 365.25;

  const anchors = new Map(); // code → { on, known } for the previous dose (given date or projected date)
  const items = [];
  for (const spec of GE_DOSES) {
    const rec = byId.get(spec.id) || null;
    const calendar = calendarDueOn(birthYmd, spec.due);
    let gap = spec.gapDays || 0;
    if (spec.code === 'pcv' && spec.dose === 2) gap = pcvTwoDose ? 56 : pcvLateStart ? 28 : 56;
    if (spec.code === 'pcv' && spec.dose === 3) gap = 56;
    if (spec.code === 'hpv' && hpvThree) gap = spec.dose === 2 ? 2 * MONTH : 4 * MONTH;
    const prev = anchors.get(spec.code);
    let dueOn = calendar;
    if (spec.dose > 1 && prev?.on) dueOn = maxYmd(calendar, addDays(prev.on, gap));
    if (spec.code === 'hpv' && hpvThree && spec.dose > 1 && prev?.on) dueOn = addDays(prev.on, gap);
    const item = {
      id: spec.id, code: spec.code, dose: spec.dose, stage: spec.stage,
      calendarOn: calendar, dueOn, status: 'upcoming', note: null, warning: null,
      record: rec ? { id: rec.id, status: rec.status, givenOn: rec.givenOn, place: rec.place ?? null, lot: rec.lot ?? null, reaction: rec.reaction ?? null, note: rec.note ?? null } : null,
    };

    if (spec.code === 'pcv' && spec.dose === 3 && pcvTwoDose && !isDone(rec)) {
      item.status = 'not_needed';
      item.note = 'pcvTwoDoses';
    } else if (spec.conditional && spec.code === 'hpv' && !hpvThree && !isDone(rec)) {
      item.status = 'not_needed';
    } else if (rec?.status === 'SKIPPED') {
      item.status = 'skipped';
    } else if (isDone(rec)) {
      item.status = 'done';
      const prevRec = byId.get(`${spec.code}-${spec.dose - 1}`);
      if (spec.dose > 1 && rec.givenOn && prevRec?.givenOn && daysBetween(prevRec.givenOn, rec.givenOn) < 28) item.warning = 'shortGap';
    } else {
      const maxDays = spec.maxDays;
      const rotaBlocked = spec.code === 'rota' && spec.dose === 2 && !isDone(byId.get('rota-1')) && ageToday > 112;
      if ((maxDays && ageToday > maxDays) || rotaBlocked) {
        item.status = 'expired';
        item.note = { hepb: 'hepbCovered', bcg: 'bcgExpired', rota: 'rotaExpired', hexa: 'hexaExpired', pcv: 'pcvExpired' }[spec.code] || null;
      } else {
        const until = daysBetween(todayYmd, dueOn);
        if (until > SOON_DAYS) item.status = 'upcoming';
        else if (until > 0) item.status = 'soon';
        else if (-until <= DUE_WINDOW_DAYS) item.status = 'due';
        else item.status = 'overdue';
        if (spec.code === 'bcg' && item.status === 'overdue') item.note = 'bcgCatchup';
        if (spec.code === 'pcv' && pcvTwoDose && spec.dose <= 2) item.note = 'pcvTwoDoses';
        if (spec.code === 'hpv' && hpvThree) item.note = 'hpvThree';
      }
    }

    // The next dose of the same vaccine is timed from this one: its real date, or — when it is still
    // ahead — the date it can happen (today at the earliest when it is late).
    if (item.status === 'done') {
      anchors.set(spec.code, { on: rec.givenOn || null });
    } else if (item.status === 'due' || item.status === 'overdue') {
      anchors.set(spec.code, { on: maxYmd(dueOn, todayYmd) });
    } else if (item.status === 'soon' || item.status === 'upcoming') {
      anchors.set(spec.code, { on: dueOn });
    } else {
      anchors.set(spec.code, prev || { on: null });
    }
    items.push(item);
  }
  return items;
}

/** Counts and the next thing to do, for the hero and the reminder feed. */
export function summarizeSchedule(items, todayYmd) {
  const active = items.filter((i) => i.status !== 'not_needed');
  const dueByNow = active.filter((i) => i.calendarOn <= todayYmd && i.status !== 'expired');
  const done = dueByNow.filter((i) => i.status === 'done' || i.status === 'skipped').length;
  const overdue = active.filter((i) => i.status === 'overdue');
  const dueNow = active.filter((i) => i.status === 'due');
  const ahead = active.filter((i) => i.status === 'soon' || i.status === 'upcoming').sort((a, b) => (a.dueOn < b.dueOn ? -1 : 1));
  const next = overdue[0] || dueNow[0] || ahead[0] || null;
  return {
    doneForAge: done,
    totalForAge: dueByNow.length,
    overdueCount: overdue.length,
    dueCount: dueNow.length,
    next: next ? { id: next.id, code: next.code, dose: next.dose, dueOn: next.dueOn, status: next.status } : null,
    nextVisit: next ? active.filter((i) => ['due', 'overdue', 'soon', 'upcoming'].includes(i.status) && i.dueOn === next.dueOn).map((i) => i.id) : [],
  };
}

export function vaccineMeta(code) {
  return VACCINE_BY_CODE.get(code) || null;
}

export function extraMeta(code) {
  return EXTRA_BY_CODE.get(code) || null;
}

/** The calendar as the app shows it (names in both languages; the app picks one). */
export function publicCalendar() {
  return {
    source: GE_CALENDAR_SOURCE,
    freeNote: NOTES.free,
    vaccines: GE_VACCINES,
    stages: GE_STAGES,
    doses: GE_DOSES.map(({ id, code, dose, stage, due }) => ({ id, code, dose, stage, due })),
    extras: EXTRA_VACCINES,
    notes: NOTES,
  };
}
