/** Stored as '1' / '0'. Missing means "legacy — follow OS permission". */
export function resolvePushOptedIn(stored: string | null, permissionGranted: boolean): boolean {
  if (stored === '0') return false;
  if (stored === '1') return true;
  return permissionGranted;
}

export function resolvePushToggleOn(permissionGranted: boolean, optedIn: boolean): boolean {
  return permissionGranted && optedIn;
}

/** ნებართვები toggle: honor an explicit in-app on even when a later GET lies. */
export function resolvePermissionsPageToggle(stored: string | null, rememberedOsGrant: boolean): boolean {
  if (stored === '1') return true;
  if (stored === '0') return false;
  return rememberedOsGrant === true;
}
