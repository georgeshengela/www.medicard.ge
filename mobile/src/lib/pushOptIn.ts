/** Stored as '1' / '0'. Missing means "legacy — follow OS permission". */
export function resolvePushOptedIn(stored: string | null, permissionGranted: boolean): boolean {
  if (stored === '0') return false;
  if (stored === '1') return true;
  return permissionGranted;
}

export function resolvePushToggleOn(permissionGranted: boolean, optedIn: boolean): boolean {
  return permissionGranted && optedIn;
}
