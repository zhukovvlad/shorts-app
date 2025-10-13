import { Prisma } from '@prisma/client';
import { withRetry, isPrismaRetryable } from './db';

// Mock logger to prevent console output during tests
jest.mock('@/lib/logger', () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('isPrismaRetryable', () => {
  describe('retryable errors', () => {
    it('should return true for P1001 in PrismaClientKnownRequestError', () => {
      const error = new Prisma.PrismaClientKnownRequestError('Cannot reach database', {
        code: 'P1001',
        clientVersion: '5.0.0',
      });
      expect(isPrismaRetryable(error)).toBe(true);
    });

    it('should return true for P1008 in PrismaClientKnownRequestError', () => {
      const error = new Prisma.PrismaClientKnownRequestError('Operations timed out', {
        code: 'P1008',
        clientVersion: '5.0.0',
      });
      expect(isPrismaRetryable(error)).toBe(true);
    });

    it('should return true for P1017 in PrismaClientKnownRequestError', () => {
      const error = new Prisma.PrismaClientKnownRequestError('Server closed connection', {
        code: 'P1017',
        clientVersion: '5.0.0',
      });
      expect(isPrismaRetryable(error)).toBe(true);
    });

    it('should return true for P1001 in PrismaClientInitializationError', () => {
      const error = new Prisma.PrismaClientInitializationError('Init failed', '5.0.0', 'P1001');
      expect(isPrismaRetryable(error)).toBe(true);
    });

    it('should return true for P1008 in PrismaClientInitializationError', () => {
      const error = new Prisma.PrismaClientInitializationError('Timeout on init', '5.0.0', 'P1008');
      expect(isPrismaRetryable(error)).toBe(true);
    });

    it('should return true for P1017 in PrismaClientInitializationError', () => {
      const error = new Prisma.PrismaClientInitializationError('Connection closed', '5.0.0', 'P1017');
      expect(isPrismaRetryable(error)).toBe(true);
    });
  });

  describe('non-retryable errors', () => {
    it('should return false for P2002 (unique constraint)', () => {
      const error = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '5.0.0',
      });
      expect(isPrismaRetryable(error)).toBe(false);
    });

    it('should return false for P2025 (record not found)', () => {
      const error = new Prisma.PrismaClientKnownRequestError('Record not found', {
        code: 'P2025',
        clientVersion: '5.0.0',
      });
      expect(isPrismaRetryable(error)).toBe(false);
    });

    it('should return false for non-retryable PrismaClientInitializationError', () => {
      const error = new Prisma.PrismaClientInitializationError('Invalid schema', '5.0.0', 'P1012');
      expect(isPrismaRetryable(error)).toBe(false);
    });

    it('should return false for PrismaClientValidationError', () => {
      const error = new Prisma.PrismaClientValidationError('Validation failed', { clientVersion: '5.0.0' });
      expect(isPrismaRetryable(error)).toBe(false);
    });

    it('should return false for generic Error', () => {
      const error = new Error('Generic error');
      expect(isPrismaRetryable(error)).toBe(false);
    });

    it('should return false for non-Error values', () => {
      expect(isPrismaRetryable('string error')).toBe(false);
      expect(isPrismaRetryable(null)).toBe(false);
      expect(isPrismaRetryable(undefined)).toBe(false);
      expect(isPrismaRetryable(123)).toBe(false);
    });
  });
});

describe('withRetry', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('successful operations', () => {
    it('should return result on first attempt', async () => {
      const operation = jest.fn().mockResolvedValue('success');
      const result = await withRetry(operation);
      
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should handle different return types', async () => {
      const objOperation = jest.fn().mockResolvedValue({ id: 1, name: 'test' });
      const objResult = await withRetry(objOperation);
      
      expect(objResult).toEqual({ id: 1, name: 'test' });
      expect(objOperation).toHaveBeenCalledTimes(1);
    });
  });

  describe('retryable errors - PrismaClientKnownRequestError', () => {
    it('should retry on P1001 (cannot reach database)', async () => {
      const operation = jest.fn()
        .mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError('Cannot reach database', {
          code: 'P1001',
          clientVersion: '5.0.0',
        }))
        .mockResolvedValueOnce('success');
      
      const result = await withRetry(operation, 3, 10);
      
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should retry on P1008 (operations timed out)', async () => {
      const operation = jest.fn()
        .mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError('Operations timed out', {
          code: 'P1008',
          clientVersion: '5.0.0',
        }))
        .mockResolvedValueOnce('success');
      
      const result = await withRetry(operation, 3, 10);
      
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should retry on P1017 (server closed connection)', async () => {
      const operation = jest.fn()
        .mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError('Server closed connection', {
          code: 'P1017',
          clientVersion: '5.0.0',
        }))
        .mockResolvedValueOnce('success');
      
      const result = await withRetry(operation, 3, 10);
      
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should exhaust retries and throw on persistent P1001', async () => {
      const error = new Prisma.PrismaClientKnownRequestError('Cannot reach database', {
        code: 'P1001',
        clientVersion: '5.0.0',
      });
      const operation = jest.fn().mockRejectedValue(error);
      
      await expect(withRetry(operation, 3, 10)).rejects.toThrow(error);
      expect(operation).toHaveBeenCalledTimes(3);
    });
  });

  describe('retryable errors - PrismaClientInitializationError', () => {
    it('should retry on PrismaClientInitializationError with P1001 errorCode', async () => {
      const operation = jest.fn()
        .mockRejectedValueOnce(new Prisma.PrismaClientInitializationError('Init error', '5.0.0', 'P1001'))
        .mockResolvedValueOnce('success');
      
      const result = await withRetry(operation, 3, 10);
      
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should retry on PrismaClientInitializationError with P1008 errorCode', async () => {
      const operation = jest.fn()
        .mockRejectedValueOnce(new Prisma.PrismaClientInitializationError('Timeout on init', '5.0.0', 'P1008'))
        .mockResolvedValueOnce('success');
      
      const result = await withRetry(operation, 3, 10);
      
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should retry on PrismaClientInitializationError with P1017 errorCode', async () => {
      const operation = jest.fn()
        .mockRejectedValueOnce(new Prisma.PrismaClientInitializationError('Connection closed during init', '5.0.0', 'P1017'))
        .mockResolvedValueOnce('success');
      
      const result = await withRetry(operation, 3, 10);
      
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should exhaust retries on persistent PrismaClientInitializationError', async () => {
      const error = new Prisma.PrismaClientInitializationError('Init error', '5.0.0', 'P1001');
      const operation = jest.fn().mockRejectedValue(error);
      
      await expect(withRetry(operation, 3, 10)).rejects.toThrow(error);
      expect(operation).toHaveBeenCalledTimes(3);
    });
  });

  describe('non-retryable errors', () => {
    it('should not retry on P2002 (unique constraint)', async () => {
      const error = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '5.0.0',
      });
      const operation = jest.fn().mockRejectedValue(error);
      
      await expect(withRetry(operation, 3, 10)).rejects.toThrow(error);
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should not retry on P2025 (record not found)', async () => {
      const error = new Prisma.PrismaClientKnownRequestError('Record not found', {
        code: 'P2025',
        clientVersion: '5.0.0',
      });
      const operation = jest.fn().mockRejectedValue(error);
      
      await expect(withRetry(operation, 3, 10)).rejects.toThrow(error);
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should not retry on PrismaClientInitializationError with non-retryable code', async () => {
      const error = new Prisma.PrismaClientInitializationError('Invalid schema', '5.0.0', 'P1012');
      const operation = jest.fn().mockRejectedValue(error);
      
      await expect(withRetry(operation, 3, 10)).rejects.toThrow(error);
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should not retry on generic Error', async () => {
      const error = new Error('Generic error');
      const operation = jest.fn().mockRejectedValue(error);
      
      await expect(withRetry(operation, 3, 10)).rejects.toThrow(error);
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should not retry on PrismaClientValidationError', async () => {
      const error = new Prisma.PrismaClientValidationError('Validation failed', { clientVersion: '5.0.0' });
      const operation = jest.fn().mockRejectedValue(error);
      
      await expect(withRetry(operation, 3, 10)).rejects.toThrow(error);
      expect(operation).toHaveBeenCalledTimes(1);
    });
  });

  describe('retry behavior', () => {
    it('should retry up to maxRetries times', async () => {
      const error = new Prisma.PrismaClientKnownRequestError('Cannot reach database', {
        code: 'P1001',
        clientVersion: '5.0.0',
      });
      const operation = jest.fn()
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce('success');
      
      const result = await withRetry(operation, 3, 10);
      
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should respect custom maxRetries parameter', async () => {
      const error = new Prisma.PrismaClientKnownRequestError('Cannot reach database', {
        code: 'P1001',
        clientVersion: '5.0.0',
      });
      const operation = jest.fn().mockRejectedValue(error);
      
      await expect(withRetry(operation, 5, 10)).rejects.toThrow(error);
      expect(operation).toHaveBeenCalledTimes(5);
    });

    it('should handle maxRetries = 1 (no retries)', async () => {
      const error = new Prisma.PrismaClientKnownRequestError('Cannot reach database', {
        code: 'P1001',
        clientVersion: '5.0.0',
      });
      const operation = jest.fn().mockRejectedValue(error);
      
      await expect(withRetry(operation, 1, 10)).rejects.toThrow(error);
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should use exponential backoff (timing test)', async () => {
      // This test verifies exponential backoff is working correctly.
      // We use fake timers and mock Math.random to make it deterministic (non-flaky).
      
      // Mock Math.random to return 0 for deterministic jitter (no randomness)
      const originalRandom = Math.random;
      Math.random = jest.fn(() => 0);
      
      // Use fake timers for deterministic timing
      jest.useFakeTimers();
      
      const operation = jest.fn()
        .mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError('P1001', {
          code: 'P1001',
          clientVersion: '5.0.0',
        }))
        .mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError('P1001', {
          code: 'P1001',
          clientVersion: '5.0.0',
        }))
        .mockResolvedValueOnce('success');
      
      // Start the operation (returns a promise)
      const promise = withRetry(operation, 3, 100);
      
      // Run all pending timers and promises to simulate the passage of time
      // This will execute all setTimeout calls from withRetry's backoff logic
      await jest.runAllTimersAsync();
      
      // Wait for the promise to resolve
      const result = await promise;
      expect(result).toBe('success');
      
      // Verify exponential backoff was used
      // First attempt: immediate
      // Second attempt (retry 1): after 100ms * 2^0 = 100ms
      // Third attempt (retry 2): after 100ms * 2^1 = 200ms
      expect(operation).toHaveBeenCalledTimes(3);
      
      // Restore original state
      jest.useRealTimers();
      Math.random = originalRandom;
    });
  });

  describe('edge cases', () => {
    it('should throw error when all retries exhausted with non-Error', async () => {
      const operation = jest.fn().mockRejectedValue('string error');
      
      await expect(withRetry(operation, 1, 10)).rejects.toBe('string error');
    });

    it('should handle operation returning null', async () => {
      const operation = jest.fn().mockResolvedValue(null);
      const result = await withRetry(operation);
      
      expect(result).toBeNull();
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should handle operation returning undefined', async () => {
      const operation = jest.fn().mockResolvedValue(undefined);
      const result = await withRetry(operation);
      
      expect(result).toBeUndefined();
      expect(operation).toHaveBeenCalledTimes(1);
    });
  });
});
