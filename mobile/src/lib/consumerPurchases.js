/** Self-serve IAP is off until /api/app/status says otherwise. Missing field = off. */
export function consumerPurchasesEnabledFromStatus(status) {
  return status?.settings?.consumerPurchasesEnabled === true;
}
