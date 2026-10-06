/**
 * Meta install measurement (owner 2026-10-06, train 1.0.0.22 — store build).
 *
 * The Facebook SDK (react-native-fbsdk-next, Meta app „MEDICARD“ 1618408603019139) is here only so Meta
 * can count that someone who saw an App promotion ad installed and opened the app (Aggregated Event
 * Measurement + SKAdNetwork). It logs Meta's automatic app events (install / app open) and nothing else:
 * no IDFA (advertiserIDCollectionEnabled false, no ATT prompt), no custom events, no health data, no
 * user id. It starts only after the person accepted the privacy policy; binaries without the native
 * module (train 21 and older) do nothing.
 */
import { NativeModules, Platform } from 'react-native';

let started = false;

type FbSettingsModule = { initializeSDK?: () => void };

export function adMeasurementAllowed(extraAnswers: unknown, os: string = Platform.OS): boolean {
  if (os !== 'ios') return false;
  const extra = (extraAnswers ?? {}) as Record<string, unknown>;
  return extra.privacyAccepted === true;
}

/** Idempotent. Returns true when the SDK was started by this call. */
export function startAdMeasurement(extraAnswers: unknown): boolean {
  if (started || !adMeasurementAllowed(extraAnswers)) return false;
  const settings = NativeModules.FBSettings as FbSettingsModule | undefined;
  if (typeof settings?.initializeSDK !== 'function') return false;
  try {
    settings.initializeSDK();
    started = true;
    return true;
  } catch {
    return false;
  }
}
