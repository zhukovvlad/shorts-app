import { prisma, withRetry } from "../lib/db";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { randomUUID } from "crypto";
import { Readable } from "stream";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { logger } from "@/lib/logger";

const client = new ElevenLabsClient({
  apiKey: process.env.ELEVENLABS_API_KEY!,
});

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

// Поддержка обеих переменных окружения для обратной совместимости
// AWS_S3_BUCKET_NAME (предпочтительно) или AWS_BUCKET_NAME (legacy)
const bucketName = process.env.AWS_S3_BUCKET_NAME ?? process.env.AWS_BUCKET_NAME;

export const generateAudio = async (videoId: string) => {
  try {
    // Валидация конфигурации S3 bucket
    if (!bucketName) {
      logger.error('S3 bucket name is not configured. Set AWS_S3_BUCKET_NAME (preferred) or AWS_BUCKET_NAME.');
      return undefined;
    }

    const video = await prisma.video.findUnique({
      where: { videoId },
    });
    if (!video || !video.content) {
      return undefined;
    }

    logger.debug("Starting audio generation");

    const webStream = await client.textToSpeech.stream(
      "JBFqnCBsd6RMkjVDRZzb",
      {
        text: video.content,
        modelId: "eleven_multilingual_v2",
        outputFormat: "mp3_44100_128", // output_format
      }
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const audioStream = Readable.fromWeb(
      webStream as any
    );

    const chunks: Buffer[] = [];
    for await (const chunk of audioStream) {
      chunks.push(chunk);
    }

    const audioBuffer = Buffer.concat(chunks);
    const fileName = `${randomUUID()}.mp3`;

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: fileName,
      Body: audioBuffer,
      ContentType: "audio/mpeg",
    });

    await s3Client.send(command);

    const s3Url = `https://${bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;
    logger.info("Audio uploaded to S3", { fileName });

    await withRetry(() =>
      prisma.video.update({
        where: { videoId },
        data: { audio: s3Url },
      })
    );

  } catch (error) {
    logger.error("Error generating audio", {
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
};
