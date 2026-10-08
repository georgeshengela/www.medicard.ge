/**
 * Native Sign in with Apple (iOS) and Google (iOS + Android), 2026-10-01 / train 1.0.0.18.
 *
 * These functions only talk to the OS / Google sheet and return what the server needs; the
 * server verifies every token (src/lib/socialAuth.js). A cancelled sheet is `null`, never an error.
 * Both native modules exist only in binaries from train 1.0.0.18 on, so they are required lazily:
 * web, Expo Go and older binaries simply report "not available" and the buttons stay hidden.
 */
import { requireOptionalNativeModule } from 'expo';
import { Platform, TurboModuleRegistry } from 'react-native';
import { tx } from '@/i18n/locale';
import googleOAuth from '../../google-oauth.json';

export type AppleCredential = {
  identityToken: string;
  authorizationCode?: string;
  nonce: string;
  fullName?: string;
};

export class SocialSignInError extends Error {
  constructor(message: string, readonly reason: string) {
    super(message);
    this.name = 'SocialSignInError';
  }
}

type AppleModule = typeof import('expo-apple-authentication');
type GoogleModule = typeof import('@react-native-google-signin/google-signin');

function loadApple(): AppleModule | null {
  if (Platform.OS !== 'ios') return null;
  // Ask before requiring: a require() that throws outside module init goes through Metro's
  // guardedLoadModule, which reports it as fatal (red screen in Expo Go) even though we catch it.
  if (!requireOptionalNativeModule('ExpoAppleAuthentication')) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-apple-authentication') as AppleModule;
  } catch {
    return null;
  }
}

function loadGoogle(): GoogleModule | null {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return null;
  if (!TurboModuleRegistry.get('RNGoogleSignin')) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('@react-native-google-signin/google-signin') as GoogleModule;
  } catch {
    return null;
  }
}

const WEB_CLIENT_ID = String(googleOAuth.webClientId || '').trim();
const IOS_CLIENT_ID = String(googleOAuth.iosClientId || '').trim();

/** Google needs the web client id everywhere (it is the token audience) and the iOS id on iPhone. */
export function googleConfigured(): boolean {
  if (!WEB_CLIENT_ID) return false;
  if (Platform.OS === 'ios') return Boolean(IOS_CLIENT_ID);
  return Platform.OS === 'android';
}

export async function appleSignInAvailable(): Promise<boolean> {
  const apple = loadApple();
  if (!apple) return false;
  try {
    return await apple.isAvailableAsync();
  } catch {
    return false;
  }
}

export function googleSignInAvailable(): boolean {
  return googleConfigured() && loadGoogle() !== null;
}

function formatAppleName(name: { givenName?: string | null; familyName?: string | null } | null | undefined): string | undefined {
  const full = [name?.givenName, name?.familyName].filter((part) => part && part.trim()).join(' ').trim();
  return full.length >= 2 ? full : undefined;
}

/** Shows the Apple sheet. `nonce` comes from the server and is bound into the identity token. */
export async function requestAppleCredential(nonce: string): Promise<AppleCredential | null> {
  const apple = loadApple();
  if (!apple) throw new SocialSignInError(tx('Apple-ით შესვლა ამ მოწყობილობაზე მიუწვდომელია.', 'Sign in with Apple is not available on this device.'), 'unavailable');
  try {
    const credential = await apple.signInAsync({
      requestedScopes: [apple.AppleAuthenticationScope.FULL_NAME, apple.AppleAuthenticationScope.EMAIL],
      nonce,
    });
    if (!credential.identityToken) {
      throw new SocialSignInError(tx('Apple-მა შესვლა ვერ დაადასტურა. სცადე თავიდან.', 'Apple could not confirm the sign-in. Please try again.'), 'no-token');
    }
    return {
      identityToken: credential.identityToken,
      authorizationCode: credential.authorizationCode ?? undefined,
      nonce,
      fullName: formatAppleName(credential.fullName),
    };
  } catch (error) {
    if (error instanceof SocialSignInError) throw error;
    const code = (error as { code?: string })?.code;
    if (code === 'ERR_REQUEST_CANCELED') return null;
    throw new SocialSignInError(tx('Apple-ით შესვლა ვერ მოხერხდა. სცადე თავიდან.', 'Sign in with Apple failed. Please try again.'), code || 'apple-failed');
  }
}

let googleReady = false;

function configureGoogle(google: GoogleModule) {
  if (googleReady) return;
  google.GoogleSignin.configure({
    webClientId: WEB_CLIENT_ID,
    ...(Platform.OS === 'ios' ? { iosClientId: IOS_CLIENT_ID } : {}),
    offlineAccess: false,
    scopes: ['profile', 'email'],
  });
  googleReady = true;
}

/** Shows Google's account picker and returns its ID token. */
export async function requestGoogleIdToken(): Promise<string | null> {
  const google = googleConfigured() ? loadGoogle() : null;
  if (!google) throw new SocialSignInError(tx('Google-ით შესვლა ამ მოწყობილობაზე მიუწვდომელია.', 'Sign in with Google is not available on this device.'), 'unavailable');
  configureGoogle(google);
  const { GoogleSignin, statusCodes } = google;
  try {
    if (Platform.OS === 'android') await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    // Always show the account picker: a remembered Google session would silently reuse the last account.
    if (GoogleSignin.hasPreviousSignIn()) await GoogleSignin.signOut().catch(() => null);
    const response = await GoogleSignin.signIn();
    if (response.type !== 'success') return null;
    const idToken = response.data.idToken;
    // We never call Google APIs: drop the local Google session right away.
    void GoogleSignin.signOut().catch(() => null);
    if (!idToken) {
      throw new SocialSignInError(tx('Google-მა შესვლა ვერ დაადასტურა. სცადე თავიდან.', 'Google could not confirm the sign-in. Please try again.'), 'no-token');
    }
    return idToken;
  } catch (error) {
    if (error instanceof SocialSignInError) throw error;
    const code = String((error as { code?: string | number })?.code ?? '');
    if (code === statusCodes.SIGN_IN_CANCELLED) return null;
    if (code === statusCodes.IN_PROGRESS) {
      throw new SocialSignInError(tx('Google-ით შესვლა უკვე მიმდინარეობს.', 'Google sign-in is already in progress.'), 'in-progress');
    }
    if (code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      throw new SocialSignInError(
        tx('Google Play სერვისები განახლებას საჭიროებს. განაახლე და სცადე თავიდან.', 'Google Play services need an update. Update them and try again.'),
        'play-services',
      );
    }
    // DEVELOPER_ERROR (10) = SHA-1 / client id mismatch: a configuration problem, not the person's.
    console.warn('[social] google sign-in failed', code || (error as Error)?.message);
    throw new SocialSignInError(tx('Google-ით შესვლა ვერ მოხერხდა. სცადე თავიდან ან შედი ელ-ფოსტით.', 'Google sign-in failed. Try again or sign in with email.'), code || 'google-failed');
  }
}
