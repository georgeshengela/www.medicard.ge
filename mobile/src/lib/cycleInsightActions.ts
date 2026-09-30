import type { CycleInsightCard } from '@/lib/api';
import { tx } from '../i18n/locale.js';

export type CycleInsightActionKind =
  | 'open_log'
  | 'open_log_bbt'
  | 'open_pregnancy'
  | 'open_settings'
  | 'open_chat'
  | 'reminder'
  | 'info_only';

export type CycleInsightActionPlan = {
  kind: CycleInsightActionKind;
  steps: string[];
  manualLabel: string;
  autoLabel?: string;
  autoMinutes?: number;
  reminderTitle?: string;
  reminderBody?: string;
  route?: { pathname: string; params?: Record<string, string> };
  chatPrefill?: string;
};

function containsAny(text: string, needles: string[]) {
  const lower = text.toLowerCase();
  return needles.some((n) => lower.includes(n.toLowerCase()));
}

export function resolveInsightAction(card: CycleInsightCard): CycleInsightActionPlan {
  const action = card.action ?? '';
  const blob = `${card.id} ${card.title} ${card.body} ${action}`;

  if (card.id.includes('phase') || containsAny(blob, ['აღრიცხვ', 'დღის ჩანაწერი', 'log'])) {
    return {
      kind: 'open_log',
      steps: [
        tx('გახსენი დღის აღრიცხვის ეკრანი.', 'Open the daily log screen.'),
        tx('მონიშნე გამონადენის სიძლიერე (თუ არის).', 'Mark your flow (if any).'),
        tx('დაამატე სიმპტომები და განწყობა — რაც უკეთესია მონაცემი, მით უფრო ზუსტია პროგნოზი.', 'Add symptoms and mood — the better the data, the more accurate the estimate.'),
        tx('დააჭირე „შენახვა“.', 'Tap “Save”.'),
      ],
      manualLabel: action || tx('გახსენი აღრიცხვა', 'Open log'),
      autoLabel: tx('გახსენი და შეავსე შენიშვნა', 'Open with a note'),
      route: {
        pathname: '/cycle/log',
        params: { prefillNote: card.action || card.title },
      },
    };
  }

  if (containsAny(blob, ['bbt', 'ლორწო', 'ტემპერატურ', 'mucus', 'temperature'])) {
    return {
      kind: 'open_log_bbt',
      steps: [
        tx('გახსენი აღრიცხვა → „დეტალები“ ჩანართი.', 'Open the log → “Details” tab.'),
        tx('შეიყვანე ბაზალური ტემპერატურა (BBT) ან ცერვიკალური ლორწო.', 'Enter your basal body temperature (BBT) or cervical mucus.'),
        tx('სურვილისამებრ დაამატე შენიშვნა.', 'Add a note if you like.'),
        tx('შეინახე — ეს სიზუსტეს ზრდის TTC რეჟიმში.', 'Save — this improves accuracy in TTC mode.'),
      ],
      manualLabel: action || tx('აღრიცხე BBT / ლორწო', 'Log BBT / mucus'),
      autoLabel: tx('გახსენი BBT ველით', 'Open with BBT field'),
      route: {
        pathname: '/cycle/log',
        params: { tab: 'more', prefillNote: card.action || tx('BBT / ლორწო', 'BBT / mucus') },
      },
    };
  }

  if (card.tone === 'pregnancy' || containsAny(blob, ['ორსულ', 'ჩეკლისტ', 'პრენატალ', 'checklist', 'prenatal'])) {
    return {
      kind: 'open_pregnancy',
      steps: [
        tx('გახსენი ორსულობის ეკრანი.', 'Open the pregnancy screen.'),
        tx('გადაამოწმე კვირის რჩევები და ჩეკლისტი.', 'Check this week’s tips and checklist.'),
        tx('მონიშნე დღევანდელი ნაბიჯები (ვიტამინი, წყალი, დასვენება).', 'Check off today’s steps (vitamins, water, rest).'),
      ],
      manualLabel: action || tx('გახსენი ორსულობის ჩეკლისტი', 'Open pregnancy checklist'),
      route: { pathname: '/cycle/pregnancy' },
    };
  }

  if (containsAny(blob, ['მენსტრუაცი', 'last period', 'ბოლო მენსტ'])) {
    return {
      kind: 'open_settings',
      steps: [
        tx('გახსენი ციკლის პარამეტრები.', 'Open cycle settings.'),
        tx('განაახლე „ბოლო მენსტრუაციის დასაწყისი“.', 'Update “Start of last period”.'),
        tx('შეინახე — პროგნოზები განახლდება.', 'Save — estimates will update.'),
      ],
      manualLabel: tx('პარამეტრების გახსნა', 'Open settings'),
      route: { pathname: '/cycle/settings' },
    };
  }

  if (containsAny(blob, ['წყალი', 'ჰიდრატ', 'დაისვენ', 'დასვენ', 'water', 'hydrat'])) {
    return {
      kind: 'reminder',
      steps: [
        tx('დალიე 1–2 ჭიქა წყალი ნელა.', 'Slowly drink 1–2 glasses of water.'),
        tx('დაჯექი ან დაწექი ზურგზე 10–15 წუთით.', 'Sit or lie on your back for 10–15 minutes.'),
        tx('თბილი პაკი მუცელზე დაგეხმარება კრუნჩხვებისას.', 'A warm pack on your belly can help with cramps.'),
      ],
      manualLabel: action || tx('გავაკეთო ახლა', 'Do it now'),
      autoLabel: tx('30 წუთში შემახსენე', 'Remind me in 30 min'),
      autoMinutes: 30,
      reminderTitle: tx('Medicard · ციკლი', 'Medicard · Cycle'),
      reminderBody: action || tx('დროა წყალი და მოკლე დასვენება.', 'Time for some water and a short rest.'),
    };
  }

  if (containsAny(blob, ['სუნთქვ', 'breath'])) {
    return {
      kind: 'reminder',
      steps: [
        tx('დაჯექი კომფორტულად, ფეხები იატაკზე.', 'Sit comfortably with your feet on the floor.'),
        tx('4 წამი შეიყვანე ჰაერი ცხვირით.', 'Breathe in through your nose for 4 seconds.'),
        tx('4 წამით შეიკავე სუნთქვა.', 'Hold for 4 seconds.'),
        tx('6 წამის განმავლობაში ნელა ამოისუნთქე — გაიმეორე 5-ჯერ.', 'Breathe out slowly for 6 seconds — repeat 5 times.'),
      ],
      manualLabel: action || tx('5 წუთი სუნთქვა', '5 min breathing'),
      autoLabel: tx('5 წუთში შემახსენე', 'Remind me in 5 min'),
      autoMinutes: 5,
      reminderTitle: tx('Medicard · სუნთქვა', 'Medicard · Breathing'),
      reminderBody: tx('5 წუთი ღრმა სუნთქვა — დაიწყე ახლა.', '5 minutes of deep breathing — start now.'),
    };
  }

  if (containsAny(blob, ['სეირნ', 'walk', 'movement'])) {
    return {
      kind: 'reminder',
      steps: [
        tx('მსუბუქად გაისეირნე 10–15 წუთი.', 'Take a light 10–15 minute walk.'),
        tx('შეინარჩუნე თანაბარი ტემპი და ღრმად ისუნთქე.', 'Keep an even pace and breathe deeply.'),
        tx('დაბრუნების შემდეგ დააკვირდი განწყობას.', 'When you’re back, notice how you feel.'),
      ],
      manualLabel: action || tx('მოკლე სეირნობა', 'Short walk'),
      autoLabel: tx('15 წუთში შემახსენე', 'Remind me in 15 min'),
      autoMinutes: 15,
      reminderTitle: tx('Medicard · სეირნობა', 'Medicard · Walk'),
      reminderBody: tx('დროა მოკლე სეირნობისთვის.', 'Time for a short walk.'),
    };
  }

  if (action) {
    return {
      kind: 'open_chat',
      steps: [
        tx('გახსენი საუბარი Medi-სთან.', 'Open a chat with Medi.'),
        tx('გაუზიარე Medi-ს შენი სიმპტომები და კონტექსტი.', 'Tell Medi about your symptoms and context.'),
        tx('მიიღე რჩევა და დააზუსტე კითხვები. ეს არ ცვლის ექიმს.', 'Get tips and ask follow-up questions. This does not replace a doctor.'),
      ],
      manualLabel: action,
      autoLabel: tx('ჰკითხე Medi-ს', 'Ask Medi'),
      chatPrefill: tx(`ციკლის რჩევის შესახებ: „${card.title}“. ${card.body} რას მირჩევ?`, `About a cycle tip: “${card.title}”. ${card.body} What do you suggest?`),
    };
  }

  return {
    kind: 'info_only',
    steps: [card.body],
    manualLabel: tx('გასაგებია', 'Got it'),
  };
}

/** @deprecated use resolveInsightAction */
export type CycleInsightRoute = 'log' | 'pregnancy' | null;

export function resolveInsightRoute(card: CycleInsightCard): CycleInsightRoute {
  const plan = resolveInsightAction(card);
  if (plan.kind === 'open_log' || plan.kind === 'open_log_bbt') return 'log';
  if (plan.kind === 'open_pregnancy') return 'pregnancy';
  return null;
}
