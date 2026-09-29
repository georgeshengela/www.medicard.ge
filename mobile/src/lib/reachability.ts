/**
 * Is medicard.ge reachable? Shared by the offline chip and every API call.
 *
 * Any HTTP answer (200, 401, 503…) proves the server is reachable and clears the
 * chip at once. Only transport failures (no response at all) count toward
 * "offline", and it takes two in a row. The old chip listened to the /health
 * ping alone, so it could stay „ოფლაინ" while Medi was answering.
 */
let offline = false;
let fails = 0;
const listeners = new Set<() => void>();

function set(next: boolean) {
  if (offline === next) return;
  offline = next;
  listeners.forEach((listener) => listener());
}

/** The server answered with any HTTP status. */
export function markReachable() {
  fails = 0;
  lastAnswerAt = Date.now();
  set(false);
}

let lastAnswerAt = 0;
/** When the server last answered anything (0 = never this session). */
export function lastServerAnswerAt() {
  return lastAnswerAt;
}

/** A request got no response (DNS, socket, timeout). */
export function markUnreachable() {
  fails += 1;
  if (fails >= 2) set(true);
}

export function isOffline() {
  return offline;
}

export function subscribeReachability(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
