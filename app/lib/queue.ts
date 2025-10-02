import { Queue } from "bullmq";
import { Redis } from "ioredis";
import { logger } from "@/lib/logger";

let redisConnection: Redis | null = null;
let videoQueueInstance: Queue | null = null;

function createRedisConnection(): Redis {
    if (!redisConnection) {
        // Логируем переменные окружения для отладки
        logger.debug('Creating Redis connection with config', {
            host: process.env.UPSTASH_REDIS_HOST,
            port: process.env.UPSTASH_REDIS_PORT,
            token: process.env.UPSTASH_REDIS_TOKEN ? '[SET]' : '[NOT SET]'
        });
        
        // Проверяем, что все необходимые переменные установлены
        if (!process.env.UPSTASH_REDIS_HOST || !process.env.UPSTASH_REDIS_TOKEN) {
            logger.error('Missing required Redis configuration: UPSTASH_REDIS_HOST and UPSTASH_REDIS_TOKEN must be set');
            throw new Error('Missing required Redis configuration: UPSTASH_REDIS_HOST and UPSTASH_REDIS_TOKEN must be set');
        }
        
        const port = process.env.UPSTASH_REDIS_PORT ? parseInt(process.env.UPSTASH_REDIS_PORT, 10) : 6379;
        if (isNaN(port)) {
            logger.error('UPSTASH_REDIS_PORT must be a valid number', { port: process.env.UPSTASH_REDIS_PORT });
            throw new Error('UPSTASH_REDIS_PORT must be a valid number');
        }

        redisConnection = new Redis({
            host: process.env.UPSTASH_REDIS_HOST,
            port,
            password: process.env.UPSTASH_REDIS_TOKEN,
            tls: { rejectUnauthorized: true },
            maxRetriesPerRequest: null,
        });
    }
    return redisConnection;
}

export function getVideoQueue(): Queue {
    if (!videoQueueInstance) {
        const connection = createRedisConnection();
        videoQueueInstance = new Queue("video-processing", {
            connection,
            defaultJobOptions: {
                removeOnComplete: 10,
                removeOnFail: 5,
            }
        });
    }
    return videoQueueInstance;
}

// Экспортируем getter вместо прямого экземпляра
export const videoQueue = {
    get instance() {
        return getVideoQueue();
    },
    add: (...args: Parameters<Queue['add']>) => getVideoQueue().add(...args),
    getJob: (...args: Parameters<Queue['getJob']>) => getVideoQueue().getJob(...args),
    // Добавляем другие методы по мере необходимости
};