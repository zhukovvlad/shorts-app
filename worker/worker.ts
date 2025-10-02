import Redis from "ioredis";
import { Worker, Job } from "bullmq";
import { processVideo } from "@/app/actions/processes";
import { prisma } from "@/app/lib/db";
import { setVideoProgress, deleteVideoProgress, testRedisConnection } from "@/lib/redis";

// Логируем переменные окружения для отладки
console.log('Environment variables check:');
console.log('UPSTASH_REDIS_HOST:', process.env.UPSTASH_REDIS_HOST);
console.log('UPSTASH_REDIS_PORT:', process.env.UPSTASH_REDIS_PORT);
console.log('UPSTASH_REDIS_TOKEN:', process.env.UPSTASH_REDIS_TOKEN ? '[SET]' : '[NOT SET]');

const connection = new Redis({
    host: process.env.UPSTASH_REDIS_HOST,
    port: process.env.UPSTASH_REDIS_PORT ? parseInt(process.env.UPSTASH_REDIS_PORT) : 6379,
    password: process.env.UPSTASH_REDIS_TOKEN || undefined,
    tls: {},
    maxRetriesPerRequest: null,
})

// Добавляем обработку ошибок для воркера
connection.on('error', (err) => {
    console.error('Worker Redis connection error:', err);
});

connection.on('connect', () => {
    console.log('Worker Redis connected successfully');
});

const worker = new Worker('video-processing', async (job: Job) => {
    const { videoId } = job.data;
    console.log(`Processing job for videoId: ${videoId}`);

    try {
        // Получаем userId из базы данных
        const video = await prisma.video.findUnique({
            where: { videoId },
            select: { userId: true }
        });

        if (!video) {
            throw new Error(`Video with ID ${videoId} not found`);
        }

        // Устанавливаем начальный прогресс
        await setVideoProgress(videoId, {
            status: 'script',
            step: 'Генерация сценария...',
            timestamp: Date.now(),
            userId: video.userId
        }).catch(err => console.warn('Redis progress update failed:', err));

        await processVideo(videoId, video.userId);
        
        // Устанавливаем завершенный статус
        await setVideoProgress(videoId, {
            status: 'completed',
            timestamp: Date.now(),
            userId: video.userId
        }).catch(err => console.warn('Redis progress update failed:', err));

        // Удаляем прогресс через 30 секунд
        setTimeout(() => {
            deleteVideoProgress(videoId).catch(err => 
                console.warn('Redis progress cleanup failed:', err)
            );
        }, 30000);

        console.log(`Completed processing for videoId: ${videoId}`);
    } catch (error) {
        console.error(`Error processing videoId ${videoId}:`, error);

        // Получаем userId для установки ошибки в прогрессе
        const video = await prisma.video.findUnique({
            where: { videoId },
            select: { userId: true }
        });

        if (video) {
            await setVideoProgress(videoId, {
                status: 'error',
                error: error instanceof Error ? error.message : 'Unknown error',
                timestamp: Date.now(),
                userId: video.userId
            }).catch(err => console.warn('Redis error update failed:', err));
        }

        await prisma.video.update({
            where: { videoId },
            data: {
                processing: false,
                failed: true,
            }
        })

        throw error;
    }
}, { connection, concurrency: 2 });

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