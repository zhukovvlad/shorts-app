import { POST } from './route';
import { prisma } from '@/app/lib/db';
import { NextRequest } from 'next/server';
import Stripe from 'stripe';
import { CreditTransactionType, Prisma } from '@prisma/client';

// Mock database with proper structure
const mockFindUnique = jest.fn();
const mockTransaction = jest.fn();

jest.mock('@/app/lib/db', () => ({
    prisma: {
        get $transaction() {
            return mockTransaction;
        },
        creditTransaction: {
            get findUnique() {
                return mockFindUnique;
            },
        },
    },
}));

// Mock Stripe with getter for constructEvent
let mockConstructEvent: jest.Mock = jest.fn();

jest.mock('stripe', () => {
    return jest.fn().mockImplementation(() => ({
        webhooks: {
            get constructEvent() {
                return mockConstructEvent;
            },
        },
    }));
});

// Mock environment
const mockEnv = {
    STRIPE_WEBHOOK_SECRET: 'whsec_test_secret',
};

describe('Stripe Webhook Route', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockConstructEvent.mockReset();
        mockFindUnique.mockReset();
        mockTransaction.mockReset();
    });

    describe('checkout.session.completed event', () => {
        const createMockRequest = (body: string, signature = 'valid_signature'): NextRequest => {
            const headers = new Headers();
            headers.set('stripe-signature', signature);

            return new NextRequest('http://localhost:3000/api/stripe/webhook', {
                method: 'POST',
                headers,
                body,
            });
        };

        const mockSession: Partial<Stripe.Checkout.Session> = {
            id: 'cs_test_123',
            object: 'checkout.session',
            customer_email: 'test@example.com',
            metadata: {
                userId: 'user_123',
                priceId: 'price_1SA7VoFbnWkjMFsPB9IvRYWg', // starter plan with 2 credits
            },
            status: 'complete',
        };

        it('should handle P2002 error (duplicate transaction) and return 200', async () => {
            const mockEvent: Stripe.Event = {
                id: 'evt_test',
                object: 'event',
                type: 'checkout.session.completed',
                data: {
                    object: mockSession,
                },
            } as Stripe.Event;

            mockConstructEvent.mockReturnValue(mockEvent);

            // Mock findUnique to return null (no existing transaction)
            mockFindUnique.mockResolvedValue(null);

            // Mock P2002 error (unique constraint violation) using proper Prisma error type
            const p2002Error = new Prisma.PrismaClientKnownRequestError(
                'Unique constraint failed on the fields: (`stripeSessionId`)',
                {
                    code: 'P2002',
                    clientVersion: '6.16.1',
                    meta: { target: ['stripeSessionId'] },
                }
            );
            mockTransaction.mockRejectedValue(p2002Error);

            const request = createMockRequest(JSON.stringify(mockEvent));
            const response = await POST(request);

            expect(response.status).toBe(200);
            expect(await response.text()).toBe('Ok');
            expect(mockFindUnique).toHaveBeenCalledTimes(1);
            expect(mockTransaction).toHaveBeenCalledTimes(1);
        });

        it('should handle P2025 error (record not found) and return 200', async () => {
            const mockEvent: Stripe.Event = {
                id: 'evt_test',
                object: 'event',
                type: 'checkout.session.completed',
                data: {
                    object: mockSession,
                },
            } as Stripe.Event;

            mockConstructEvent.mockReturnValue(mockEvent);

            // Mock findUnique to return null (no existing transaction)
            mockFindUnique.mockResolvedValue(null);

            // Mock P2025 error (record not found) using proper Prisma error type
            const p2025Error = new Prisma.PrismaClientKnownRequestError(
                'Record to update not found.',
                {
                    code: 'P2025',
                    clientVersion: '6.16.1',
                    meta: { cause: 'Record to update not found.' },
                }
            );
            mockTransaction.mockRejectedValue(p2025Error);

            const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

            const request = createMockRequest(JSON.stringify(mockEvent));
            const response = await POST(request);

            expect(response.status).toBe(200);
            expect(await response.text()).toBe('Ok');
            expect(mockFindUnique).toHaveBeenCalledTimes(1);
            expect(mockTransaction).toHaveBeenCalledTimes(1);
            expect(consoleLogSpy).toHaveBeenCalledWith(
                '[webhook] Record not found, treating as no-op'
            );

            consoleLogSpy.mockRestore();
        });

        it('should return 500 for other transaction errors', async () => {
            const mockEvent: Stripe.Event = {
                id: 'evt_test',
                object: 'event',
                type: 'checkout.session.completed',
                data: {
                    object: mockSession,
                },
            } as Stripe.Event;

            mockConstructEvent.mockReturnValue(mockEvent);

            // Mock findUnique to return null (no existing transaction)
            mockFindUnique.mockResolvedValue(null);

            // Mock unexpected error
            const unexpectedError = new Error('Database connection failed');
            mockTransaction.mockRejectedValue(unexpectedError);

            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

            const request = createMockRequest(JSON.stringify(mockEvent));
            const response = await POST(request);

            expect(response.status).toBe(500);
            expect(await response.text()).toBe('Transaction failed');
            expect(mockFindUnique).toHaveBeenCalledTimes(1);
            expect(mockTransaction).toHaveBeenCalledTimes(1);
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                '[webhook] Transaction error:',
                unexpectedError
            );

            consoleErrorSpy.mockRestore();
        });

        it('should successfully process valid checkout session', async () => {
            const mockEvent: Stripe.Event = {
                id: 'evt_test',
                object: 'event',
                type: 'checkout.session.completed',
                data: {
                    object: mockSession,
                },
            } as Stripe.Event;

            mockConstructEvent.mockReturnValue(mockEvent);

            // Mock findUnique to return null (no existing transaction)
            mockFindUnique.mockResolvedValue(null);

            // Mock successful transaction
            const mockTxCallback = jest.fn();
            mockTransaction.mockImplementation(async (callback) => {
                const mockTx = {
                    user: {
                        update: jest.fn().mockResolvedValue({ id: 'user_123', credits: 100 }),
                    },
                    creditTransaction: {
                        create: jest.fn().mockResolvedValue({
                            id: 'txn_123',
                            stripeSessionId: 'cs_test_123',
                            userId: 'user_123',
                            amount: 100,
                            type: CreditTransactionType.CREDIT,
                        }),
                    },
                };
                return await callback(mockTx);
            });

            const request = createMockRequest(JSON.stringify(mockEvent));
            const response = await POST(request);

            expect(response.status).toBe(200);
            expect(await response.text()).toBe('Ok');
            expect(mockFindUnique).toHaveBeenCalledTimes(1);
            expect(mockTransaction).toHaveBeenCalledTimes(1);
        });

        it('should return 200 for unsupported event types', async () => {
            const mockEvent: Stripe.Event = {
                id: 'evt_test',
                object: 'event',
                type: 'customer.created', // unsupported event type
                data: {
                    object: {} as any,
                },
            } as Stripe.Event;

            mockConstructEvent.mockReturnValue(mockEvent);

            const request = createMockRequest(JSON.stringify(mockEvent));
            const response = await POST(request);

            expect(response.status).toBe(200);
            expect(await response.text()).toBe('Ok');
            expect(mockTransaction).not.toHaveBeenCalled();
        });
    });

    describe('webhook signature validation', () => {
        it('should return 400 for missing signature', async () => {
            const request = new NextRequest('http://localhost:3000/api/stripe/webhook', {
                method: 'POST',
                body: JSON.stringify({}),
            });

            // Mock constructEvent to throw for missing signature
            mockConstructEvent.mockImplementation(() => {
                throw new Error('No signature header found');
            });

            const response = await POST(request);

            expect(response.status).toBe(400);
            expect(await response.text()).toContain('Webhook Error');
        });

        it('should return 400 for invalid signature', async () => {
            const headers = new Headers();
            headers.set('stripe-signature', 'invalid_signature');

            const request = new NextRequest('http://localhost:3000/api/stripe/webhook', {
                method: 'POST',
                headers,
                body: JSON.stringify({}),
            });

            mockConstructEvent.mockImplementation(() => {
                throw new Error('Invalid signature');
            });

            const response = await POST(request);

            expect(response.status).toBe(400);
            expect(await response.text()).toBe('Webhook Error: Invalid signature');
        });
    });
});
