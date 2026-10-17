/**
 * Phone verification gate (2026-09-27). The server answers 403 PHONE_VERIFICATION_REQUIRED on
 * the women's space (join / post / comment), reward redemption, influencer codes, bookings and
 * trainer profiles. The app then opens the velvet verification page with the caller's reason
 * instead of showing an error (owner 2026-10-17: no native alert in front of it).
 */
export const PHONE_REQUIRED_CODE = 'PHONE_VERIFICATION_REQUIRED';

export function isPhoneRequiredError(error: unknown): boolean {
  return !!error && typeof error === 'object' && (error as { code?: string }).code === PHONE_REQUIRED_CODE;
}

export function hasVerifiedPhone(user: { phone?: string | null } | null | undefined): boolean {
  return String(user?.phone ?? '').replace(/\D/g, '').length >= 9;
}

type Pushable = { push: (href: never) => void };

/** Only from a press (the person asked for the thing that needs a phone): `/profile/verify-phone` says why and comes back. */
export function offerPhoneVerification(router: Pushable, reason?: string) {
  router.push((reason ? { pathname: '/profile/verify-phone', params: { reason } } : '/profile/verify-phone') as never);
}
