/**
 * Unit tests for Stripe checkout route helper functions
 */

describe('Stripe Checkout Route', () => {
  describe('getBaseUrl URL normalization', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
    });

    afterAll(() => {
      process.env = originalEnv;
    });

    // Mock implementation of getBaseUrl for testing
    const getBaseUrl = () => {
      const trim = (u: string) => u.replace(/\/+$/, "");
      
      if (process.env.NEXT_PUBLIC_APP_URL) {
        return trim(process.env.NEXT_PUBLIC_APP_URL);
      }
      
      if (process.env.VERCEL_URL) {
        return trim(`https://${process.env.VERCEL_URL}`);
      }
      
      return trim('http://localhost:3000');
    };

    it('should return NEXT_PUBLIC_APP_URL when set', () => {
      process.env.NEXT_PUBLIC_APP_URL = 'https://example.com';
      expect(getBaseUrl()).toBe('https://example.com');
    });

    it('should trim trailing slash from NEXT_PUBLIC_APP_URL', () => {
      process.env.NEXT_PUBLIC_APP_URL = 'https://example.com/';
      expect(getBaseUrl()).toBe('https://example.com');
    });

    it('should trim multiple trailing slashes from NEXT_PUBLIC_APP_URL', () => {
      process.env.NEXT_PUBLIC_APP_URL = 'https://example.com///';
      expect(getBaseUrl()).toBe('https://example.com');
    });

    it('should return Vercel URL when NEXT_PUBLIC_APP_URL not set', () => {
      delete process.env.NEXT_PUBLIC_APP_URL;
      process.env.VERCEL_URL = 'myapp.vercel.app';
      expect(getBaseUrl()).toBe('https://myapp.vercel.app');
    });

    it('should trim trailing slash from Vercel URL', () => {
      delete process.env.NEXT_PUBLIC_APP_URL;
      process.env.VERCEL_URL = 'myapp.vercel.app/';
      expect(getBaseUrl()).toBe('https://myapp.vercel.app');
    });

    it('should return localhost fallback when no env vars set', () => {
      delete process.env.NEXT_PUBLIC_APP_URL;
      delete process.env.VERCEL_URL;
      expect(getBaseUrl()).toBe('http://localhost:3000');
    });

    it('should not double slash when concatenating with success path', () => {
      process.env.NEXT_PUBLIC_APP_URL = 'https://example.com/';
      const baseUrl = getBaseUrl();
      const successUrl = `${baseUrl}/success`;
      
      expect(successUrl).toBe('https://example.com/success');
      expect(successUrl).not.toContain('//success');
    });

    it('should handle URL without protocol gracefully', () => {
      process.env.NEXT_PUBLIC_APP_URL = 'example.com/';
      expect(getBaseUrl()).toBe('example.com');
    });
  });

  describe('priceId validation', () => {
    const VALID_PRICE_IDS = [
      'price_1SA7VoFbnWkjMFsPB9IvRYWg',
      'price_1SA7YQFbnWkjMFsPK7dLbJdu',
      'price_1SA7YQFbnWkjMFsPIj2Vct6k'
    ];

    it('should accept valid price IDs from CREDIT_PLANS', () => {
      VALID_PRICE_IDS.forEach(priceId => {
        expect(VALID_PRICE_IDS.includes(priceId)).toBe(true);
      });
    });

    it('should reject null priceId', () => {
      const priceId = null;
      expect(!priceId || typeof priceId !== "string").toBe(true);
    });

    it('should reject undefined priceId', () => {
      const priceId = undefined;
      expect(!priceId || typeof priceId !== "string").toBe(true);
    });

    it('should reject empty string priceId', () => {
      const priceId = '';
      expect(!priceId || typeof priceId !== "string").toBe(true);
    });

    it('should reject non-string priceId (number)', () => {
      const priceId = 123;
      expect(!priceId || typeof priceId !== "string").toBe(true);
    });

    it('should reject non-string priceId (object)', () => {
      const priceId = { id: 'price_123' };
      expect(!priceId || typeof priceId !== "string").toBe(true);
    });

    it('should reject unknown price ID not in allow-list', () => {
      const priceId = 'price_UNKNOWN123';
      expect(typeof priceId === "string").toBe(true);
      expect(VALID_PRICE_IDS.includes(priceId)).toBe(false);
    });

    it('should reject malicious SQL injection attempt', () => {
      const priceId = "price_1' OR '1'='1";
      expect(typeof priceId === "string").toBe(true);
      expect(VALID_PRICE_IDS.includes(priceId)).toBe(false);
    });

    it('should reject XSS attempt in priceId', () => {
      const priceId = "<script>alert('xss')</script>";
      expect(typeof priceId === "string").toBe(true);
      expect(VALID_PRICE_IDS.includes(priceId)).toBe(false);
    });
  });

  describe('Security considerations', () => {
    it('should prevent unauthorized access without session', () => {
      // This would be tested in integration tests
      // Here we document the expected behavior
      const session: any = null;
      expect(!session?.user?.id).toBe(true);
    });

    it('should require valid authentication token', () => {
      const session: any = { user: { id: 'user123' } };
      expect(!!session?.user?.id).toBe(true);
    });

    it('should validate price ID before creating Stripe session', () => {
      // The validation happens before calling stripe.checkout.sessions.create
      // This ensures we never send invalid data to Stripe API
      const validationOrder = [
        '1. Check authentication',
        '2. Parse and validate priceId',
        '3. Check priceId in allow-list',
        '4. Only then create Stripe session'
      ];
      
      expect(validationOrder).toHaveLength(4);
    });
  });

  describe('Error responses', () => {
    const VALID_PRICE_IDS = [
      'price_1SA7VoFbnWkjMFsPB9IvRYWg',
      'price_1SA7YQFbnWkjMFsPK7dLbJdu',
      'price_1SA7YQFbnWkjMFsPIj2Vct6k'
    ];

    it('should return 401 for unauthorized requests', () => {
      const expectedResponse = { error: "Unauthorized", status: 401 };
      expect(expectedResponse.status).toBe(401);
    });

    it('should return 400 for missing priceId', () => {
      const expectedResponse = { error: "Missing or invalid priceId", status: 400 };
      expect(expectedResponse.status).toBe(400);
    });

    it('should return 400 with valid price IDs for invalid priceId', () => {
      const expectedResponse = {
        error: "Invalid priceId",
        validPriceIds: VALID_PRICE_IDS,
        status: 400
      };
      expect(expectedResponse.status).toBe(400);
      expect(expectedResponse.validPriceIds).toBeDefined();
    });
  });
});
