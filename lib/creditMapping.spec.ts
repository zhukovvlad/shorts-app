import { getCreditsForPriceId, getCreditMap, CREDIT_PLANS, CreditPlan } from './creditMapping';

describe('creditMapping', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset env before each test
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    // Restore original env
    process.env = originalEnv;
  });

  describe('getCreditsForPriceId', () => {
    it('should return correct credits for valid price IDs', () => {
      expect(getCreditsForPriceId('price_1SA7VoFbnWkjMFsPB9IvRYWg')).toBe(2);
      expect(getCreditsForPriceId('price_1SA7YQFbnWkjMFsPK7dLbJdu')).toBe(50);
      expect(getCreditsForPriceId('price_1SA7YQFbnWkjMFsPIj2Vct6k')).toBe(100);
    });

    it('should return 0 for null or undefined price ID', () => {
      expect(getCreditsForPriceId(null)).toBe(0);
      expect(getCreditsForPriceId(undefined)).toBe(0);
    });

    it('should return 0 for unknown price ID', () => {
      expect(getCreditsForPriceId('price_unknown')).toBe(0);
      expect(getCreditsForPriceId('')).toBe(0);
    });

    it('should use environment variable override when set', () => {
      process.env.CREDITS_STARTER = '10';
      process.env.CREDITS_PRO = '200';
      
      expect(getCreditsForPriceId('price_1SA7VoFbnWkjMFsPB9IvRYWg')).toBe(10);
      expect(getCreditsForPriceId('price_1SA7YQFbnWkjMFsPK7dLbJdu')).toBe(200);
      // Unchanged
      expect(getCreditsForPriceId('price_1SA7YQFbnWkjMFsPIj2Vct6k')).toBe(100);
    });

    it('should use ENTERPRISE override when set', () => {
      process.env.CREDITS_ENTERPRISE = '250';
      
      expect(getCreditsForPriceId('price_1SA7YQFbnWkjMFsPIj2Vct6k')).toBe(250);
      // Unchanged (no override)
      expect(getCreditsForPriceId('price_1SA7VoFbnWkjMFsPB9IvRYWg')).toBe(2);
      expect(getCreditsForPriceId('price_1SA7YQFbnWkjMFsPK7dLbJdu')).toBe(50);
    });

    it('should trim whitespace from environment variable values', () => {
      process.env.CREDITS_STARTER = '  7  ';
      process.env.CREDITS_PRO = '  75  ';
      process.env.CREDITS_ENTERPRISE = '  150  ';
      
      expect(getCreditsForPriceId('price_1SA7VoFbnWkjMFsPB9IvRYWg')).toBe(7);
      expect(getCreditsForPriceId('price_1SA7YQFbnWkjMFsPK7dLbJdu')).toBe(75);
      expect(getCreditsForPriceId('price_1SA7YQFbnWkjMFsPIj2Vct6k')).toBe(150);
    });

    it('should handle whitespace-only values as invalid', () => {
      process.env.CREDITS_STARTER = '   ';
      process.env.CREDITS_PRO = '\t\t';
      
      // Should fallback to defaults
      expect(getCreditsForPriceId('price_1SA7VoFbnWkjMFsPB9IvRYWg')).toBe(2);
      expect(getCreditsForPriceId('price_1SA7YQFbnWkjMFsPK7dLbJdu')).toBe(50);
    });

    it('should fallback to default if env var is invalid', () => {
      process.env.CREDITS_STARTER = 'invalid';
      process.env.CREDITS_PRO = '-5';
      process.env.CREDITS_ENTERPRISE = '0';
      
      expect(getCreditsForPriceId('price_1SA7VoFbnWkjMFsPB9IvRYWg')).toBe(2);
      expect(getCreditsForPriceId('price_1SA7YQFbnWkjMFsPK7dLbJdu')).toBe(50);
      expect(getCreditsForPriceId('price_1SA7YQFbnWkjMFsPIj2Vct6k')).toBe(100);
    });

    it('should reject zero and negative values to prevent misconfiguration', () => {
      // Setting credits to "0" would disable the plan, which could be a mistake
      // To intentionally disable a plan, remove it from CREDIT_PLANS instead
      process.env.CREDITS_STARTER = '0';
      process.env.CREDITS_PRO = '-10';
      process.env.CREDITS_ENTERPRISE = '-1';
      
      // All fall back to defaults (prevents accidental disabling)
      expect(getCreditsForPriceId('price_1SA7VoFbnWkjMFsPB9IvRYWg')).toBe(2);
      expect(getCreditsForPriceId('price_1SA7YQFbnWkjMFsPK7dLbJdu')).toBe(50);
      expect(getCreditsForPriceId('price_1SA7YQFbnWkjMFsPIj2Vct6k')).toBe(100);
    });
  });

  describe('getCreditMap', () => {
    it('should return a map of all price IDs to credits', () => {
      const map = getCreditMap();
      
      expect(map).toHaveProperty('price_1SA7VoFbnWkjMFsPB9IvRYWg');
      expect(map).toHaveProperty('price_1SA7YQFbnWkjMFsPK7dLbJdu');
      expect(map).toHaveProperty('price_1SA7YQFbnWkjMFsPIj2Vct6k');
      
      expect(map['price_1SA7VoFbnWkjMFsPB9IvRYWg']).toBe(2);
      expect(map['price_1SA7YQFbnWkjMFsPK7dLbJdu']).toBe(50);
      expect(map['price_1SA7YQFbnWkjMFsPIj2Vct6k']).toBe(100);
    });

    it('should include environment overrides in map', () => {
      process.env.CREDITS_STARTER = '5';
      
      const map = getCreditMap();
      
      expect(map['price_1SA7VoFbnWkjMFsPB9IvRYWg']).toBe(5);
      expect(map['price_1SA7YQFbnWkjMFsPK7dLbJdu']).toBe(50);
    });
  });

  describe('CREDIT_PLANS', () => {
    it('should contain all expected plans', () => {
      expect(CREDIT_PLANS).toHaveLength(3);
      
      const starterPlan = CREDIT_PLANS.find((p: CreditPlan) => p.envVar === 'CREDITS_STARTER');
      expect(starterPlan).toBeDefined();
      expect(starterPlan?.defaultCredits).toBe(2);
      expect(starterPlan?.priceId).toBe('price_1SA7VoFbnWkjMFsPB9IvRYWg');
      
      const proPlan = CREDIT_PLANS.find((p: CreditPlan) => p.envVar === 'CREDITS_PRO');
      expect(proPlan).toBeDefined();
      expect(proPlan?.defaultCredits).toBe(50);
      
      const enterprisePlan = CREDIT_PLANS.find((p: CreditPlan) => p.envVar === 'CREDITS_ENTERPRISE');
      expect(enterprisePlan).toBeDefined();
      expect(enterprisePlan?.defaultCredits).toBe(100);
    });
  });
});
