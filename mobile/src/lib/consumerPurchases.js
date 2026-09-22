/** There are no paid unlocks, even when an older server returns a billing flag. */
export function consumerPurchasesEnabledFromStatus(_status) { return false; }
