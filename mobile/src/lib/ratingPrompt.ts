import { Linking, Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import { isFeatureOn } from '@/lib/featureFlags';
import { trackFunnel } from '@/lib/funnel';
import { otaCardVisible } from '@/lib/otaUpdates';
import { getPreference, setPreference } from '@/lib/storage';
import {
  parseRatingState,
  ratingPromptDue,
  withAnswer,
  withGoodMoment,
  withShown,
  type RatingAnswer,
  type RatingPromptState,
} from './ratingPromptRules';

/**
 * App Store rating request (owner 2026-10-11): the Medi card „MEDICARD შენთვის უფასოა“ on Home after a
 * good moment (rules in ratingPromptRules.ts), the Profile row „შეაფასე MEDICARD“, admin switch
 * `ratingPrompt` (#/features). iPhone only — there is no Play Store listing yet.
 *
 * Apple: never a custom star picker, never „do you like it? yes → store, no → feedback“, never a reward
 * (Medi Coins or anything else) for a rating. „შეაფასე“ asks for Apple's own in-app sheet; Apple may
 * decide not to show it, so the card then offers the App Store page (the documented link for a review
 * the person starts themselves).
 */

const STATE_KEY = 'medicard.ratingPrompt.v1';
export const APP_STORE_REVIEW_URL = 'https://apps.apple.com/app/id6812517519?action=write-review';

type StoreReviewModule = { isAvailableAsync(): Promise<boolean>; requestReview(): Promise<void> };
let nativeModule: StoreReviewModule | null | undefined;

/** expo-store-review's native side: compiled into store builds from train 1.0.0.22 (and in Expo Go). */
function storeReviewModule(): StoreReviewModule | null {
  if (nativeModule === undefined) {
    try {
      nativeModule = requireOptionalNativeModule<StoreReviewModule>('ExpoStoreReview');
    } catch {
      nativeModule = null;
    }
  }
  return nativeModule ?? null;
}

/**
 * The card and the Profile row exist only on iPhone builds that carry the native sheet, so an OTA
 * that reaches an older train shows nothing new (owner: this ships with the next store build).
 */
export function ratingPromptSupported(): boolean {
  return Platform.OS === 'ios' && storeReviewModule() != null;
}

let chain: Promise<unknown> = Promise.resolve();

/** Read → change → write, one at a time (two good moments in a row must both count). */
function updateState(change: (state: RatingPromptState) => RatingPromptState): Promise<RatingPromptState> {
  const next = chain.then(async () => {
    const state = change(parseRatingState(await getPreference(STATE_KEY).catch(() => null)));
    await setPreference(STATE_KEY, JSON.stringify(state)).catch(() => undefined);
    return state;
  });
  chain = next.catch(() => undefined);
  return next;
}

/**
 * Something went well: a finished MEDIRUN walk, every dose of the day taken, a steps or weight goal
 * reached. The card may follow on the next Home visit. Fire-and-forget; nothing leaves the phone.
 */
export function noteRatingMoment(): void {
  if (Platform.OS !== 'ios') return;
  void updateState((state) => withGoodMoment(state, Date.now())).catch(() => undefined);
}

/**
 * Home asks whether the card may appear now. True = it counts as shown (cooldown starts) and the
 * caller opens it. Never while the admin switch is off or the update card is waiting.
 */
export async function takeRatingPromptTurn(accountCreatedAt: string | null | undefined): Promise<boolean> {
  if (!ratingPromptSupported() || !isFeatureOn('ratingPrompt') || otaCardVisible()) return false;
  let due = false;
  await updateState((state) => {
    const now = Date.now();
    due = ratingPromptDue(state, { now, accountCreatedAt });
    return due ? withShown(state, now) : state;
  }).catch(() => undefined);
  if (due) trackFunnel('rating_prompt_shown');
  return due;
}

/** „შეაფასე“ (never ask again) or „მოგვიანებით“ / closing the card (ask again after the cooldown). */
export function answerRatingPrompt(answer: RatingAnswer): void {
  void updateState((state) => withAnswer(state, answer)).catch(() => undefined);
  trackFunnel('rating_prompt_answered', { choice: answer });
}

/** The App Store's own „write a review“ page. */
export async function openStoreReviewPage(): Promise<void> {
  await Linking.openURL(APP_STORE_REVIEW_URL).catch(() => undefined);
}

/**
 * Apple's in-app rating sheet when this build has it (`native`), otherwise the App Store page (`link`,
 * also on TestFlight, where the sheet never appears). Apple decides whether the sheet really shows.
 */
export async function requestStoreReview(): Promise<'native' | 'link'> {
  const native = Platform.OS === 'ios' ? storeReviewModule() : null;
  if (native && (await native.isAvailableAsync().catch(() => false))) {
    try {
      await native.requestReview();
      return 'native';
    } catch {
      // no foreground scene: fall through to the page
    }
  }
  await openStoreReviewPage();
  return 'link';
}
