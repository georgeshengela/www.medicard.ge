import { Alert } from 'react-native';
import { ka } from '@/i18n/ka';

/**
 * Phone verification gate (2026-09-27). The server answers 403 PHONE_VERIFICATION_REQUIRED on
 * the women's space (join / post / comment) and reward redemption. The app then offers the
 * one-screen verification instead of showing an error.
 */
export const PHONE_REQUIRED_CODE = 'PHONE_VERIFICATION_REQUIRED';

export function isPhoneRequiredError(error: unknown): boolean {
  return !!error && typeof error === 'object' && (error as { code?: string }).code === PHONE_REQUIRED_CODE;
}

export function hasVerifiedPhone(user: { phone?: string | null } | null | undefined): boolean {
  return String(user?.phone ?? '').replace(/\D/g, '').length >= 9;
}

type Pushable = { push: (href: never) => void };

export function offerPhoneVerification(router: Pushable, reason?: string) {
  Alert.alert(ka.phoneVerify.gateTitle, reason ?? ka.phoneVerify.gateBody, [
    { text: ka.common.cancel, style: 'cancel' },
    { text: ka.phoneVerify.gateCta, onPress: () => router.push('/profile/verify-phone' as never) },
  ]);
}
