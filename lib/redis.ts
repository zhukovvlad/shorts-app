import { Redis } from 'ioredis';
import { logger } from '@/lib/logger';
import { createRedisConfig, validateRedisConfig } from '@/lib/redis-config';

let redisInstance: Redis | null = null;

/**
 * Устанавливает внешний экземпляр Redis (например, из воркера)
 * Используется для переиспользования одного соединения
 */
export function setRedisInstance(instance: Redis): void {
  redisInstance = instance;
  logger.info('Redis instance set from external source');
}

function getRedisInstance(): Redis {
  if (!redisInstance) {
    // Валидируем конфигурацию
    validateRedisConfig();

    // Создаем конфигурацию
    const config = createRedisConfig();
    
    logger.debug('Creating Redis instance with config', {
      host: config.host ? '[SET]' : '[NOT SET]',
      port: config.port ? '[SET]' : '[NOT SET]',
      username: config.username ? '[SET]' : '[NOT SET]',
      password: config.password ? '[SET]' : '[NOT SET]'
    });

    redisInstance = new Redis({
      ...config,
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

// Безопасная типизация для метаданных видео (не содержит PII)
export interface VideoMetadataSafe {
  imageModel?: string;  // Модель для генерации изображений
  duration?: number;    // Длительность видео
  format?: string;      // Формат видео
  resolution?: string;  // Разрешение
  // ⚠️ НЕ добавляйте сюда: email, username, phone, address и другие PII данные!
}

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

/**
 * Санитизирует текст ошибки, удаляя потенциально чувствительную информацию:
 * - Пути к файлам с username
 * - API ключи и токены
 * - IP адреса
 * - Внутренние пути сервера
 */
const sanitizeError = (error: string | undefined): string | undefined => {
  if (!error) return undefined;
  
  let sanitized = error;
  
  // Удаляем полные пути к файлам (могут содержать username)
  sanitized = sanitized.replace(/\/home\/[^\s]+/g, '[PATH]');
  sanitized = sanitized.replace(/\/Users\/[^\s]+/g, '[PATH]');
  sanitized = sanitized.replace(/C:\\\\Users\\\\[^\s]+/gi, '[PATH]');
  
  // Удаляем возможные токены/ключи (длинные строки base64/hex)
  sanitized = sanitized.replace(/[A-Za-z0-9+\/]{30,}={0,2}/g, '[TOKEN]');
  
  // Удаляем IP адреса
  sanitized = sanitized.replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, '[IP]');
  
  // Удаляем Bearer токены
  sanitized = sanitized.replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [TOKEN]');
  
  return sanitized;
};

/**
 * Санитизирует error-related поля в VideoProgress объекте
 * Применяет sanitizeError ко всем полям, которые могут содержать чувствительную информацию
 */
const sanitizeProgressErrors = (progress: VideoProgress): VideoProgress => {
  return {
    ...progress,
    error: sanitizeError(progress.error),
    lastError: sanitizeError(progress.lastError),
    retryReason: sanitizeError(progress.retryReason)
  };
};

export const setVideoProgress = async (videoId: string, progress: VideoProgress) => {
  try {
    const redis = getRedisInstance();
    const key = `${VIDEO_PROGRESS_PREFIX}${videoId}`;
    
    // Санитизируем ошибки перед сохранением в Redis
    const sanitizedProgress = sanitizeProgressErrors(progress);
    
    await redis.setex(key, VIDEO_PROGRESS_TTL, JSON.stringify(sanitizedProgress));
  } catch (error) {
    logger.error('Failed to set video progress in Redis', {
      videoId,
      error: error instanceof Error ? error.message : String(error)
    });
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
    logger.error('Failed to get video progress from Redis', {
      videoId,
      error: error instanceof Error ? error.message : String(error)
    });
    return null; // Возвращаем null при ошибке
  }
};

export const deleteVideoProgress = async (videoId: string) => {
  try {
    const redis = getRedisInstance();
    const key = `${VIDEO_PROGRESS_PREFIX}${videoId}`;
    await redis.del(key);
  } catch (error) {
    logger.error('Failed to delete video progress from Redis', {
      videoId,
      error: error instanceof Error ? error.message : String(error)
    });
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
    logger.error('Failed to set video checkpoint in Redis', {
      videoId,
      error: error instanceof Error ? error.message : String(error)
    });
  }
};

export const getVideoCheckpoint = async (videoId: string): Promise<VideoCheckpoint | null> => {
  try {
    const redis = getRedisInstance();
    const key = `${VIDEO_CHECKPOINT_PREFIX}${videoId}`;
    const data = await redis.get(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    logger.error('Failed to get video checkpoint from Redis', {
      videoId,
      error: error instanceof Error ? error.message : String(error)
    });
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
      logger.debug('Checkpoint step completed', {
        videoId,
        step
      });
    }
  } catch (error) {
    logger.error('Failed to mark step as completed', {
      videoId,
      step,
      error: error instanceof Error ? error.message : String(error)
    });
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
    logger.warn('Checkpoint step failed', {
      videoId,
      step
    });
  } catch (error) {
    logger.error('Failed to mark step as failed', {
      videoId,
      step,
      error: error instanceof Error ? error.message : String(error)
    });
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
    logger.error('Failed to delete video checkpoint from Redis', {
      videoId,
      error: error instanceof Error ? error.message : String(error)
    });
  }
};

// Функция для тестирования подключения к Redis
export const testRedisConnection = async (): Promise<boolean> => {
  try {
    const redis = getRedisInstance();
    const result = await redis.ping();
    logger.info('Redis ping successful', { result });
    return true;
  } catch (error) {
    logger.error('Redis ping failed', {
      error: error instanceof Error ? error.message : String(error)
    });
    return false;
  }
};

// Префикс для метаданных видео
const VIDEO_METADATA_PREFIX = 'video:metadata:';

/**
 * Сохраняет безопасные метаданные видео в Redis
 * ⚠️ НЕ сохраняйте здесь PII данные (email, username, phone и т.д.)
 * Только технические параметры обработки видео
 */
export const setVideoMetadata = async (videoId: string, metadata: VideoMetadataSafe): Promise<void> => {
  try {
    const redis = getRedisInstance();
    const key = `${VIDEO_METADATA_PREFIX}${videoId}`;
    await redis.set(key, JSON.stringify(metadata), 'EX', 86400); // TTL 24 часа
  } catch (error) {
    logger.error('Failed to set video metadata in Redis', {
      videoId,
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
};

/**
 * Получает безопасные метаданные видео из Redis
 */
export const getVideoMetadata = async (videoId: string): Promise<VideoMetadataSafe | null> => {
  try {
    const redis = getRedisInstance();
    const key = `${VIDEO_METADATA_PREFIX}${videoId}`;
    const data = await redis.get(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    logger.error('Failed to get video metadata from Redis', {
      videoId,
      error: error instanceof Error ? error.message : String(error)
    });
    return null;
  }
};

// === БАТЧИНГ ОПЕРАЦИЙ ДЛЯ ЭКОНОМИИ ЗАПРОСОВ ===

/**
 * Обновляет прогресс и checkpoint одновременно используя pipeline
 * Экономит 1 запрос (2 вместо 3)
 */
export const updateVideoProgressAndCheckpoint = async (
  videoId: string,
  userId: string,
  progress: Omit<VideoProgress, 'userId' | 'timestamp'>,
  completedStep?: string
) => {
  try {
    const redis = getRedisInstance();
    const pipeline = redis.pipeline();
    
    // Добавляем обновление прогресса с санитизацией
    const fullProgress: VideoProgress = {
      ...progress,
      userId,
      timestamp: Date.now()
    };
    
    const sanitizedProgress = sanitizeProgressErrors(fullProgress);
    
    pipeline.setex(
      `${VIDEO_PROGRESS_PREFIX}${videoId}`,
      VIDEO_PROGRESS_TTL,
      JSON.stringify(sanitizedProgress)
    );
    
    // Если указан завершенный шаг, обновляем checkpoint
    if (completedStep) {
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
      
      if (completedStep in checkpoint.completedSteps) {
        checkpoint.completedSteps[completedStep as keyof typeof checkpoint.completedSteps] = true;
        checkpoint.lastCompletedStep = completedStep;
        checkpoint.timestamp = Date.now();
        
        pipeline.setex(
          `${VIDEO_CHECKPOINT_PREFIX}${videoId}`,
          VIDEO_CHECKPOINT_TTL,
          JSON.stringify(checkpoint)
        );
      }
    }
    
    await pipeline.exec();
    logger.debug('Batched update completed', {
      videoId,
      completedStep: completedStep || 'none'
    });
  } catch (error) {
    logger.error('Failed to batch update video progress and checkpoint', {
      videoId,
      error: error instanceof Error ? error.message : String(error)
    });
  }
};
