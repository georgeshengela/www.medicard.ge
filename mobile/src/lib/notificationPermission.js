/**
 * Expo `granted` is false for iOS provisional, and some iOS 26 responses
 * only populate `ios.status`. Treat authorized / provisional / ephemeral as on.
 *
 * UNAuthorizationStatus: 0 notDetermined, 1 denied, 2 authorized, 3 provisional, 4 ephemeral.
 */
const IOS_ALLOWED = new Set([2, 3, 4, 'authorized', 'provisional', 'ephemeral']);
const IOS_DENIED = new Set([1, 'denied']);
const GRANTED_STATUS = new Set(['granted', 'authorized', 'provisional', 'ephemeral', 2, 3, 4]);

function normalizeStatus(value) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return value.trim().toLowerCase();
  return null;
}

export function notificationResponseIsGranted(response) {
  if (!response || typeof response !== 'object') return false;
  if (response.granted === true) return true;
  const status = normalizeStatus(response.status);
  if (status != null && GRANTED_STATUS.has(status)) return true;
  const iosStatus = normalizeStatus(response.ios?.status ?? response.ios?.authorizationStatus);
  if (iosStatus != null && IOS_ALLOWED.has(iosStatus)) return true;
  if (
    response.ios?.allowsAlert === true ||
    response.ios?.allowsSound === true ||
    response.ios?.allowsBadge === true
  ) {
    return true;
  }
  return false;
}

export function notificationResponseStatus(response) {
  if (notificationResponseIsGranted(response)) return 'granted';
  const status = normalizeStatus(response?.status);
  const iosStatus = normalizeStatus(response?.ios?.status);
  if (status === 'denied' || (iosStatus != null && IOS_DENIED.has(iosStatus))) {
    return 'denied';
  }
  return 'undetermined';
}
