import { Queue } from "bullmq";
import { Redis } from "ioredis";

let redisConnection: Redis | null = null;
let videoQueueInstance: Queue | null = null;

function createRedisConnection(): Redis {
    if (!redisConnection) {
        // Логируем переменные окружения для отладки
        console.log('Creating Redis connection with config:');
        console.log('UPSTASH_REDIS_HOST:', process.env.UPSTASH_REDIS_HOST);
        console.log('UPSTASH_REDIS_PORT:', process.env.UPSTASH_REDIS_PORT);
        console.log('UPSTASH_REDIS_TOKEN:', process.env.UPSTASH_REDIS_TOKEN ? '[SET]' : '[NOT SET]');
        
        // Проверяем, что все необходимые переменные установлены
        if (!process.env.UPSTASH_REDIS_HOST || !process.env.UPSTASH_REDIS_TOKEN) {
            throw new Error('Missing required Redis configuration: UPSTASH_REDIS_HOST and UPSTASH_REDIS_TOKEN must be set');
        }
        
        redisConnection = new Redis({
            host: process.env.UPSTASH_REDIS_HOST,
            port: process.env.UPSTASH_REDIS_PORT ? parseInt(process.env.UPSTASH_REDIS_PORT) : 6379,
            password: process.env.UPSTASH_REDIS_TOKEN,
            tls: {},
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