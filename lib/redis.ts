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
export const VIDEO_CHECKPOINT_PREFIX = 'video_checkpoint:';
export const VIDEO_PROGRESS_TTL = 3600; // 1 час
export const VIDEO_CHECKPOINT_TTL = 7200; // 2 часа (дольше чем прогресс)

export interface VideoProgress {
  status: 'script' | 'images' | 'audio' | 'captions' | 'render' | 'completed' | 'error' | 'retrying';
  step?: string;
  error?: string;
  retryCount?: number;
  maxRetries?: number;
  lastError?: string;
  retryReason?: string;
  currentStepId?: string; // Точный ID текущего шага для корректного отображения UI
  timestamp: number;
  userId: string;
}

export interface VideoCheckpoint {
  videoId: string;
  userId: string;
  completedSteps: {
    script: boolean;
    images: boolean;
    audio: boolean;
    captions: boolean;
    render: boolean;
  };
  lastCompletedStep?: string;
  lastFailedStep?: string;
  timestamp: number;
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

// === CHECKPOINT СИСТЕМА ===

export const setVideoCheckpoint = async (videoId: string, checkpoint: VideoCheckpoint) => {
  try {
    const redis = getRedisInstance();
    const key = `${VIDEO_CHECKPOINT_PREFIX}${videoId}`;
    await redis.setex(key, VIDEO_CHECKPOINT_TTL, JSON.stringify(checkpoint));
  } catch (error) {
    console.error('Failed to set video checkpoint in Redis:', error);
  }
};

export const getVideoCheckpoint = async (videoId: string): Promise<VideoCheckpoint | null> => {
  try {
    const redis = getRedisInstance();
    const key = `${VIDEO_CHECKPOINT_PREFIX}${videoId}`;
    const data = await redis.get(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('Failed to get video checkpoint from Redis:', error);
    return null;
  }
};

export const markStepCompleted = async (videoId: string, userId: string, step: string) => {
  try {
    const checkpoint = await getVideoCheckpoint(videoId) || {
      videoId,
      userId,
      completedSteps: {
        script: false,
        images: false,
        audio: false,
        captions: false,
        render: false
      },
      timestamp: Date.now()
    };

    // Отмечаем шаг как завершенный
    if (step in checkpoint.completedSteps) {
      checkpoint.completedSteps[step as keyof typeof checkpoint.completedSteps] = true;
      checkpoint.lastCompletedStep = step;
      checkpoint.timestamp = Date.now();
      
      await setVideoCheckpoint(videoId, checkpoint);
      console.log(`✅ Checkpoint: Step '${step}' completed for video ${videoId}`);
    }
  } catch (error) {
    console.error('Failed to mark step as completed:', error);
  }
};

export const markStepFailed = async (videoId: string, userId: string, step: string) => {
  try {
    const checkpoint = await getVideoCheckpoint(videoId) || {
      videoId,
      userId,
      completedSteps: {
        script: false,
        images: false,
        audio: false,
        captions: false,
        render: false
      },
      timestamp: Date.now()
    };

    checkpoint.lastFailedStep = step;
    checkpoint.timestamp = Date.now();
    
    await setVideoCheckpoint(videoId, checkpoint);
    console.log(`❌ Checkpoint: Step '${step}' failed for video ${videoId}`);
  } catch (error) {
    console.error('Failed to mark step as failed:', error);
  }
};

export const getNextStep = (checkpoint: VideoCheckpoint | null): string => {
  if (!checkpoint) return 'script';
  
  const steps = ['script', 'images', 'audio', 'captions', 'render'];
  const completed = checkpoint.completedSteps;
  
  // Находим первый незавершенный шаг
  for (const step of steps) {
    if (!completed[step as keyof typeof completed]) {
      return step;
    }
  }
  
  return 'completed'; // Все шаги завершены
};

export const deleteVideoCheckpoint = async (videoId: string) => {
  try {
    const redis = getRedisInstance();
    const key = `${VIDEO_CHECKPOINT_PREFIX}${videoId}`;
    await redis.del(key);
  } catch (error) {
    console.error('Failed to delete video checkpoint from Redis:', error);
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

// Префикс для метаданных видео
const VIDEO_METADATA_PREFIX = 'video:metadata:';

// Функция для сохранения метаданных видео
export const setVideoMetadata = async (videoId: string, metadata: Record<string, any>): Promise<void> => {
  try {
    const redis = getRedisInstance();
    const key = `${VIDEO_METADATA_PREFIX}${videoId}`;
    await redis.set(key, JSON.stringify(metadata), 'EX', 86400); // TTL 24 часа
  } catch (error) {
    console.error('Failed to set video metadata in Redis:', error);
    throw error;
  }
};

// Функция для получения метаданных видео
export const getVideoMetadata = async (videoId: string): Promise<Record<string, any> | null> => {
  try {
    const redis = getRedisInstance();
    const key = `${VIDEO_METADATA_PREFIX}${videoId}`;
    const data = await redis.get(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('Failed to get video metadata from Redis:', error);
    return null;
  }
};