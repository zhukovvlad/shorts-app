import { prisma } from "../lib/db";
import Replicate from "replicate";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";
import { getModelById, getDefaultModel } from "@/lib/imageModels";

interface ReplicateOutput {
  url: () => URL;
}

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_KEY,
});

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const bucketName = process.env.AWS_S3_BUCKET_NAME!;

const processImage = async (img: string, modelId?: string) => {
  try {
    // Получаем конфигурацию модели
    const modelConfig = modelId ? getModelById(modelId) : getDefaultModel();
    if (!modelConfig) {
      console.warn(`Model ${modelId} not found, using default model`);
    }
    const model = modelConfig || getDefaultModel();

    console.log(`Processing image with model: ${model.name} (${model.id})`);

    // Формируем параметры для модели
    const input = {
      prompt: img,
      ...model.defaultParams,
    };

    const output = await replicate.run(model.replicateModel as `${string}/${string}` | `${string}/${string}:${string}`, {
      input,
    });

    console.log(`Output type from ${model.name}:`, typeof output, Array.isArray(output) ? '(array)' : '');

    // Разные модели возвращают результат в разных форматах
    let imageUrl: string;
    
    if (Array.isArray(output)) {
      // FLUX Schnell и Dev модели возвращают массив URL
      imageUrl = output[0];
      console.log(`Model returned array format, using first URL: ${imageUrl}`);
    } else if (typeof output === 'string') {
      // Некоторые модели возвращают строку напрямую
      imageUrl = output;
      console.log(`Model returned string format: ${imageUrl}`);
    } else if (output && typeof output === 'object') {
      // Ideogram и FLUX Pro возвращают объект
      const replicateOutput = output as any;
      
      // Проверяем, есть ли метод url()
      if (typeof replicateOutput.url === 'function') {
        const image = replicateOutput.url();
        imageUrl = image.href;
        console.log(`Model returned object format with url() method: ${imageUrl}`);
      } else if (replicateOutput.output) {
        // Некоторые модели возвращают {output: "url"}
        imageUrl = replicateOutput.output;
        console.log(`Model returned object with output property: ${imageUrl}`);
      } else {
        console.error(`Unexpected object format from model ${model.name}:`, output);
        throw new Error(`Unsupported object format from model ${model.name}`);
      }
    } else {
      console.error(`Unexpected output format from model ${model.name}:`, output);
      throw new Error(`Unsupported output format from model ${model.name}`);
    }

    const response = await fetch(imageUrl);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const fileName = `${randomUUID()}.png`;

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: fileName,
      Body: buffer,
      ContentType: "image/png",
    });

    await s3Client.send(command);
    const s3Url = `https://${bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;
    return s3Url;
  } catch (error) {
    console.log("Error processing image from replicate:", error);
    throw error;
  }
};

export const generateImages = async (videoId: string) => {
  try {
    const video = await prisma.video.findUnique({
      where: { videoId },
    });

    if (!video) {
      return null;
    }

    // Получаем imageModel из Redis metadata
    let modelId: string | undefined;
    try {
      const { getVideoMetadata } = await import('@/lib/redis');
      const metadata = await getVideoMetadata(videoId);
      modelId = metadata?.imageModel;
      if (modelId) {
        console.log(`Using imageModel from metadata: ${modelId}`);
      }
    } catch (redisError) {
      console.warn('Failed to get imageModel from Redis, will use default:', redisError);
    }

    const imagePromises = video.imagePrompts.map((img) => processImage(img, modelId));

    const imageLinks = await Promise.all(imagePromises);
    console.log("Generated image links:", imageLinks);

    await prisma.video.update({
      where: { videoId },
      data: { imageLinks: imageLinks, thumbnail: imageLinks[0] },
    });
  } catch (error) {
    console.log("Error generating images:", error);
    throw error;
  }
};
