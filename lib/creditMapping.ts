/**
 * Shared credit mapping configuration for Stripe price IDs.
 * 
 * This ensures consistency between webhook handler and manual credit addition.
 * Credit amounts can be overridden via environment variables.
 */

export interface CreditPlan {
  priceId: string;
  defaultCredits: number;
  envVar: string;
}

export const CREDIT_PLANS: CreditPlan[] = [
  {
    priceId: 'price_1SA7VoFbnWkjMFsPB9IvRYWg',
    defaultCredits: 2,
    envVar: 'CREDITS_STARTER'
  },
  {
    priceId: 'price_1SA7YQFbnWkjMFsPK7dLbJdu',
    defaultCredits: 50,
    envVar: 'CREDITS_PRO'
  },
  {
    priceId: 'price_1SA7YQFbnWkjMFsPIj2Vct6k',
    defaultCredits: 100,
    envVar: 'CREDITS_ENTERPRISE'
  }
];

/**
 * Get credit amount for a given Stripe price ID.
 * 
 * @param priceId - Stripe price ID
 * @returns Number of credits, or 0 if price ID is not recognized
 */
export function getCreditsForPriceId(priceId: string | null | undefined): number {
  if (!priceId) return 0;

  const plan = CREDIT_PLANS.find(p => p.priceId === priceId);
  if (!plan) return 0;

  // Allow environment variable override
  const envValue = process.env[plan.envVar];
  if (envValue) {
    const parsed = parseInt(envValue, 10);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return plan.defaultCredits;
}

/**
 * Get the credit map for all plans.
 * Useful for validation or display purposes.
 * 
 * @returns Record mapping price IDs to credit amounts
 */
export function getCreditMap(): Record<string, number> {
  return CREDIT_PLANS.reduce((map, plan) => {
    map[plan.priceId] = getCreditsForPriceId(plan.priceId);
    return map;
  }, {} as Record<string, number>);
}
