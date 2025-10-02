import { Redis } from 'ioredis';
import { logger } from '@/lib/logger';

let redisInstance: Redis | null = null;

function getRedisInstance(): Redis {
  if (!redisInstance) {
    // Проверяем наличие необходимых переменных окружения
    const redisHost = process.env.UPSTASH_REDIS_HOST;
    const redisToken = process.env.UPSTASH_REDIS_TOKEN;
    
    // Валидируем порт
    let redisPort = 6379; // Значение по умолчанию
    if (process.env.UPSTASH_REDIS_PORT) {
      const parsedPort = parseInt(process.env.UPSTASH_REDIS_PORT, 10);
      if (!isNaN(parsedPort) && parsedPort > 0 && parsedPort <= 65535) {
        redisPort = parsedPort;
      } else {
        logger.warn('Invalid UPSTASH_REDIS_PORT, falling back to 6379', { 
          providedPort: process.env.UPSTASH_REDIS_PORT 
        });
      }
    }

    logger.debug('Creating Redis instance with config', {
      host: redisHost,
      port: redisPort,
      token: redisToken ? '[SET]' : '[NOT SET]'
    });

    if (!redisHost || !redisToken) {
      logger.error('Missing required Redis configuration', {
        host: redisHost ? '[SET]' : '[NOT SET]',
        token: redisToken ? '[SET]' : '[NOT SET]'
      });
      throw new Error('UPSTASH_REDIS_HOST and UPSTASH_REDIS_TOKEN must be set for Redis functionality');
    }

    redisInstance = new Redis({
      host: redisHost,
      port: redisPort,
      password: redisToken,
      tls: { rejectUnauthorized: true },
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: true,
    });

    // Обработка ошибок подключения
    redisInstance.on('error', (err) => {
      logger.error('Redis connection error', { error: err.message });
    });

    redisInstance.on('connect', () => {
      logger.info('Redis connected successfully');
    });
  }
  
  return redisInstance;
}

export const VIDEO_PROGRESS_PREFIX = 'video_progress:';
export const VIDEO_PROGRESS_TTL = 3600; // 1 час

export interface VideoProgress {
  status: 'script' | 'images' | 'audio' | 'captions' | 'render' | 'completed' | 'error';
  step?: string;
  error?: string;
  timestamp: number;
  userId: string;
}

export const setVideoProgress = async (videoId: string, progress: VideoProgress) => {
  try {
    const redis = getRedisInstance();
    const key = `${VIDEO_PROGRESS_PREFIX}${videoId}`;
    await redis.setex(key, VIDEO_PROGRESS_TTL, JSON.stringify(progress));
  } catch (error) {
    console.error('Failed to set video progress in Redis:', error);
    // В случае ошибки Redis не блокируем процесс
  }
};

export const getVideoProgress = async (videoId: string): Promise<VideoProgress | null> => {
  try {
    const redis = getRedisInstance();
    const key = `${VIDEO_PROGRESS_PREFIX}${videoId}`;
    const data = await redis.get(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('Failed to get video progress from Redis:', error);
    return null; // Возвращаем null при ошибке
  }
};

export const deleteVideoProgress = async (videoId: string) => {
  try {
    const redis = getRedisInstance();
    const key = `${VIDEO_PROGRESS_PREFIX}${videoId}`;
    await redis.del(key);
  } catch (error) {
    console.error('Failed to delete video progress from Redis:', error);
    // В случае ошибки не блокируем процесс
  }
};

// Функция для тестирования подключения к Redis
export const testRedisConnection = async (): Promise<boolean> => {
  try {
    const redis = getRedisInstance();
    const result = await redis.ping();
    console.log('Redis ping successful:', result);
    return true;
  } catch (error) {
    console.error('Redis ping failed:', error);
    return false;
  }
};