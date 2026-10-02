/**
 * MEDIRUN with the phone in a pocket: the in-app heartbeat (sound + vibration) cannot run while the screen is
 * locked — iOS lets an app vibrate the phone then only through a notification. So when the session is in the
 * background and the pulse finds a gift, the person gets at most two notifications per find: one when the
 * signal starts ("a find is near") and one when it is in reach ("it's right next to you — open the camera").
 * The foreground keeps the in-app heartbeat only; nothing here fires while the map is on screen.
 */
import { AppState, Platform } from 'react-native';
import { tx } from '@/i18n/locale';
import type { GiftSignal } from '@/lib/medipulsi/types';

export type GiftAlertKind = 'near' | 'here';

/** A new "near" episode needs the signal gone this long, so walking along a gift's edge never spams. */
const NEAR_QUIET_MS = 10 * 60_000;
export const GIFT_CHANNEL_ID = 'medirun-gift-v1';
/** Android: two lub-dubs, the same rhythm as the in-app heartbeat. */
const HEARTBEAT_PATTERN = [0, 70, 110, 45, 380, 70, 110, 45];

type Notify = (kind: GiftAlertKind) => Promise<void>;

/** Pure decision state (tested): which notification, if any, this signal deserves. */
export function createGiftAlertState() {
  let lastNearAt = 0;
  let signalSince: number | null = null;
  let lastSignalAt = 0;
  const here = new Set<string>();
  return {
    decide(signal: GiftSignal, now = Date.now()): GiftAlertKind | null {
      if (!signal.signal || !signal.quality) {
        signalSince = null;
        return null;
      }
      const fresh = signalSince == null && now - lastSignalAt >= NEAR_QUIET_MS;
      if (signalSince == null) signalSince = now;
      lastSignalAt = now;
      if (signal.revealed && signal.gift?.id) {
        if (here.has(signal.gift.id)) return null;
        here.add(signal.gift.id);
        lastNearAt = now;
        return 'here';
      }
      if (fresh && now - lastNearAt >= NEAR_QUIET_MS) {
        lastNearAt = now;
        return 'near';
      }
      return null;
    },
    reset() {
      lastNearAt = 0;
      signalSince = null;
      lastSignalAt = 0;
      here.clear();
    },
  };
}

const state = createGiftAlertState();
let channelReady: Promise<void> | null = null;

async function deliver(kind: GiftAlertKind): Promise<void> {
  const { Notifications } = await import('@/lib/expoNotifications');
  const { getNotificationPermissionGranted } = await import('@/lib/notifications');
  // Never asks for permission here (iOS 26 rule): without it the Live Activity still shows the heart.
  if (!(await getNotificationPermissionGranted())) return;
  if (Platform.OS === 'android' && !channelReady) {
    channelReady = Notifications.setNotificationChannelAsync(GIFT_CHANNEL_ID, {
      name: tx('MEDIRUN აღმოჩენები', 'MEDIRUN finds'),
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: HEARTBEAT_PATTERN,
      lightColor: '#FB7185',
      sound: 'default',
    }).then(() => undefined).catch(() => { channelReady = null; });
    await channelReady;
  }
  const near = kind === 'near';
  await Notifications.scheduleNotificationAsync({
    identifier: `medirun-gift:${kind}:${Date.now()}`,
    content: {
      title: near ? tx('💓 აღმოჩენა ახლოსაა', '💓 A find is near') : tx('🎁 საჩუქარი შენ გვერდითაა', '🎁 The gift is right next to you'),
      body: near
        ? tx('გახსენი MEDIRUN და მიჰყევი პულსს.', 'Open MEDIRUN and follow the pulse.')
        : tx('გახსენი MEDIRUN და ჩართე კამერა — ყუთი აქვეა.', 'Open MEDIRUN and turn on the camera — the box is right here.'),
      sound: true,
      data: { type: 'medirun_gift', route: near ? '/run/active' : '/run/active?gift=1' },
      ...(Platform.OS === 'android' ? { channelId: GIFT_CHANNEL_ID } : {}),
    },
    trigger: null,
  });
}

/** Called with every gift signal the background session receives. */
export function onGiftSignal(signal: GiftSignal, notify: Notify = deliver): void {
  if (AppState.currentState === 'active') {
    // On screen the heartbeat leads; keep the episode bookkeeping so locking the phone mid-signal stays quiet.
    state.decide(signal);
    return;
  }
  const kind = state.decide(signal);
  if (kind) void notify(kind).catch(() => {});
}

/** A new session starts with a clean slate. */
export function resetGiftAlerts(): void {
  state.reset();
}
