/**
 * Product funnel queue (pure, no React Native imports so it runs under node:test).
 * Privacy: event names and small enums only — mirrors server/src/lib/funnel.js allow-list.
 * Never put health values, names, notes or any free text in props.
 */

export type FunnelEventName =
  | 'app_first_open'
  | 'signup_completed'
  | 'onboarding_step_viewed'
  | 'onboarding_step_completed'
  | 'onboarding_completed'
  | 'first_health_action'
  | 'price_alert_opened'
  | 'health_passport_created'
  | 'referral_shared'
  | 'home_layout_picker_opened'
  | 'home_layout_changed'
  | 'home_layout_offer_answered'
  | 'cycle_log_saved'
  | 'cycle_period_started'
  | 'cycle_explain_opened';

export type HealthActionType = 'medication' | 'meal' | 'cycle' | 'weight' | 'visit' | 'record' | 'checkin_manual';
export type InstallSource = 'organic' | 'invite' | 'utm' | 'deeplink';
/** Same enums as server HOME_LAYOUTS / HOME_LAYOUT_SOURCES / HOME_LAYOUT_OFFER_CHOICES. */
export type FunnelHomeLayout = 'standard' | 'women' | 'active' | 'weight';
export type FunnelHomeLayoutSource = 'home_header' | 'home_footer' | 'profile' | 'offer' | 'onboarding';
export type FunnelHomeLayoutOfferChoice = 'tried' | 'dismissed' | 'other';
/**
 * Cycle events (brief §9 wave 1 item 7) — same enums as server CYCLE_LOG_SOURCES /
 * CYCLE_PERIOD_START_SOURCES / CYCLE_EXPLAIN_TOPICS. Where it happened, never what: no category,
 * id, flow or value ever goes with them, and the sex sheet / BBT / tests send nothing.
 */
export const CYCLE_FUNNEL_LOG_SOURCES = ['quick', 'full', 'home', 'day_sheet'] as const;
export const CYCLE_FUNNEL_PERIOD_SOURCES = ['hero', 'home', 'strip', 'day_sheet'] as const;
export const CYCLE_FUNNEL_EXPLAIN_TOPICS = ['ring', 'fertile', 'stats', 'deviation', 'learn_more', 'ttc_signal', 'tracking'] as const;
export type CycleLogSource = (typeof CYCLE_FUNNEL_LOG_SOURCES)[number];
export type CyclePeriodStartSource = (typeof CYCLE_FUNNEL_PERIOD_SOURCES)[number];
export type CycleExplainTopic = (typeof CYCLE_FUNNEL_EXPLAIN_TOPICS)[number];

/** `{ <key>: value }` only when `value` is one of `allowed`; anything else → null (nothing is sent). */
export function cycleFunnelProps<K extends 'source' | 'topic'>(
  key: K,
  value: unknown,
  allowed: readonly string[],
): Record<K, string> | null {
  return typeof value === 'string' && allowed.includes(value) ? ({ [key]: value } as Record<K, string>) : null;
}

export type FunnelProps = Record<string, string>;

export type QueuedFunnelEvent = {
  name: FunnelEventName;
  props?: FunnelProps;
  at: string;
  /** Account that produced the event (null before sign-in). Never sent. */
  account: string | null;
};

export type SendResult = 'ok' | 'drop' | 'retry';

export type FunnelQueueDeps = {
  load: () => Promise<string | null>;
  save: (raw: string) => Promise<void>;
  /** Sends one batch for the current account. */
  send: (events: Array<Omit<QueuedFunnelEvent, 'account'>>) => Promise<SendResult>;
  currentAccount: () => string | null;
  now?: () => number;
  maxQueue?: number;
  batchSize?: number;
};

export const FUNNEL_MAX_QUEUE = 200;
export const FUNNEL_BATCH_SIZE = 25;
const PROP_VALUE = /^[a-z0-9][a-z0-9._-]{0,39}$/;

function cleanProps(props?: Record<string, unknown>): FunnelProps | undefined {
  if (!props) return undefined;
  const out: FunnelProps = {};
  for (const [key, value] of Object.entries(props)) {
    if (typeof value !== 'string') continue;
    const v = value.trim().toLowerCase();
    if (PROP_VALUE.test(v)) out[key] = v;
  }
  return Object.keys(out).length ? out : undefined;
}

export function parseQueue(raw: string | null): QueuedFunnelEvent[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((e) => e && typeof e.name === 'string' && typeof e.at === 'string') : [];
  } catch {
    return [];
  }
}

/**
 * Offline-tolerant queue: enqueue never throws or blocks; flush sends at most one batch at a time,
 * keeps events on network failure, drops them on a 4xx (a bad batch must not block the queue).
 * Events recorded under another account are discarded, never sent with the wrong token.
 */
export function createFunnelQueue(deps: FunnelQueueDeps) {
  const now = deps.now ?? (() => Date.now());
  const maxQueue = deps.maxQueue ?? FUNNEL_MAX_QUEUE;
  const batchSize = deps.batchSize ?? FUNNEL_BATCH_SIZE;
  let items: QueuedFunnelEvent[] | null = null;
  let chain: Promise<unknown> = Promise.resolve();
  let flushing: Promise<number> | null = null;

  const serial = <T>(work: () => Promise<T>): Promise<T> => {
    const next = chain.then(work, work);
    chain = next.then(() => undefined, () => undefined);
    return next;
  };
  const loaded = async () => {
    if (!items) items = parseQueue(await deps.load().catch(() => null));
    return items;
  };
  const persist = async () => {
    await deps.save(JSON.stringify(items ?? [])).catch(() => undefined);
  };

  function enqueue(name: FunnelEventName, props?: Record<string, unknown>): Promise<void> {
    return serial(async () => {
      const list = await loaded();
      list.push({ name, props: cleanProps(props), at: new Date(now()).toISOString(), account: deps.currentAccount() });
      if (list.length > maxQueue) list.splice(0, list.length - maxQueue);
      await persist();
    }).catch(() => undefined);
  }

  /** Sends queued batches; resolves to the number of events delivered. Never throws. */
  function flush(): Promise<number> {
    if (flushing) return flushing;
    flushing = (async () => {
      let delivered = 0;
      try {
        for (let round = 0; round < 8; round += 1) {
          const account = deps.currentAccount();
          const batch = await serial(async () => {
            const list = await loaded();
            // Anything recorded under a different signed-in account is not ours to send.
            const kept = list.filter((e) => e.account === null || e.account === account);
            if (kept.length !== list.length) {
              items = kept;
              await persist();
            }
            return (items ?? []).slice(0, batchSize);
          });
          if (!batch.length) break;
          const result = await deps.send(batch.map(({ account: _a, ...event }) => event)).catch((): SendResult => 'retry');
          if (result === 'retry') break;
          await serial(async () => {
            const sent = new Set(batch);
            items = (items ?? []).filter((e) => !sent.has(e));
            await persist();
          });
          if (result === 'ok') delivered += batch.length;
        }
      } catch {
        /* analytics never surfaces errors */
      }
      return delivered;
    })().finally(() => {
      flushing = null;
    });
    return flushing;
  }

  const size = () => serial(async () => (await loaded()).length);
  return { enqueue, flush, size };
}

/* ─────────────── Attribution from the launch URL ─────────────── */

function queryParams(url: string): Record<string, string> {
  const out: Record<string, string> = {};
  const q = url.split('#')[0].split('?')[1];
  if (!q) return out;
  for (const part of q.split('&')) {
    const [k, v = ''] = part.split('=');
    if (!k) continue;
    try {
      out[decodeURIComponent(k).toLowerCase()] = decodeURIComponent(v.replace(/\+/g, ' '));
    } catch {
      /* malformed escape */
    }
  }
  return out;
}

/** Install source from the URL that opened the app for the first time (null = normal launch). */
export function installSourceFromUrl(url: string | null | undefined): { source: InstallSource; utmSource?: string; utmMedium?: string; utmCampaign?: string } {
  const raw = String(url ?? '').trim();
  if (!raw) return { source: 'organic' };
  const params = queryParams(raw);
  const utm = cleanProps({ utmSource: params.utm_source, utmMedium: params.utm_medium, utmCampaign: params.utm_campaign });
  if (utm?.utmSource) return { source: 'utm', ...utm };
  const path = raw.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '').split(/[?#]/)[0];
  // medicard://invite/CODE → "invite/CODE"; https://medicard.ge/i/CODE → "medicard.ge/i/CODE"
  if (/^(?:[^/]*\/)?(?:invite|i)\/[A-Za-z0-9]{4,20}\/?$/.test(path) || /^invite\//.test(path)) return { source: 'invite' };
  // Expo dev client / bare scheme launches are not a marketing link.
  if (!path || /^expo-development-client/.test(path) || /^(?:[^/]*\/)?$/.test(path)) return { source: 'organic' };
  return { source: 'deeplink' };
}
