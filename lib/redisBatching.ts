/**
 * Redis operation batching utility
 * Reduces the number of Redis round-trips by batching operations
 */

import Redis from 'ioredis';
import { logger } from '@/lib/logger';

type BatchOperation = {
  type: 'get' | 'set' | 'del' | 'setex';
  key: string;
  value?: string;
  ttl?: number;
};

type BatchOperationResult = {
  operation: BatchOperation;
  result: number | string | null;
  error?: Error;
};

/**
 * Executes multiple Redis operations in a single pipeline
 * This significantly reduces network overhead compared to individual operations
 * 
 * @returns Array of results where each element type depends on the operation:
 *   - GET: string | null
 *   - SET/SETEX: "OK" (string)
 *   - DEL: number (count of deleted keys)
 *   - error case: null
 * 
 * @throws {Error} if any operation has missing or invalid required fields
 * 
 * Note: Use `batchRedisOperationsWithContext` if you need typed results with operation context
 */
export async function batchRedisOperations(
  redis: Redis,
  operations: BatchOperation[]
): Promise<unknown[]> {
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
        if (op.value === undefined || typeof op.value !== 'string') {
          throw new Error(
            `SET operation requires 'value' to be a string. Key: ${op.key}, value: ${op.value}`
          );
        }
        pipeline.set(op.key, op.value);
        break;
      case 'setex':
        if (op.value === undefined || typeof op.value !== 'string') {
          throw new Error(
            `SETEX operation requires 'value' to be a string. Key: ${op.key}, value: ${op.value}`
          );
        }
        if (op.ttl === undefined || typeof op.ttl !== 'number' || op.ttl <= 0) {
          throw new Error(
            `SETEX operation requires 'ttl' to be a positive number. Key: ${op.key}, ttl: ${op.ttl}`
          );
        }
        pipeline.setex(op.key, op.ttl, op.value);
        break;
      case 'del':
        pipeline.del(op.key);
        break;
      default:
        // Exhaustiveness check: catch unknown operation types
        throw new Error(
          `Unknown operation type: ${(op as BatchOperation).type}. Key: ${op.key}`
        );
    }
  }

  try {
    const results = await pipeline.exec();
    
    if (!results) {
      logger.warn('Redis pipeline returned null results');
      return [];
    }

    // Pipeline results are [error, result] tuples
    // Different commands return different types:
    // - GET: string | null
    // - SET/SETEX: "OK" (string)
    // - DEL: number (count of deleted keys)
    return results.map(([error, result]) => {
      if (error) {
        logger.error('Redis pipeline operation failed', { error: error.message });
        return null;
      }
      // Preserve the original type without casting
      return result;
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
 * Executes multiple Redis operations with detailed context
 * Returns operation details along with results for better debugging
 * @throws {Error} if any operation has missing or invalid required fields
 */
export async function batchRedisOperationsWithContext(
  redis: Redis,
  operations: BatchOperation[]
): Promise<BatchOperationResult[]> {
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
        if (op.value === undefined || typeof op.value !== 'string') {
          throw new Error(
            `SET operation requires 'value' to be a string. Key: ${op.key}, value: ${op.value}`
          );
        }
        pipeline.set(op.key, op.value);
        break;
      case 'setex':
        if (op.value === undefined || typeof op.value !== 'string') {
          throw new Error(
            `SETEX operation requires 'value' to be a string. Key: ${op.key}, value: ${op.value}`
          );
        }
        if (op.ttl === undefined || typeof op.ttl !== 'number' || op.ttl <= 0) {
          throw new Error(
            `SETEX operation requires 'ttl' to be a positive number. Key: ${op.key}, ttl: ${op.ttl}`
          );
        }
        pipeline.setex(op.key, op.ttl, op.value);
        break;
      case 'del':
        pipeline.del(op.key);
        break;
      default:
        // Exhaustiveness check: catch unknown operation types
        throw new Error(
          `Unknown operation type: ${(op as BatchOperation).type}. Key: ${op.key}`
        );
    }
  }

  try {
    const results = await pipeline.exec();
    
    if (!results) {
      logger.warn('Redis pipeline returned null results');
      return operations.map(op => ({
        operation: op,
        result: null,
      }));
    }

    // Map results with operation context
    return results.map(([error, result], index) => ({
      operation: operations[index],
      result: error ? null : (result as number | string | null),
      error: error || undefined,
    }));
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
 * Handles Redis Cluster CROSSSLOT errors by falling back to pipeline
 * 
 * Note: In Redis Cluster, multi-key DEL requires all keys to be in the same slot.
 * If keys are in different slots, falls back to pipelined individual DEL commands.
 */
export async function batchDelete(
  redis: Redis,
  keys: string[]
): Promise<number> {
  if (keys.length === 0) {
    return 0;
  }

  try {
    // DEL accepts multiple keys (single node). In Cluster, this may fail with CROSSSLOT.
    return await redis.del(...keys);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    
    // Handle Redis Cluster CROSSSLOT error
    if (msg.includes('CROSSSLOT')) {
      logger.debug('CROSSSLOT error detected, falling back to pipelined delete', {
        keyCount: keys.length
      });
      
      try {
        const pipeline = redis.pipeline();
        for (const k of keys) {
          pipeline.del(k); // Could use pipeline.unlink(k) for async deletion
        }
        const results = await pipeline.exec();
        
        if (!results) return 0;
        
        // Sum up successful deletions
        return results.reduce((sum, [err, res]) => {
          return sum + (err ? 0 : Number(res || 0));
        }, 0);
      } catch (pipelineError) {
        logger.error('Redis pipeline delete failed', {
          error: pipelineError instanceof Error ? pipelineError.message : String(pipelineError),
          keyCount: keys.length
        });
        return 0;
      }
    }
    
    logger.error('Redis batch delete failed', {
      error: msg,
      keyCount: keys.length
    });
    return 0;
  }
}

/**
 * Debounces Redis operations to reduce frequency
 * Useful for high-frequency updates like progress tracking
 * 
 * Note: Uses last-wins strategy for the same key during the debounce window.
 * If both SET and SETEX operations are enqueued for the same key, the last
 * operation will be executed. If TTL needs to be applied reliably, ensure
 * callers always use SETEX when TTL is required.
 * 
 * Future enhancement: Consider normalizing SET operations with ttl to SETEX
 * for consistent TTL handling.
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
   * 
   * Note: Last-wins strategy - if multiple operations for the same key are
   * enqueued, only the final one will execute.
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
   * Cleans up resources and optionally flushes pending operations
   * 
   * @param flush - If true, attempts to flush pending operations before cleanup
   *                Default: false (drops pending operations for faster cleanup)
   * 
   * Note: When flush=true, destroy() becomes async. Await the returned promise
   * to ensure pending operations are persisted before cleanup.
   */
  destroy(flush: boolean = false): void | Promise<void> {
    this.timers.forEach(timer => clearTimeout(timer));
    
    if (flush && this.pendingOperations.size > 0) {
      // Async path: flush pending operations before cleanup
      return this.flushAll().catch(err => {
        logger.warn('Debouncer destroy flush failed', {
          error: err instanceof Error ? err.message : String(err),
          droppedOperations: this.pendingOperations.size
        });
      }).finally(() => {
        this.timers.clear();
        this.pendingOperations.clear();
      });
    }
    
    // Sync path: immediate cleanup
    this.timers.clear();
    this.pendingOperations.clear();
  }
}
