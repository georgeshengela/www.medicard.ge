/**
 * Self-serve store billing is not implemented. Default OFF so clients never
 * treat an in-app tap as a purchase. Admin grants keep working.
 * Set CONSUMER_PURCHASES_ENABLED=true only after a real IAP integration ships.
 */
import { FREE_CONSUMER_RELEASE } from './consumerAccess.js';
export function consumerPurchasesEnabled(env = process.env) {
  if (FREE_CONSUMER_RELEASE) return false;
  const raw = String(env.CONSUMER_PURCHASES_ENABLED ?? '')
    .trim()
    .toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes';
}
