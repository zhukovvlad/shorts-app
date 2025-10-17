/**
 * Redis operation batching utility
 * Reduces the number of Redis round-trips by batching operations
 */

import { Redis } from 'ioredis';
import { logger } from '@/lib/logger';

interface BatchOperation {
  type: 'get' | 'set' | 'del' | 'setex';
  key: string;
  value?: string;
  ttl?: number;
}

/**
 * Executes multiple Redis operations in a single pipeline
 * This significantly reduces network overhead compared to individual operations
 */
export async function batchRedisOperations(
  redis: Redis,
  operations: BatchOperation[]
): Promise<Array<string | null>> {
  if (operations.length === 0) {
    return [];
  }

  const pipeline = redis.pipeline();

  for (const op of operations) {
    switch (op.type) {
      case 'get':
        pipeline.get(op.key);
        break;
      case 'set':
        if (op.value !== undefined) {
          pipeline.set(op.key, op.value);
        }
        break;
      case 'setex':
        if (op.value !== undefined && op.ttl !== undefined) {
          pipeline.setex(op.key, op.ttl, op.value);
        }
        break;
      case 'del':
        pipeline.del(op.key);
        break;
    }
  }

  try {
    const results = await pipeline.exec();
    
    if (!results) {
      logger.warn('Redis pipeline returned null results');
      return [];
    }

    // Pipeline results are [error, result] tuples
    return results.map(([error, result]) => {
      if (error) {
        logger.error('Redis pipeline operation failed', { error: error.message });
        return null;
      }
      return result as string | null;
    });
  } catch (error) {
    logger.error('Redis batch operation failed', {
      error: error instanceof Error ? error.message : String(error),
      operationCount: operations.length
    });
    throw error;
  }
}

/**
 * Batches multiple GET operations
 */
export async function batchGet(
  redis: Redis,
  keys: string[]
): Promise<Array<string | null>> {
  if (keys.length === 0) {
    return [];
  }

  // Use MGET for better performance on multiple gets
  try {
    return await redis.mget(...keys);
  } catch (error) {
    logger.error('Redis MGET failed', {
      error: error instanceof Error ? error.message : String(error),
      keyCount: keys.length
    });
    return keys.map(() => null);
  }
}

/**
 * Batches multiple DEL operations
 */
export async function batchDelete(
  redis: Redis,
  keys: string[]
): Promise<number> {
  if (keys.length === 0) {
    return 0;
  }

  try {
    // DEL accepts multiple keys
    return await redis.del(...keys);
  } catch (error) {
    logger.error('Redis batch delete failed', {
      error: error instanceof Error ? error.message : String(error),
      keyCount: keys.length
    });
    return 0;
  }
}

/**
 * Debounces Redis operations to reduce frequency
 * Useful for high-frequency updates like progress tracking
 */
export class RedisDebouncer {
  private timers: Map<string, NodeJS.Timeout> = new Map();
  private pendingOperations: Map<string, BatchOperation> = new Map();

  constructor(
    private redis: Redis,
    private delay: number = 500 // Default 500ms debounce
  ) {}

  /**
   * Debounces a Redis operation
   * Only the last operation within the delay period will be executed
   */
  debounce(operation: BatchOperation): void {
    const existingTimer = this.timers.get(operation.key);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    this.pendingOperations.set(operation.key, operation);

    const timer = setTimeout(() => {
      this.flush(operation.key);
    }, this.delay);

    this.timers.set(operation.key, timer);
  }

  /**
   * Immediately flushes pending operations for a specific key
   */
  private async flush(key: string): Promise<void> {
    const operation = this.pendingOperations.get(key);
    if (!operation) return;

    this.timers.delete(key);
    this.pendingOperations.delete(key);

    try {
      await batchRedisOperations(this.redis, [operation]);
    } catch (error) {
      logger.error('Failed to flush debounced Redis operation', {
        key,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Flushes all pending operations immediately
   */
  async flushAll(): Promise<void> {
    const operations = Array.from(this.pendingOperations.values());
    
    this.timers.forEach(timer => clearTimeout(timer));
    this.timers.clear();
    this.pendingOperations.clear();

    if (operations.length > 0) {
      try {
        await batchRedisOperations(this.redis, operations);
      } catch (error) {
        logger.error('Failed to flush all debounced Redis operations', {
          error: error instanceof Error ? error.message : String(error),
          operationCount: operations.length
        });
      }
    }
  }

  /**
   * Cleans up resources
   */
  destroy(): void {
    this.timers.forEach(timer => clearTimeout(timer));
    this.timers.clear();
    this.pendingOperations.clear();
  }
}
