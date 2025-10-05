import { Queue } from "bullmq";
import { Redis } from "ioredis";
import { logger } from "@/lib/logger";
import { createRedisConfig, validateRedisConfig } from "@/lib/redis-config";

let redisConnection: Redis | null = null;
let videoQueueInstance: Queue | null = null;

function createRedisConnection(): Redis {
    if (!redisConnection) {
        // Валидируем конфигурацию
        validateRedisConfig();
        
        // Создаем конфигурацию
        const config = createRedisConfig();
        
        logger.debug('Creating Redis connection with config', {
            host: config.host ? '[SET]' : '[NOT SET]',
            port: config.port ? '[SET]' : '[NOT SET]',
            username: config.username ? '[SET]' : '[NOT SET]',
            password: config.password ? '[SET]' : '[NOT SET]'
        });

        redisConnection = new Redis({
            ...config,
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