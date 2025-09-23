import { Queue } from "bullmq";
import { Redis } from "ioredis";

const connection = new Redis({
    host: process.env.UPSTASH_REDIS_HOST,
    port: process.env.UPSTASH_REDIS_PORT ? parseInt(process.env.UPSTASH_REDIS_PORT) : 6379,
    password: process.env.UPSTASH_REDIS_TOKEN || undefined,
    tls: {},
    maxRetriesPerRequest: null,
})

export const videoQueue = new Queue("video-processing", {
    connection,
    defaultJobOptions: {
        removeOnComplete: 10,
        removeOnFail: 5,
    }
});