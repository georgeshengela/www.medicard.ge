/**
 * Copy for „თვალყურის დევნება“ / Tracking (`expectsBleeding: false`) and „ნაყოფიერი დღეების ჩვენება“
 * (brief §9 wave 2 item 17, [კ-7]). One place for the Home hero, the /cycle hero, its explain sheet,
 * cycle settings and the onboarding suggestion. Never a diagnosis, never a contraception method.
 */
import { tx } from '../i18n/locale.js';

export const trackingCopy = {
  title: () => tx('თვალყურის დევნება', 'Tracking'),
  howAreYou: () => tx('როგორ ხარ დღეს?', 'How are you today?'),
  detail: () => tx('პროგნოზებს არ ვაჩვენებთ — მხოლოდ იმას, რასაც აღრიცხავ.', 'No estimates — only what you log.'),
  today: () => tx('დღეს', 'Today'),
  /** The action's full name (accessibility, explain sheet). */
  newCycle: () => tx('ახალი ციკლის დაწყება', 'Start a new cycle'),
  /** The same action on the narrow button beside „♥ სექსი“. */
  newCycleShort: () => tx('ახალი ციკლი', 'New cycle'),
  /** Legend word for logged bleeding: without a period forecast it is „სისხლდენა“, not „მენსტრუაცია“. */
  bleedLegend: () => tx('სისხლდენა', 'Bleeding'),
  endBleed: () => tx('სისხლდენის დასრულება', 'End bleeding'),
  ringA11y: (bleedDays: number, loggedDays: number) =>
    tx(
      `ბოლო 4 კვირა: სისხლდენა ${bleedDays} დღე, სხვა აღრიცხული დღე ${loggedDays}.`,
      `Last 4 weeks: bleeding on ${bleedDays} ${bleedDays === 1 ? 'day' : 'days'}, ${loggedDays} other logged ${loggedDays === 1 ? 'day' : 'days'}.`,
    ),
  ringHint: () => tx('ბოლო 4 კვირა · ვარდისფერი — აღრიცხული სისხლდენა', 'Last 4 weeks · rose = logged bleeding'),
  explainBody: () => [
    tx(
      'შენ მიუთითე, რომ მენსტრუაციას არ ელი (მაგ. ჰორმონული სპირალი, იმპლანტი, უწყვეტი აბი). ამიტომ შემდეგ მენსტრუაციას, დაგვიანებას და ნაყოფიერ დღეებს არ ვაფასებთ.',
      "You told us you don't expect periods (e.g. a hormonal IUD, an implant, a continuous pill), so we don't estimate your next period, a late period or fertile days.",
    ),
    tx(
      'რგოლზე ბოლო 4 კვირაა: ვარდისფერი — აღრიცხული სისხლდენა, წერტილი — აღრიცხული დღე. მოულოდნელი ან ლაქოვანი სისხლდენისას დააჭირე „ახალი ციკლის დაწყება“ — ჩაიწერება, პროგნოზი კი არ ჩაირთვება.',
      'The ring shows the last 4 weeks: rose is logged bleeding, a dot is a logged day. For unexpected bleeding or spotting tap “Start a new cycle” — it is logged, estimates stay off.',
    ),
    tx('თუ სისხლდენა მოულოდნელია ან რამე გაწუხებს, ესაუბრე ექიმს.', 'If bleeding is unexpected or something worries you, talk to your doctor.'),
  ],
  explainCaption: () => tx('შეცვლა: ციკლის პარამეტრები', 'Change it in cycle settings'),
};

export const trackingSettingsCopy = {
  section: () => tx('მენსტრუაცია და ნაყოფიერი დღეები', 'Periods and fertile days'),
  expectsLabel: () =>
    tx(
      'მენსტრუაციას არ ველი (მაგ. ჰორმონული სპირალი, იმპლანტი, უწყვეტი აბი)',
      "I don't expect periods (e.g. hormonal IUD, implant, continuous pill)",
    ),
  expectsHint: () =>
    tx(
      'შემდეგი მენსტრუაციის, დაგვიანებისა და ნაყოფიერი დღეების პროგნოზი ითიშება; აღრიცხვა რჩება.',
      'Next-period, late and fertile-day estimates turn off; logging stays.',
    ),
  fertilityLabel: () => tx('ნაყოფიერი დღეების ჩვენება', 'Show fertile days'),
  fertilityHintOn: () =>
    tx(
      'სავარაუდო ნაყოფიერი დღეები და ოვულაცია, როცა საკმარისი მონაცემია. კონტრაცეფციის მეთოდი არ არის.',
      'Estimated fertile days and ovulation once there is enough data. Not a contraception method.',
    ),
  fertilityHintOff: () =>
    tx(
      'ნაყოფიერი დღეები, ოვულაცია და მათი შეხსენებები არსად გამოჩნდება.',
      'Fertile days, ovulation and their reminders are hidden everywhere.',
    ),
  forced: (forcedBy: string | null | undefined): string | null => {
    switch (forcedBy) {
      case 'ttc':
        return tx('ორსულობის დაგეგმვისას ნაყოფიერი დღეები ყოველთვის ჩანს.', 'Always shown while trying to conceive.');
      case 'contraception':
        return tx('ჰორმონული კონტრაცეფციისას ნაყოფიერ დღეებს არ ვაჩვენებთ.', 'Not shown with hormonal contraception.');
      case 'tracking':
        return tx('არ ჩანს, სანამ „მენსტრუაციას არ ველი“ ჩართულია.', 'Hidden while “I don’t expect periods” is on.');
      case 'mode':
        return tx('ამ რეჟიმში ნაყოფიერ დღეებს არ ვაჩვენებთ.', 'Not shown in this mode.');
      default:
        return null;
    }
  },
};

export const trackingOnboardingCopy = {
  title: () => tx('მენსტრუაციას არ ველი', "I don't expect periods"),
  body: () =>
    tx(
      'ამ მეთოდით ზოგს მენსტრუაცია აღარ აქვს. მონიშნე და პროგნოზებს არ ვაჩვენებთ — შეცვლა პარამეტრებშიც შეიძლება.',
      "Some people stop bleeding with this method. Tick it and we won't show estimates — you can change it in settings.",
    ),
};
