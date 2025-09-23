import Redis from "ioredis";
import { Worker, Job } from "bullmq";
import { processVideo } from "@/app/actions/processes";
import { prisma } from "@/app/lib/db";

const connection = new Redis({
    host: process.env.UPSTASH_REDIS_HOST,
    port: process.env.UPSTASH_REDIS_PORT ? parseInt(process.env.UPSTASH_REDIS_PORT) : 6379,
    password: process.env.UPSTASH_REDIS_TOKEN || undefined,
    tls: {},
    maxRetriesPerRequest: null,
})

const worker = new Worker('video-processing', async (job: Job) => {
    const { videoId } = job.data;
    console.log(`Processing job for videoId: ${videoId}`);

    try {
        await processVideo(videoId);
        console.log(`Completed processing for videoId: ${videoId}`);
    } catch (error) {
        console.error(`Error processing videoId ${videoId}:`, error);

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

console.log('worker started, waiting for jobs')
console.log('connected to redis ')