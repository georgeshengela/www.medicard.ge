import {
  CYCLE_CHANNEL_ID,
  CYCLE_DISCREET_CHANNEL_ID,
  MED_CHANNEL_ID,
  PUSH_CHANNEL_ID,
  QA_PREFIX,
  STEPS_CHANNEL_ID,
  VISIT_CHANNEL_ID,
  WEIGHT_CHANNEL_ID,
  ENGAGE_CHANNEL_ID,
  presentNotificationNow,
} from '@/lib/notifications';
import { previewPushCopy } from '@/lib/pushCopy';

export type NotificationSendKind = 'local' | 'remote';

export type NotificationCatalogGroup = 'med' | 'cycle' | 'visit' | 'steps' | 'weight' | 'admin' | 'engage';

export type NotificationCatalogItem = {
  id: string;
  group: NotificationCatalogGroup;
  send: NotificationSendKind;
  label: string;
  how: string;
  title: string;
  body: string;
  channelId: string;
  data: Record<string, unknown>;
  fireable: boolean;
  note?: string;
};

export const NOTIFICATION_GROUP_LABELS: Record<NotificationCatalogGroup, string> = {
  med: 'მედიკამენტები',
  cycle: 'ციკლი',
  visit: 'ვიზიტი',
  steps: 'ნაბიჯები',
  weight: 'წონა',
  admin: 'ადმინი · remote push',
  engage: 'Medi companion',
};

export const NOTIFICATION_GROUPS: NotificationCatalogGroup[] = [
  'med',
  'cycle',
  'visit',
  'steps',
  'weight',
  'admin',
  'engage',
];

function item(
  partial: Omit<NotificationCatalogItem, 'title' | 'body' | 'fireable'> & { fireable?: boolean },
): NotificationCatalogItem {
  const copy = previewPushCopy(partial.id);
  return {
    ...partial,
    title: copy.title,
    body: copy.body,
    fireable: partial.fireable ?? true,
    data: { ...partial.data, templateKey: partial.id },
  };
}

export function notificationCatalog(): NotificationCatalogItem[] {
  return [
    item({
      id: 'medication',
      group: 'med',
      send: 'local',
      label: 'დოზის შეხსენება',
      how: 'Local · DAILY, ან WEEKLY თუ მხოლოდ ზოგი დღეა არჩეული. იწერება მედების ჰაბის გახსნაზე. ტექსტი ადმინიდან.',
      channelId: MED_CHANNEL_ID,
      data: { type: 'medication', medicationId: 'qa-med', time: '09:00', route: '/medications/qa-med' },
    }),
    item({
      id: 'med-refill',
      group: 'med',
      send: 'local',
      label: 'შევსების შეხსენება',
      how: 'ინახება config.refillReminder-ში. ჯერ არ იგეგმება OS-ში — remainingCount არ იკლებს მიღებაზე.',
      channelId: MED_CHANNEL_ID,
      data: { type: 'medication_refill', route: '/medications' },
      note: 'UI toggle არსებობს, scheduler ჯერ არაა.',
    }),
    item({
      id: 'cycle-period-soon',
      group: 'cycle',
      send: 'local',
      label: 'მენსტრუაცია ახლოვდება',
      how: 'Local · DATE 09:00, N დღით ადრე. syncCycleReminders.',
      channelId: CYCLE_CHANNEL_ID,
      data: { type: 'cycle_reminder', route: '/cycle' },
    }),
    item({
      id: 'cycle-period-start',
      group: 'cycle',
      send: 'local',
      label: 'სავარაუდო დაწყება',
      how: 'Local · DATE 09:00 nextPeriodStart-ზე.',
      channelId: CYCLE_CHANNEL_ID,
      data: { type: 'cycle_reminder', route: '/cycle/log' },
    }),
    item({
      id: 'cycle-ovulation',
      group: 'cycle',
      send: 'local',
      label: 'ოვულაცია (TTC)',
      how: 'Local · DATE. მხოლოდ TRY_TO_CONCEIVE + prefs.ovulation.',
      channelId: CYCLE_CHANNEL_ID,
      data: { type: 'cycle_reminder', route: '/cycle/log?tab=more' },
    }),
    item({
      id: 'cycle-fertile',
      group: 'cycle',
      send: 'local',
      label: 'ნაყოფიერი ფანჯარა',
      how: 'Local · DATE fertileWindow.start-ზე.',
      channelId: CYCLE_CHANNEL_ID,
      data: { type: 'cycle_reminder', route: '/cycle' },
    }),
    item({
      id: 'cycle-pms',
      group: 'cycle',
      send: 'local',
      label: 'PMS პატერნი',
      how: 'Local · DATE, ოვულაციიდან +2 დღე.',
      channelId: CYCLE_CHANNEL_ID,
      data: { type: 'cycle_reminder', route: '/cycle' },
    }),
    item({
      id: 'cycle-opk',
      group: 'cycle',
      send: 'local',
      label: 'OPK ტესტი',
      how: 'Local · DATE, TTC + prefs.opk.',
      channelId: CYCLE_CHANNEL_ID,
      data: { type: 'cycle_reminder', route: '/cycle/log?tab=more' },
    }),
    item({
      id: 'cycle-bbt',
      group: 'cycle',
      send: 'local',
      label: 'BBT დილით',
      how: 'Local · DATE დღეს 09:00, თუ BBT ჯერ არაა აღრიცხული.',
      channelId: CYCLE_CHANNEL_ID,
      data: { type: 'cycle_reminder', route: '/cycle/log?tab=more' },
    }),
    item({
      id: 'cycle-log',
      group: 'cycle',
      send: 'local',
      label: 'დღის აღრიცხვა',
      how: 'Local · DATE დღეს 09:00, თუ ლოგი არაა.',
      channelId: CYCLE_CHANNEL_ID,
      data: { type: 'cycle_reminder', route: '/cycle/log' },
    }),
    item({
      id: 'cycle-tip',
      group: 'cycle',
      send: 'local',
      label: 'Medi რჩევა',
      how: 'Local · TIME_INTERVAL. scheduleCycleReminder — ერთჯერადი.',
      channelId: CYCLE_CHANNEL_ID,
      data: { type: 'cycle_tip', route: '/cycle' },
    }),
    item({
      id: 'cycle-masked',
      group: 'cycle',
      send: 'local',
      label: 'დისკრეტული (mask)',
      how: 'იგივე cycle DATE, lock-screen ტექსტი ადმინის cycle-masked შაბლონით.',
      channelId: CYCLE_DISCREET_CHANNEL_ID,
      data: { type: 'cycle_reminder', masked: true, route: '/cycle' },
    }),
    item({
      id: 'visit',
      group: 'visit',
      send: 'local',
      label: 'ექიმთან ვიზიტი',
      how: 'Local · DATE თითო offset-ზე. syncVisitReminders.',
      channelId: VISIT_CHANNEL_ID,
      data: { type: 'visit_reminder', visitId: 'qa-visit', route: '/visits/editor?id=qa-visit' },
    }),
    item({
      id: 'steps',
      group: 'steps',
      send: 'local',
      label: 'ნაბიჯების მიზანი',
      how: 'Local · WEEKLY. saveStepsGoal → syncStepsGoalReminders.',
      channelId: STEPS_CHANNEL_ID,
      data: { type: 'steps-goal', goalId: 'qa-steps', route: '/health-metrics/steps' },
    }),
    item({
      id: 'weight',
      group: 'weight',
      send: 'local',
      label: 'წონის მიზანი',
      how: 'Local · WEEKLY. saveWeightGoal → syncWeightGoalReminders.',
      channelId: WEIGHT_CHANNEL_ID,
      data: { type: 'weight-goal', goalId: 'qa-weight', route: '/health-metrics/weight' },
    }),
    item({
      id: 'engage-weekly',
      group: 'engage',
      send: 'local',
      label: 'კვირის შეჯამება',
      how: 'Notification Brain · კვირა 11:00. მხოლოდ თუ weekly ჩართულია.',
      channelId: ENGAGE_CHANNEL_ID,
      data: { type: 'medi_engage', family: 'weekly', route: '/week' },
    }),
    item({
      id: 'engage-checkin-morning',
      group: 'engage',
      send: 'local',
      label: 'Medi მოკითხვა',
      how: 'Brain · არ იგზავნება თუ აპი ახლახანს გაიხსნა.',
      channelId: ENGAGE_CHANNEL_ID,
      data: { type: 'medi_engage', family: 'checkin', route: '/chat/DOCTOR' },
    }),
    item({
      id: 'engage-hydration',
      group: 'engage',
      send: 'local',
      label: 'წყალი',
      how: 'Brain · მხოლოდ თუ მიზანი არაა მიღწეული. 3–4სთ cooldown.',
      channelId: ENGAGE_CHANNEL_ID,
      data: { type: 'medi_engage', family: 'hydration', route: '/health-metrics/hydration' },
    }),
    item({
      id: 'engage-unfinished-med',
      group: 'engage',
      send: 'local',
      label: 'დაუსრულებელი',
      how: 'Brain · მხოლოდ შენახული draft, 3სთ შემდეგ.',
      channelId: ENGAGE_CHANNEL_ID,
      data: { type: 'medi_engage', family: 'unfinished', route: '/medications/add/setup' },
    }),
    item({
      id: 'engage-visit-followup',
      group: 'engage',
      send: 'local',
      label: 'ვიზიტის შემდეგ',
      how: 'Brain · 3–36სთ ვიზიტის შემდეგ, თუ ჩანაწერი არაა.',
      channelId: ENGAGE_CHANNEL_ID,
      data: { type: 'medi_engage', family: 'visitFollowup', visitId: 'qa-visit', route: '/visits/editor?id=qa-visit' },
    }),
    item({
      id: 'engage-insight-meds',
      group: 'engage',
      send: 'local',
      label: 'მიღების დრო',
      how: 'Brain · რამდენიმე გამოტოვება → შეხსენების მორგება, არა საყვედური.',
      channelId: ENGAGE_CHANNEL_ID,
      data: { type: 'medi_engage', family: 'insight', route: '/medications/reminders' },
    }),
    item({
      id: 'engage-weather-walk',
      group: 'engage',
      send: 'local',
      label: 'ამინდი',
      how: 'Brain · weather_wellness. მაქს. 1/დღე, 22სთ cooldown, revalidate forecast.',
      channelId: ENGAGE_CHANNEL_ID,
      data: { type: 'medi_engage', family: 'weatherWellness', route: '/weather?from=push' },
    }),
    item({
      id: 'engage-quest-near-complete',
      group: 'engage',
      send: 'local',
      label: 'Quest · ცოტა დაგვრჩა',
      how: 'Brain · QUEST_SMART. მაქს. 1/დღე, 20სთ cooldown, revalidate progress.',
      channelId: ENGAGE_CHANNEL_ID,
      data: {
        type: 'medi_engage',
        family: 'questSmart',
        candidateType: 'QUEST_NEAR_COMPLETE',
        route: '/medi-quest?from=push',
      },
    }),
    item({
      id: 'engage-quest-weather-window',
      group: 'engage',
      send: 'local',
      label: 'Quest · ამინდის ფანჯარა',
      how: 'Brain · QUEST_GOOD_WEATHER_WINDOW. საჭიროა DEV weather fixture.',
      channelId: ENGAGE_CHANNEL_ID,
      data: {
        type: 'medi_engage',
        family: 'questSmart',
        candidateType: 'QUEST_GOOD_WEATHER_WINDOW',
        route: '/medi-quest?from=push',
      },
    }),
    item({
      id: 'engage-quest-comeback',
      group: 'engage',
      send: 'local',
      label: 'Quest · დაბრუნება',
      how: 'Brain · QUEST_COMEBACK. თბილი re-entry, არა guilt.',
      channelId: ENGAGE_CHANNEL_ID,
      data: {
        type: 'medi_engage',
        family: 'questSmart',
        candidateType: 'QUEST_COMEBACK',
        route: '/medi-quest?from=push',
      },
    }),
    item({
      id: 'admin-push',
      group: 'admin',
      send: 'remote',
      label: 'ადმინის broadcast',
      how: 'Remote · Expo Push Service. ნამდვილი გაგზავნა მხოლოდ ადმინიდან. აქ ლოკალური პრევიუა.',
      channelId: PUSH_CHANNEL_ID,
      data: { type: 'admin_push', campaignId: 'qa', route: '/(tabs)/home' },
      note: 'ნამდვილი remote გაგზავნა მხოლოდ ადმინიდან.',
    }),
  ];
}

export async function fireCatalogItem(item: NotificationCatalogItem, secondsFromNow = 2): Promise<boolean> {
  if (!item.fireable) return false;
  const { categoryForNotification } = await import('@/lib/mediNotificationActions');
  const family = typeof item.data.family === 'string' ? item.data.family : undefined;
  const type = typeof item.data.type === 'string' ? item.data.type : undefined;
  return presentNotificationNow({
    identifier: `${QA_PREFIX}${item.id}:${Date.now()}`,
    title: item.title,
    body: item.body,
    data: { ...item.data, qa: true },
    channelId: item.channelId,
    secondsFromNow,
    categoryIdentifier: categoryForNotification(type, family),
  });
}

export async function fireAllCatalogItems(): Promise<number> {
  const items = notificationCatalog().filter((row) => row.fireable);
  let ok = 0;
  for (let i = 0; i < items.length; i += 1) {
    const fired = await fireCatalogItem(items[i], 2 + i * 3);
    if (fired) ok += 1;
  }
  return ok;
}
