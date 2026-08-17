import type { CycleInsightCard } from '@/lib/api';

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
        'გახსენით დღის აღრიცხვის ეკრანი.',
        'მონიშნეთ გამონადენის სიძლიერე (თუ არის).',
        'დაამატეთ სიმპტომები და განწყობა — რაც უკეთესია მონაცემი, მით ზუსტი პროგნოზი.',
        'დააჭირეთ „შენახვა“.',
      ],
      manualLabel: action || 'გახსენი აღრიცხვა',
      autoLabel: 'გახსენი და შეავსე შენიშვნა',
      route: {
        pathname: '/cycle/log',
        params: { prefillNote: card.action || card.title },
      },
    };
  }

  if (containsAny(blob, ['bbt', 'ლორწო', 'ტემპერატურ'])) {
    return {
      kind: 'open_log_bbt',
      steps: [
        'გახსენით აღრიცხვა → „დეტალები“ ჩანართი.',
        'შეიყვანეთ ბაზალური ტემპერატურა (BBT) ან cervical mucus.',
        'სურვილისამებრ დაამატეთ შენიშვნა.',
        'შეინახეთ — ეს ზუსტობას ზრდის TTC რეჟიმში.',
      ],
      manualLabel: action || 'აღრიცხე BBT / ლორწო',
      autoLabel: 'გახსენი BBT ველით',
      route: {
        pathname: '/cycle/log',
        params: { tab: 'more', prefillNote: card.action || 'BBT / ლორწო' },
      },
    };
  }

  if (card.tone === 'pregnancy' || containsAny(blob, ['ორსულ', 'ჩეკლისტ', 'პრენატალ'])) {
    return {
      kind: 'open_pregnancy',
      steps: [
        'გახსენით ორსულობის ეკრანი.',
        'გადაამოწმეთ კვირის რჩევები და ჩეკლისტი.',
        'მონიშნეთ დღევანდელი ნაბიჯები (ვიტამინი, წყალი, დასვენება).',
      ],
      manualLabel: action || 'გახსენი ორსულობის ჩეკლისტი',
      route: { pathname: '/cycle/pregnancy' },
    };
  }

  if (containsAny(blob, ['მენსტრუაცი', 'last period', 'ბოლო მენსტ'])) {
    return {
      kind: 'open_settings',
      steps: [
        'გახსენით ციკლის პარამეტრები.',
        'განაახლეთ „ბოლო მენსტრუაციის დასაწყისი“.',
        'შეინახეთ — პროგნოზები განახლდება.',
      ],
      manualLabel: 'პარამეტრების გახსნა',
      route: { pathname: '/cycle/settings' },
    };
  }

  if (containsAny(blob, ['წყალი', 'ჰიდრატ', 'დაისვენ', 'დასვენ'])) {
    return {
      kind: 'reminder',
      steps: [
        'დალიეთ 1–2 ჭიქა წყალი ნელა.',
        'დაჯექით ან დაემხეთ ზურგით 10–15 წუთით.',
        'თბილი პაკი მუცელზე დაგეხმარებათ კრუნჩხვებისას.',
      ],
      manualLabel: action || 'გავაკეთო ახლა',
      autoLabel: '30 წუთში შემაგონე',
      autoMinutes: 30,
      reminderTitle: 'Medicard · ციკლი',
      reminderBody: action || 'დროა წყალი და მოკლე დასვენება.',
    };
  }

  if (containsAny(blob, ['სუნთქვ', 'breath'])) {
    return {
      kind: 'reminder',
      steps: [
        'დაჯექით კომფორტულად, ფეხები იატაკზე.',
        '4 წამი შეიყვანეთ ჰაერი ცხვირით.',
        '4 წამი გააჩერეთ.',
        '6 წამში ნელა ამოაგონოთ — გაიმეორეთ 5-ჯერ.',
      ],
      manualLabel: action || '5 წუთი სუნთქვა',
      autoLabel: '5 წუთში შემაგონე',
      autoMinutes: 5,
      reminderTitle: 'Medicard · სუნთქვა',
      reminderBody: '5 წუთი სიღრმისეული სუნთქვა — დაიწყე ახლა.',
    };
  }

  if (containsAny(blob, ['სეირნ', 'walk', 'movement'])) {
    return {
      kind: 'reminder',
      steps: [
        'გაუშვით 10–15 წუთიანი მსუბუქი სეირნობა.',
        'შეეცადეთ თანაბერი ტემპი, ღრმა სუნთქვა.',
        'დაბრუნების შემდეგ დააკვირდით განწყობას.',
      ],
      manualLabel: action || 'მოკლე სეირნობა',
      autoLabel: '15 წუთში შემაგონე',
      autoMinutes: 15,
      reminderTitle: 'Medicard · სეირნობა',
      reminderBody: 'დროა მოკლე სეირნობისთვის.',
    };
  }

  if (action) {
    return {
      kind: 'open_chat',
      steps: [
        'გახსენით AI ექიმთან საუბარი.',
        'გაეცით AI-ს თქვენი სიმპტომები და კონტექსტი.',
        'მიიღეთ პერსონალიზებული რჩევა და დააზუსტეთ კითხვები.',
      ],
      manualLabel: action,
      autoLabel: 'AI ექიმთან ავტომატური კითხვა',
      chatPrefill: `ციკლის რჩევის შესახებ: „${card.title}“. ${card.body} რა გირჩევ?`,
    };
  }

  return {
    kind: 'info_only',
    steps: [card.body],
    manualLabel: 'გასაგებია',
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
