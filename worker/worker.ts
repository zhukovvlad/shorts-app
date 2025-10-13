import Redis from "ioredis";
import { Worker, Job } from "bullmq";
import { processVideo } from "@/app/actions/processes";
import { prisma, withRetry } from "@/app/lib/db";
import { setVideoProgress, deleteVideoProgress, testRedisConnection, getVideoCheckpoint, getNextStep, setRedisInstance } from "@/lib/redis";
import { createRedisConfig, validateRedisConfig } from "@/lib/redis-config";
import { workerLogger as logger } from "@/lib/logger";

// Функция для определения, стоит ли делать ретрай
// Проверяет network/timeout/DNS/socket ошибки, избегая маскировки логических багов
function isRetryableError(error: unknown): boolean {
    if (!(error instanceof Error)) return false;
    
    // Проверяем error.code для системных ошибок (более надежно чем message)
    const errorCode = (error as any).code;
    const retryableCodes = [
        'ECONNRESET',     // Connection reset
        'ENOTFOUND',      // DNS lookup failed
        'ETIMEDOUT',      // Connection timeout
        'ECONNREFUSED',   // Connection refused
        'ENETUNREACH',    // Network unreachable
        'EAI_AGAIN',      // DNS temporary failure
        'EPIPE',          // Broken pipe
    ];
    
    if (errorCode && retryableCodes.includes(errorCode)) {
        return true;
    }
    
    // Fallback на проверку message для других типов ошибок
    const message = error.message.toLowerCase();
    
    // Только явные сетевые/timeout ошибки, без "internal server error"
    const retryablePatterns = [
        'fetch failed',
        'connect timeout',
        'network error',
        'connection refused',
        'temporary failure',
        'service unavailable',  // 503
        'gateway timeout',      // 504
    ];
    
    return retryablePatterns.some(pattern => message.includes(pattern));
}

// Логируем переменные окружения для отладки
logger.debug('Worker environment variables check', {
  host: process.env.TIMEWEB_REDIS_HOST ? '[SET]' : '[NOT SET]',
  port: process.env.TIMEWEB_REDIS_PORT ? '[SET]' : '[NOT SET]',
  username: process.env.TIMEWEB_REDIS_USERNAME ? '[SET]' : '[NOT SET]',
  password: process.env.TIMEWEB_REDIS_PASSWORD ? '[SET]' : '[NOT SET]'
});

// Валидируем конфигурацию Redis при старте
validateRedisConfig();

const connection = new Redis(createRedisConfig())

// ✅ ВАЖНО: Переиспользуем это соединение для всех Redis операций
// Это предотвращает создание множественных подключений к Redis
setRedisInstance(connection);

// Добавляем обработку ошибок для воркера
connection.on('error', (err) => {
    logger.error('Worker Redis connection error', { error: err.message });
});

connection.on('connect', () => {
    logger.info('Worker Redis connected successfully');
});

const worker = new Worker('video-processing', async (job: Job) => {
    const { videoId } = job.data;
    
    // Получаем checkpoint информацию для логирования (non-fatal если Redis недоступен)
    let checkpoint = null;
    let nextStep = 'script'; // Default first step
    
    try {
        checkpoint = await getVideoCheckpoint(videoId);
        nextStep = getNextStep(checkpoint);
    } catch (error) {
        logger.warn('Failed to get checkpoint from Redis, starting from beginning', {
            videoId,
            error: error instanceof Error ? error.message : String(error)
        });
    }
    
    if (checkpoint) {
        logger.info('Resuming job from checkpoint', {
            videoId,
            nextStep,
            completed: Object.entries(checkpoint.completedSteps)
                .filter(([_, completed]) => completed)
                .map(([step, _]) => step),
            lastCompleted: checkpoint.lastCompletedStep,
            lastFailed: checkpoint.lastFailedStep
        });
        
        if (checkpoint.lastFailedStep) {
            logger.warn('Previous failure detected, resuming from checkpoint', {
                videoId,
                lastFailedStep: checkpoint.lastFailedStep,
                resumingFrom: nextStep
            });
        }
    } else {
        logger.info('Starting new job', { videoId });
    }

    // Получаем userId из базы данных с retry механизмом для transient ошибок
    const video = await withRetry(() => 
        prisma.video.findUnique({
            where: { videoId },
            select: { userId: true }
        })
    );

    if (!video) {
        throw new Error(`Video with ID ${videoId} not found`);
    }

    // Получаем текущее количество попыток из метаданных задачи
    const attemptsMade = job.attemptsMade || 0;
    const maxAttempts = 3; // Максимальное количество попыток

    // Если это повторная попытка, уведомляем пользователя
    if (attemptsMade > 0) {
        const stepToRetry = nextStep !== 'completed' ? nextStep : (checkpoint?.lastFailedStep || 'unknown');
        logger.info('Retry attempt', {
            videoId,
            attemptsMade,
            maxAttempts,
            stepToRetry
        });
        
        await setVideoProgress(videoId, {
            status: 'retrying',
            step: `Повторная попытка ${attemptsMade}/${maxAttempts} (шаг: ${stepToRetry})...`,
            retryCount: attemptsMade,
            maxRetries: maxAttempts,
            retryReason: `Возникла временная ошибка на шаге "${stepToRetry}", пытаемся снова`,
            currentStepId: stepToRetry, // Добавляем точную информацию о шаге
            timestamp: Date.now(),
            userId: video.userId
        }).catch(err => logger.warn('Redis retry notification failed', { error: err.message }));

        // Добавляем небольшую задержку перед повторной попыткой
        await new Promise(resolve => setTimeout(resolve, 2000 * attemptsMade));
    }

    try {
        await processVideo(videoId, video.userId);
        
        // Устанавливаем завершенный статус
        await setVideoProgress(videoId, {
            status: 'completed',
            timestamp: Date.now(),
            userId: video.userId
        }).catch(err => logger.warn('Redis progress update failed', { error: err.message }));

        // Удаляем прогресс через 30 секунд - ЗАКОММЕНТИРОВАНО для экономии Redis запросов
        // TTL автоматически удалит через 1 час (VIDEO_PROGRESS_TTL)
        // setTimeout(() => {
        //     deleteVideoProgress(videoId).catch(err => 
        //         logger.warn('Redis progress cleanup failed', { error: err.message })
        //     );
        // }, 30000);

        logger.info('Completed processing', { videoId });
    } catch (error) {
        logger.error('Error processing video', {
            videoId,
            error: error instanceof Error ? error.message : String(error)
        });

        // Получаем checkpoint для определения проблемного шага
        const checkpoint = await getVideoCheckpoint(videoId);
        const failedStep = getNextStep(checkpoint);
        
        // Определяем, стоит ли делать ретрай
        const attemptNumber = attemptsMade + 1;
        const shouldRetry = attemptNumber < maxAttempts && isRetryableError(error);
        
        if (shouldRetry) {
            logger.info('Will retry from step', {
                videoId,
                failedStep,
                attemptNumber,
                maxAttempts
            });
        } else {
            logger.warn('Final failure, no more retries', {
                videoId,
                failedStep
            });
        }
        
        // Используем уже полученный video из области видимости выше
        if (video) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            const msg = errorMessage.toLowerCase(); // Normalize для case-insensitive проверок
            let userFriendlyError = 'Произошла техническая ошибка';
            
            if (msg.includes('fetch failed') || msg.includes('connect timeout') || msg.includes('etimedout')) {
                userFriendlyError = 'Проблема с подключением к внешним сервисам';
            } else if (msg.includes('api') || msg.includes('assemblyai')) {
                userFriendlyError = 'Временная недоступность сервиса субтитров';
            } else if (msg.includes('s3') || msg.includes('upload')) {
                userFriendlyError = 'Проблема с загрузкой файлов';
            }

            await setVideoProgress(videoId, {
                status: 'error',
                error: shouldRetry ? 
                    `${userFriendlyError} на шаге "${failedStep}". Попытка ${attemptNumber} из ${maxAttempts}` : 
                    `${userFriendlyError} на шаге "${failedStep}"`,
                retryCount: shouldRetry ? attemptNumber : undefined,
                maxRetries: shouldRetry ? maxAttempts : undefined,
                lastError: errorMessage,
                timestamp: Date.now(),
                userId: video.userId
            }).catch(err => logger.warn('Redis error update failed', { error: err.message }));
        }

        // Обновляем БД только если это финальная ошибка
        if (!shouldRetry) {
            await withRetry(() => 
                prisma.video.update({
                    where: { videoId },
                    data: {
                        processing: false,
                        failed: true,
                    }
                })
            );
        }

        throw error;
    }
}, { 
    connection, 
    concurrency: 2
});

worker.on('completed', (job) => {
    logger.info('Job completed', { jobId: job?.id });
})

worker.on('failed', (job, err) => {
    logger.error('Job failed', {
        jobId: job?.id,
        error: err.message
    });
})

worker.on('error', (err) => {
    logger.error('Worker error', {
        error: err instanceof Error ? err.message : String(err)
    });
})

logger.info('Worker started, waiting for jobs', { version: '2' });
logger.info('Connected to Redis');

// Тестируем подключение к Redis при старте
testRedisConnection().then(success => {
  if (success) {
    logger.info('Redis progress tracking is ready');
  } else {
    logger.warn('Redis progress tracking is unavailable, but worker will continue');
  }
});

// Флаг для предотвращения множественных вызовов graceful shutdown
let isShuttingDown = false;

// Graceful shutdown - закрываем соединения при завершении процесса
const gracefulShutdown = async (signal: string, fatalError?: Error | boolean) => {
  // Предотвращаем повторные вызовы
  if (isShuttingDown) {
    logger.debug('Shutdown already in progress, ignoring signal', { signal });
    return;
  }
  
  isShuttingDown = true;
  logger.info('Graceful shutdown initiated', { signal, isFatal: !!fatalError });
  
  // Best-effort закрытие всех ресурсов (не прерываем на первой ошибке)
  // hadError = true если были ошибки при закрытии ресурсов ИЛИ если это фатальная ошибка
  let hadError = !!fatalError;
  
  // Закрываем Worker
  try {
    await worker.close();
    logger.info('Worker closed successfully');
  } catch (error) {
    hadError = true;
    logger.error('Error closing worker', { 
      error: error instanceof Error ? error.message : String(error) 
    });
  }
  
  // Закрываем Redis
  try {
    await connection.quit();
    logger.info('Redis connection closed successfully');
  } catch (error) {
    hadError = true;
    logger.error('Error closing Redis', { 
      error: error instanceof Error ? error.message : String(error) 
    });
  }
  
  // Закрываем Prisma
  try {
    await prisma.$disconnect();
    logger.info('Prisma connection closed successfully');
  } catch (error) {
    hadError = true;
    logger.error('Error closing Prisma', { 
      error: error instanceof Error ? error.message : String(error) 
    });
  }
  
  process.exit(hadError ? 1 : 0);
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
// Убираем beforeExit чтобы избежать конфликта с db.ts
// process.on('beforeExit', () => gracefulShutdown('beforeExit'));
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { 
    message: error.message,
    stack: error.stack
  });
  gracefulShutdown('uncaughtException', error); // Передаем error как фатальную ошибку
});
process.on('unhandledRejection', (reason: unknown) => {
  const msg = reason instanceof Error ? reason.message : String(reason);
  const stack = reason instanceof Error ? reason.stack : undefined;
  logger.error('Unhandled rejection', { 
    message: msg,
    stack
  });
  gracefulShutdown('unhandledRejection', true); // Передаем true как флаг фатальной ошибки
});