/**
 * Words for the cycle deviations card (brief §9 wave 2 item 14, [კ-27]; Apple „Cycle Deviations“).
 * The server decides (`bundle.deviations`, server/src/lib/cycleDeviations.js); this file only says it:
 * calm, factual, the numbers from her own log, never a condition name, always the doctor sentence last.
 */
import { tx } from '../i18n/locale.js';
import type { CycleDeviationFinding, CycleDeviations } from './api';

/** Same thresholds as the server (shown in the explain sheet). */
export const DEVIATION_RULES = { windowMonths: 6, minCycles: 3, spreadDays: 17, longPeriodDays: 10, factorTailDays: 90 } as const;

const ORDER: CycleDeviationFinding['id'][] = ['irregular', 'infrequent', 'prolonged', 'spotting'];

const numberWordKa = (n: number) => (n === 1 ? 'ერთი' : n === 2 ? 'ორი' : String(n));
const numberWordEn = (n: number) => (n === 1 ? 'one' : n === 2 ? 'two' : String(n));

export const deviationCopy = {
  title: () => tx('შენს ციკლში ცვლილება შევნიშნეთ', 'We noticed a change in your cycle'),
  doctorLine: () => tx('ეს დიაგნოზი არ არის — ესაუბრე ექიმს, თუ გაწუხებს.', "This isn't a diagnosis — talk to a doctor if it worries you."),
  infoA11y: () => tx('როგორ ვამჩნევთ ცვლილებას', 'How we notice a change'),
  explainTitle: () => tx('როგორ ვამჩნევთ ცვლილებას', 'How we notice a change'),
  explainBody: (rulesOff: readonly string[] = []) => {
    const perimenopause = rulesOff.includes('irregular');
    return [
      tx(
        `ვუყურებთ მხოლოდ შენს აღრიცხვას ბოლო ${DEVIATION_RULES.windowMonths} თვეში. ბარათი ჩნდება მხოლოდ მაშინ, როცა ისტორია ${DEVIATION_RULES.windowMonths} თვეზე მეტია და მინიმუმ ${DEVIATION_RULES.minCycles} ციკლი დასრულდა.`,
        `We only look at what you logged in the last ${DEVIATION_RULES.windowMonths} months. The card appears only when your history is longer than ${DEVIATION_RULES.windowMonths} months and at least ${DEVIATION_RULES.minCycles} cycles have finished.`,
      ),
      ...deviationRuleLines(perimenopause),
      tx(
        `ორსულობისას, მშობიარობის შემდგომ პერიოდში და ჰორმონული კონტრაცეფციისას ბარათი არ ჩნდება, ასევე მათი დასრულებიდან ${DEVIATION_RULES.factorTailDays} დღის განმავლობაში — ციკლი ამ დროს ბუნებრივად იცვლება.`,
        `During pregnancy, after giving birth and with hormonal contraception the card stays off, and for ${DEVIATION_RULES.factorTailDays} days after they end — the cycle naturally changes then.`,
      ),
      ...(perimenopause
        ? [
            tx(
              'პერიმენოპაუზის რეჟიმში ციკლის სიგრძის წესი გამორთულია — ამ დროს სიგრძე ხშირად იცვლება.',
              'In perimenopause mode the cycle-length rule is off — length often changes at this time.',
            ),
          ]
        : []),
      tx(
        'ეს დაკვირვებაა შენი ჩანაწერებიდან და არა დიაგნოზი. გამოტოვებული ჩანაწერიც შეიძლება ცვლილებად გამოჩნდეს. თუ გაწუხებს, ესაუბრე ექიმს.',
        "This is an observation from your own log, not a diagnosis. A missed log can look like a change too. If it worries you, talk to a doctor.",
      ),
    ];
  },
};

/** The four rules in plain words, for the explain sheet. */
export function deviationRuleLines(perimenopause = false): string[] {
  const lines = [
    tx(
      `ციკლის სიგრძე: ყველაზე მოკლე და ყველაზე გრძელი ციკლი ${DEVIATION_RULES.spreadDays} ან მეტი დღით განსხვავდება.`,
      `Cycle length: your shortest and longest cycle differ by ${DEVIATION_RULES.spreadDays} days or more.`,
    ),
    tx(
      `იშვიათი მენსტრუაცია: ${DEVIATION_RULES.windowMonths} თვეში მხოლოდ 1 ან 2 მენსტრუაცია აღირიცხა.`,
      `Infrequent periods: only 1 or 2 periods were logged in ${DEVIATION_RULES.windowMonths} months.`,
    ),
    tx(
      `გრძელი მენსტრუაცია: მენსტრუაცია ${DEVIATION_RULES.longPeriodDays} ან მეტი დღე გაგრძელდა მინიმუმ ორჯერ.`,
      `Long periods: a period lasted ${DEVIATION_RULES.longPeriodDays} days or more at least twice.`,
    ),
    tx(
      'ლაქები: მენსტრუაციებს შორის ლაქები მინიმუმ 2 ციკლში აღინიშნა.',
      'Spotting: spotting between periods was logged in at least 2 cycles.',
    ),
  ];
  return perimenopause ? lines.slice(1) : lines;
}

/** One factual sentence per finding, with her numbers. */
export function deviationFindingLine(finding: CycleDeviationFinding): string {
  switch (finding.id) {
    case 'irregular':
      return tx(
        `ბოლო 6 თვეში ციკლის სიგრძე ${finding.shortestDays}-დან ${finding.longestDays} დღემდე მერყეობს.`,
        `In the last 6 months your cycle length ranged from ${finding.shortestDays} to ${finding.longestDays} days.`,
      );
    case 'infrequent':
      return tx(
        `ბოლო 6 თვეში მხოლოდ ${numberWordKa(finding.periods)} მენსტრუაცია აღირიცხა.`,
        `Only ${numberWordEn(finding.periods)} ${finding.periods === 1 ? 'period was' : 'periods were'} logged in the last 6 months.`,
      );
    case 'prolonged':
      return tx(
        `ბოლო 6 თვეში მენსტრუაცია ${finding.periods}-ჯერ გაგრძელდა 10 ან მეტი დღე (ყველაზე გრძელი — ${finding.longestDays} დღე).`,
        `In the last 6 months a period lasted 10 days or longer ${finding.periods} times (the longest ${finding.longestDays} days).`,
      );
    case 'spotting':
      return tx(
        `ბოლო 6 თვეში ლაქები მენსტრუაციებს შორის ${finding.cycles} ციკლში აღინიშნა.`,
        `In the last 6 months spotting between periods was logged in ${finding.cycles} cycles.`,
      );
    default:
      return '';
  }
}

/** Lines for the card in a fixed order; [] = draw no card (unknown ids from a newer server are skipped). */
export function deviationLines(deviations: CycleDeviations | null | undefined): string[] {
  const findings = Array.isArray(deviations?.findings) ? deviations!.findings : [];
  return ORDER.flatMap((id) => findings.filter((f) => f?.id === id).map(deviationFindingLine)).filter(Boolean);
}
