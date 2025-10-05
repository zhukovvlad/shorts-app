import Redis from "ioredis";
import { Worker, Job } from "bullmq";
import { processVideo } from "@/app/actions/processes";
import { prisma } from "@/app/lib/db";
import { setVideoProgress, deleteVideoProgress, testRedisConnection, getVideoCheckpoint, getNextStep, setRedisInstance } from "@/lib/redis";
import { createRedisConfig, validateRedisConfig } from "@/lib/redis-config";
import { workerLogger as logger } from "@/lib/logger";

// Функция для определения, стоит ли делать ретрай
function isRetryableError(error: unknown): boolean {
    if (!(error instanceof Error)) return false;
    
    const message = error.message.toLowerCase();
    
    // Ошибки, которые можно повторить
    const retryableErrors = [
        'fetch failed',
        'connect timeout',
        'econnreset',
        'enotfound',
        'timeout',
        'network error',
        'connection refused',
        'temporary failure',
        'service unavailable',
        'internal server error'
    ];
    
    return retryableErrors.some(retryableError => message.includes(retryableError));
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
    
    // Получаем checkpoint информацию для логирования
    const checkpoint = await getVideoCheckpoint(videoId);
    const nextStep = getNextStep(checkpoint);
    
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

    // Получаем userId из базы данных
    const video = await prisma.video.findUnique({
        where: { videoId },
        select: { userId: true }
    });

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
            let userFriendlyError = 'Произошла техническая ошибка';
            
            if (errorMessage.includes('fetch failed') || errorMessage.includes('Connect Timeout')) {
                userFriendlyError = 'Проблема с подключением к внешним сервисам';
            } else if (errorMessage.includes('API') || errorMessage.includes('assemblyai')) {
                userFriendlyError = 'Временная недоступность сервиса субтитров';
            } else if (errorMessage.includes('S3') || errorMessage.includes('upload')) {
                userFriendlyError = 'Проблема с загрузкой файлов';
            }

            await setVideoProgress(videoId, {
                status: shouldRetry ? 'error' : 'error',
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
            await prisma.video.update({
                where: { videoId },
                data: {
                    processing: false,
                    failed: true,
                }
            });
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

// Graceful shutdown - закрываем соединения при завершении процесса
const gracefulShutdown = async (signal: string) => {
  logger.info('Graceful shutdown initiated', { signal });
  
  try {
    await worker.close();
    logger.info('Worker closed successfully');
    
    await connection.quit();
    logger.info('Redis connection closed successfully');
    
    process.exit(0);
  } catch (error) {
    logger.error('Error during graceful shutdown', {
      error: error instanceof Error ? error.message : String(error)
    });
    process.exit(1);
  }
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));