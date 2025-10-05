import { Queue } from "bullmq";
import { Redis } from "ioredis";
import { logger } from "@/lib/logger";

let redisConnection: Redis | null = null;
let videoQueueInstance: Queue | null = null;

function createRedisConnection(): Redis {
    if (!redisConnection) {
        // Логируем переменные окружения для отладки
        logger.debug('Creating Redis connection with config', {
            host: process.env.TIMEWEB_REDIS_HOST,
            port: process.env.TIMEWEB_REDIS_PORT,
            username: process.env.TIMEWEB_REDIS_USERNAME ? '[SET]' : '[NOT SET]',
            password: process.env.TIMEWEB_REDIS_PASSWORD ? '[SET]' : '[NOT SET]'
        });
        
        // Проверяем, что все необходимые переменные установлены
        if (!process.env.TIMEWEB_REDIS_HOST || !process.env.TIMEWEB_REDIS_PASSWORD) {
            logger.error('Missing required Redis configuration: TIMEWEB_REDIS_HOST and TIMEWEB_REDIS_PASSWORD must be set');
            throw new Error('Missing required Redis configuration: TIMEWEB_REDIS_HOST and TIMEWEB_REDIS_PASSWORD must be set');
        }
        
        const port = process.env.TIMEWEB_REDIS_PORT ? parseInt(process.env.TIMEWEB_REDIS_PORT, 10) : 6379;
        if (isNaN(port)) {
            logger.error('TIMEWEB_REDIS_PORT must be a valid number', { port: process.env.TIMEWEB_REDIS_PORT });
            throw new Error('TIMEWEB_REDIS_PORT must be a valid number');
        }

        redisConnection = new Redis({
            host: process.env.TIMEWEB_REDIS_HOST,
            port,
            username: process.env.TIMEWEB_REDIS_USERNAME,
            password: process.env.TIMEWEB_REDIS_PASSWORD,
            maxRetriesPerRequest: null,
            // lazyConnect: true помогает избежать создания подключения до первого использования
            lazyConnect: false, // BullMQ требует немедленного подключения
        });
        
        // Добавляем обработку ошибок
        redisConnection.on('error', (err) => {
            logger.error('Queue Redis connection error', { error: err.message });
        });
        
        redisConnection.on('connect', () => {
            logger.info('Queue Redis connected successfully');
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