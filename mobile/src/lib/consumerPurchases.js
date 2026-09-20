/** Self-serve IAP is off until /api/app/status says otherwise. Missing field = off. */
export function consumerPurchasesEnabledFromStatus(status) {
  return !FREE_CONSUMER_RELEASE && status?.settings?.consumerPurchasesEnabled === true;
}
import { FREE_CONSUMER_RELEASE } from './consumerAccess.js';
