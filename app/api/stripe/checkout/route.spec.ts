/**
 * Integration tests for Stripe checkout route
 * Tests the real POST handler with mocked external dependencies
 */

import { POST, getBaseUrl } from './route';
import { CREDIT_PLANS } from '@/lib/creditMapping';

// Mock auth
jest.mock('@/auth', () => ({
  auth: jest.fn(),
}));

// Mock Stripe with a getter for the mock function
let mockStripeCreate: jest.Mock = jest.fn();

jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    checkout: {
      sessions: {
        get create() {
          return mockStripeCreate;
        },
      },
    },
  }));
});

import { auth } from '@/auth';

const ORIGINAL_ENV = process.env;

describe('Stripe Checkout Route', () => {
  let mockAuth: jest.MockedFunction<typeof auth>;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV };
    
    mockAuth = auth as jest.MockedFunction<typeof auth>;
    
    // Reset mocks
    jest.clearAllMocks();
    mockStripeCreate.mockReset();
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  describe('getBaseUrl URL normalization', () => {
    it('should return NEXT_PUBLIC_APP_URL when set', () => {
      const env = { NEXT_PUBLIC_APP_URL: 'https://example.com' };
      expect(getBaseUrl(env as any)).toBe('https://example.com');
    });

    it('should trim trailing slash from NEXT_PUBLIC_APP_URL', () => {
      const env = { NEXT_PUBLIC_APP_URL: 'https://example.com/' };
      expect(getBaseUrl(env as any)).toBe('https://example.com');
    });

    it('should trim multiple trailing slashes from NEXT_PUBLIC_APP_URL', () => {
      const env = { NEXT_PUBLIC_APP_URL: 'https://example.com///' };
      expect(getBaseUrl(env as any)).toBe('https://example.com');
    });

    it('should trim whitespace from NEXT_PUBLIC_APP_URL', () => {
      const env = { NEXT_PUBLIC_APP_URL: '  https://example.com  ' };
      expect(getBaseUrl(env as any)).toBe('https://example.com');
    });

    it('should trim whitespace and trailing slashes', () => {
      const env = { NEXT_PUBLIC_APP_URL: '  https://example.com///  ' };
      expect(getBaseUrl(env as any)).toBe('https://example.com');
    });

    it('should return Vercel URL when NEXT_PUBLIC_APP_URL not set', () => {
      const env = { VERCEL_URL: 'myapp.vercel.app' };
      expect(getBaseUrl(env as any)).toBe('https://myapp.vercel.app');
    });

    it('should trim trailing slash from Vercel URL', () => {
      const env = { VERCEL_URL: 'myapp.vercel.app/' };
      expect(getBaseUrl(env as any)).toBe('https://myapp.vercel.app');
    });

    it('should trim whitespace from Vercel URL', () => {
      const env = { VERCEL_URL: '  myapp.vercel.app  ' };
      expect(getBaseUrl(env as any)).toBe('https://myapp.vercel.app');
    });

    it('should return localhost fallback when no env vars set', () => {
      const env = {};
      expect(getBaseUrl(env as any)).toBe('http://localhost:3000');
    });

    it('should not double slash when concatenating with success path', () => {
      const env = { NEXT_PUBLIC_APP_URL: 'https://example.com/' };
      const baseUrl = getBaseUrl(env as any);
      const successUrl = `${baseUrl}/success`;
      
      expect(successUrl).toBe('https://example.com/success');
      expect(successUrl).not.toContain('//success');
    });

    it('should add protocol to URL without one in production', () => {
      const env = { 
        NODE_ENV: 'production',
        NEXT_PUBLIC_APP_URL: 'example.com'
      };
      expect(getBaseUrl(env as any)).toBe('https://example.com');
    });

    it('should add http protocol to URL without one in development', () => {
      const env = { 
        NODE_ENV: 'development',
        NEXT_PUBLIC_APP_URL: 'example.com'
      };
      expect(getBaseUrl(env as any)).toBe('http://example.com');
    });

    it('should add https when VERCEL_URL is set (implies production)', () => {
      const env = { 
        VERCEL_URL: 'myapp.vercel.app',
        NEXT_PUBLIC_APP_URL: 'example.com'
      };
      expect(getBaseUrl(env as any)).toBe('https://example.com');
    });

    it('should preserve existing protocol', () => {
      const env = { NEXT_PUBLIC_APP_URL: 'https://example.com' };
      expect(getBaseUrl(env as any)).toBe('https://example.com');
    });

    it('should throw error for invalid URL', () => {
      const env = { NEXT_PUBLIC_APP_URL: 'not a valid url !!!' };
      expect(() => getBaseUrl(env as any)).toThrow('Invalid base URL configuration');
    });

    it('should throw error for invalid protocol', () => {
      const env = { NEXT_PUBLIC_APP_URL: 'ftp://example.com' };
      expect(() => getBaseUrl(env as any)).toThrow('Invalid protocol');
      expect(() => getBaseUrl(env as any)).toThrow('ftp');
    });

    it('should throw clear error message for malformed URL', () => {
      const env = { NEXT_PUBLIC_APP_URL: 'https://bad url with spaces' };
      expect(() => getBaseUrl(env as any)).toThrow('Invalid base URL configuration');
      expect(() => getBaseUrl(env as any)).toThrow('Please set NEXT_PUBLIC_APP_URL to a valid absolute URL');
    });
  });

  describe('POST handler - Authentication', () => {
    it('should return 401 when user is not authenticated', async () => {
      mockAuth.mockResolvedValue(null);

      const request = new Request('http://localhost:3000/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId: CREDIT_PLANS[0].priceId }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
      expect(mockStripeCreate).not.toHaveBeenCalled();
    });

    it('should return 401 when session has no user', async () => {
      mockAuth.mockResolvedValue({ user: null } as any);

      const request = new Request('http://localhost:3000/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId: CREDIT_PLANS[0].priceId }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 401 when user has no id', async () => {
      mockAuth.mockResolvedValue({ user: { id: null } } as any);

      const request = new Request('http://localhost:3000/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId: CREDIT_PLANS[0].priceId }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });
  });

  describe('POST handler - PriceId Validation', () => {
    beforeEach(() => {
      mockAuth.mockResolvedValue({ user: { id: 'user123' } } as any);
    });

    it('should return 400 for invalid JSON body', async () => {
      const request = new Request('http://localhost:3000/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid-json{not valid',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid JSON body');
      expect(mockStripeCreate).not.toHaveBeenCalled();
    });

    it('should return 400 for missing priceId', async () => {
      const request = new Request('http://localhost:3000/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Missing or invalid priceId');
      expect(mockStripeCreate).not.toHaveBeenCalled();
    });

    it('should return 400 for null priceId', async () => {
      const request = new Request('http://localhost:3000/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId: null }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Missing or invalid priceId');
    });

    it('should return 400 for non-string priceId', async () => {
      const request = new Request('http://localhost:3000/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId: 123 }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Missing or invalid priceId');
    });

    it('should return 400 for unknown priceId not in allow-list', async () => {
      const request = new Request('http://localhost:3000/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId: 'price_UNKNOWN123' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid priceId');
      // validPriceIds should be returned in non-production (default test env)
      expect(data.validPriceIds).toEqual(CREDIT_PLANS.map(p => p.priceId));
      expect(mockStripeCreate).not.toHaveBeenCalled();
    });

    it('should not expose validPriceIds in production', async () => {
      process.env = { ...process.env, NODE_ENV: 'production' };

      const request = new Request('http://localhost:3000/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId: 'price_UNKNOWN123' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid priceId');
      // validPriceIds should NOT be exposed in production
      expect(data.validPriceIds).toBeUndefined();
      expect(mockStripeCreate).not.toHaveBeenCalled();
    });

    it('should reject SQL injection attempt', async () => {
      const request = new Request('http://localhost:3000/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId: "price_1' OR '1'='1" }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid priceId');
      expect(mockStripeCreate).not.toHaveBeenCalled();
    });

    it('should reject XSS attempt', async () => {
      const request = new Request('http://localhost:3000/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId: "<script>alert('xss')</script>" }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid priceId');
      expect(mockStripeCreate).not.toHaveBeenCalled();
    });
  });

  describe('POST handler - Successful Checkout', () => {
    beforeEach(() => {
      mockAuth.mockResolvedValue({ user: { id: 'user123' } } as any);
      mockStripeCreate.mockResolvedValue({
        url: 'https://checkout.stripe.com/session_123',
      });
    });

    it('should create Stripe session with valid priceId', async () => {
      const validPriceId = CREDIT_PLANS[0].priceId;
      
      const request = new Request('http://localhost:3000/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId: validPriceId }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.url).toBe('https://checkout.stripe.com/session_123');
      expect(mockStripeCreate).toHaveBeenCalledTimes(1);
    });

    it('should pass correct parameters to Stripe', async () => {
      process.env.NEXT_PUBLIC_APP_URL = 'https://myapp.com';
      const validPriceId = CREDIT_PLANS[1].priceId;
      
      const request = new Request('http://localhost:3000/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId: validPriceId }),
      });

      await POST(request);

      expect(mockStripeCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          payment_method_types: ['card'],
          line_items: expect.arrayContaining([
            expect.objectContaining({
              price: validPriceId,
              quantity: 1,
            }),
          ]),
          mode: 'payment',
          success_url: expect.stringContaining('https://myapp.com/success'),
          cancel_url: expect.stringContaining('https://myapp.com/cancel'),
          metadata: expect.objectContaining({
            userId: 'user123',
            priceId: validPriceId,
          }),
        })
      );
    });

    it('should work with all valid price IDs from CREDIT_PLANS', async () => {
      for (const plan of CREDIT_PLANS) {
        mockStripeCreate.mockClear();
        mockStripeCreate.mockResolvedValue({
          url: `https://checkout.stripe.com/session_${plan.priceId}`,
        });

        const request = new Request('http://localhost:3000/api/stripe/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ priceId: plan.priceId }),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.url).toContain('checkout.stripe.com');
        expect(mockStripeCreate).toHaveBeenCalledTimes(1);
      }
    });

    it('should not have double slashes in success URL', async () => {
      process.env.NEXT_PUBLIC_APP_URL = 'https://myapp.com/';
      const validPriceId = CREDIT_PLANS[0].priceId;
      
      const request = new Request('http://localhost:3000/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId: validPriceId }),
      });

      await POST(request);

      const callArgs = mockStripeCreate.mock.calls[0][0];
      expect(callArgs.success_url).not.toContain('//success');
      expect(callArgs.cancel_url).not.toContain('//cancel');
    });
  });

  describe('POST handler - Error Handling', () => {
    beforeEach(() => {
      mockAuth.mockResolvedValue({ user: { id: 'user123' } } as any);
    });

    it('should handle Stripe API errors gracefully', async () => {
      mockStripeCreate.mockRejectedValue(new Error('Stripe API error'));

      const request = new Request('http://localhost:3000/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId: CREDIT_PLANS[0].priceId }),
      });

      await expect(POST(request)).rejects.toThrow('Stripe API error');
    });
  });
});

