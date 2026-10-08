/** Device privacy is independent of the server's cycle-profile privacy. Unknown/read failure denies. */
export async function mediCycleAccess(read: (key: string) => Promise<string | null>, engageKey: string | null, excluded = false): Promise<boolean> {
  if (excluded || !engageKey) return false;
  try {
    const [lock, mask, engage] = await Promise.all([read('medicard.cycle.privacy.lock'), read('medicard.cycle.notifications.masked'), read(engageKey)]);
    return lock !== '1' && mask !== '1' && !(engage && JSON.parse(engage)?.discreet);
  } catch { return false; }
}
