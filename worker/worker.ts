import Redis from "ioredis";
import { Worker, Job } from "bullmq";
import { processVideo } from "@/app/actions/processes";
import { prisma } from "@/app/lib/db";
import { setVideoProgress, deleteVideoProgress, testRedisConnection, getVideoCheckpoint, getNextStep, setRedisInstance } from "@/lib/redis";
import { createRedisConfig, validateRedisConfig } from "@/lib/redis-config";

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
console.log('Environment variables check:');
console.log('TIMEWEB_REDIS_HOST:', process.env.TIMEWEB_REDIS_HOST);
console.log('TIMEWEB_REDIS_PORT:', process.env.TIMEWEB_REDIS_PORT);
console.log('TIMEWEB_REDIS_USERNAME:', process.env.TIMEWEB_REDIS_USERNAME ? '[SET]' : '[NOT SET]');
console.log('TIMEWEB_REDIS_PASSWORD:', process.env.TIMEWEB_REDIS_PASSWORD ? '[SET]' : '[NOT SET]');

// Валидируем конфигурацию Redis при старте
validateRedisConfig();

const connection = new Redis(createRedisConfig())

// ✅ ВАЖНО: Переиспользуем это соединение для всех Redis операций
// Это предотвращает создание множественных подключений к Redis
setRedisInstance(connection);

// Добавляем обработку ошибок для воркера
connection.on('error', (err) => {
    console.error('Worker Redis connection error:', err);
});

connection.on('connect', () => {
    console.log('Worker Redis connected successfully');
});

const worker = new Worker('video-processing', async (job: Job) => {
    const { videoId } = job.data;
    
    // Получаем checkpoint информацию для логирования
    const checkpoint = await getVideoCheckpoint(videoId);
    const nextStep = getNextStep(checkpoint);
    
    if (checkpoint) {
        console.log(`🔄 Resuming job for videoId: ${videoId} from step: ${nextStep}`);
        console.log(`📊 Checkpoint state:`, {
            completed: Object.entries(checkpoint.completedSteps)
                .filter(([_, completed]) => completed)
                .map(([step, _]) => step),
            lastCompleted: checkpoint.lastCompletedStep,
            lastFailed: checkpoint.lastFailedStep
        });
        
        if (checkpoint.lastFailedStep) {
            console.log(`⚠️ Previous failure detected at step: ${checkpoint.lastFailedStep}`);
            console.log(`✅ Skipping already completed steps, resuming from: ${nextStep}`);
        }
    } else {
        console.log(`🆕 Starting new job for videoId: ${videoId}`);
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
        console.log(`🔄 Retry attempt ${attemptsMade} for videoId: ${videoId}, step: ${stepToRetry}`);
        
        await setVideoProgress(videoId, {
            status: 'retrying',
            step: `Повторная попытка ${attemptsMade}/${maxAttempts} (шаг: ${stepToRetry})...`,
            retryCount: attemptsMade,
            maxRetries: maxAttempts,
            retryReason: `Возникла временная ошибка на шаге "${stepToRetry}", пытаемся снова`,
            currentStepId: stepToRetry, // Добавляем точную информацию о шаге
            timestamp: Date.now(),
            userId: video.userId
        }).catch(err => console.warn('Redis retry notification failed:', err));

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
        }).catch(err => console.warn('Redis progress update failed:', err));

        // Удаляем прогресс через 30 секунд - ЗАКОММЕНТИРОВАНО для экономии Redis запросов
        // TTL автоматически удалит через 1 час (VIDEO_PROGRESS_TTL)
        // setTimeout(() => {
        //     deleteVideoProgress(videoId).catch(err => 
        //         console.warn('Redis progress cleanup failed:', err)
        //     );
        // }, 30000);

        console.log(`Completed processing for videoId: ${videoId}`);
    } catch (error) {
        console.error(`❌ Error processing videoId ${videoId}:`, error);

        // Получаем checkpoint для определения проблемного шага
        const checkpoint = await getVideoCheckpoint(videoId);
        const failedStep = getNextStep(checkpoint);
        
        // Определяем, стоит ли делать ретрай
        const attemptNumber = attemptsMade + 1;
        const shouldRetry = attemptNumber < maxAttempts && isRetryableError(error);
        
        if (shouldRetry) {
            console.log(`🔄 Will retry from step: ${failedStep} (attempt ${attemptNumber}/${maxAttempts})`);
        } else {
            console.log(`🛑 Final failure at step: ${failedStep} (no more retries)`);
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
            }).catch(err => console.warn('Redis error update failed:', err));
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
    console.log(`Job with videoId ${job?.id} has been completed`);
})

worker.on('failed', (job, err) => {
    console.log(`Job with videoId ${job?.id} has failed with error: ${err.message}`);
})

worker.on('error', (err) => {
    console.log('Worker error:', err);
})

console.log('Worker started, waiting for jobs - version 2')
console.log('Connected to redis')

// Тестируем подключение к Redis при старте
testRedisConnection().then(success => {
  if (success) {
    console.log('Redis progress tracking is ready');
  } else {
    console.warn('Redis progress tracking is unavailable, but worker will continue');
  }
});

// Graceful shutdown - закрываем соединения при завершении процесса
const gracefulShutdown = async (signal: string) => {
  console.log(`\n${signal} received, closing worker gracefully...`);
  
  try {
    await worker.close();
    console.log('Worker closed successfully');
    
    await connection.quit();
    console.log('Redis connection closed successfully');
    
    process.exit(0);
  } catch (error) {
    console.error('Error during graceful shutdown:', error);
    process.exit(1);
  }
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));