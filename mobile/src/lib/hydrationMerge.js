/** Home / Expo display: local taps plus the stored daily total from the other device. */
export function mergeDayHydrationMl(localMl, serverMl) {
  const local = Math.max(0, Math.round(Number(localMl) || 0));
  if (serverMl == null || !Number.isFinite(Number(serverMl))) return local;
  return Math.max(local, Math.max(0, Math.round(Number(serverMl))));
}
