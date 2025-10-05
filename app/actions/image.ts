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

/**
 * Определяет расширение файла на основе Content-Type
 */
const getFileExtensionFromContentType = (contentType: string): string => {
  if (contentType.includes('jpeg') || contentType.includes('jpg')) {
    return 'jpg';
  } else if (contentType.includes('png')) {
    return 'png';
  } else if (contentType.includes('webp')) {
    return 'webp';
  } else if (contentType.includes('gif')) {
    return 'gif';
  }
  return 'png'; // По умолчанию
};

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

    // Функция для извлечения URL из различных форматов
    const extractUrlFromValue = (value: any): string | null => {
      if (typeof value === 'string') {
        return value;
      }
      if (value && typeof value === 'object') {
        // СНАЧАЛА проверяем value.url как строку или объект (до проверки функции)
        if (value.url !== undefined) {
          // Случай 1: { url: "https://..." }
          if (typeof value.url === 'string') {
            return value.url;
          }
          // Случай 2: { url: { href: "..." } }
          if (typeof value.url === 'object' && value.url !== null && value.url.href) {
            if (typeof value.url.href === 'string') {
              return value.url.href;
            }
          }
          // Случай 3: { url: () => ... } - метод url()
          if (typeof value.url === 'function') {
            const urlResult = value.url();
            // url() может вернуть строку или объект с href
            if (typeof urlResult === 'string') {
              return urlResult;
            }
            if (urlResult && typeof urlResult === 'object' && urlResult.href) {
              return urlResult.href;
            }
          }
        }
        // Проверяем свойство href напрямую
        if (value.href && typeof value.href === 'string') {
          return value.href;
        }
        // Проверяем свойство output
        if (value.output) {
          // output может быть строкой, массивом или объектом
          if (typeof value.output === 'string') {
            return value.output;
          }
          if (Array.isArray(value.output) && value.output.length > 0) {
            return extractUrlFromValue(value.output[0]);
          }
          if (typeof value.output === 'object') {
            return extractUrlFromValue(value.output);
          }
        }
      }
      return null;
    };

    // Парсим результат от Replicate с защитой от различных форматов
    let imageUrl: string | null = null;
    
    if (Array.isArray(output)) {
      // Проверяем на пустой массив
      if (output.length === 0) {
        console.error(`Model ${model.name} returned empty array`);
        throw new Error(`Model ${model.name} returned empty array - no images generated`);
      }
      
      // Извлекаем URL из первого элемента массива
      imageUrl = extractUrlFromValue(output[0]);
      if (imageUrl) {
        console.log(`Model returned array format, extracted URL: ${imageUrl}`);
      }
    } else if (typeof output === 'string') {
      // Некоторые модели возвращают строку напрямую
      imageUrl = output;
      console.log(`Model returned string format: ${imageUrl}`);
    } else if (output && typeof output === 'object') {
      // Извлекаем URL из объекта
      imageUrl = extractUrlFromValue(output);
      if (imageUrl) {
        console.log(`Model returned object format, extracted URL: ${imageUrl}`);
      }
    }

    // Финальная проверка - удалось ли извлечь URL
    if (!imageUrl || typeof imageUrl !== 'string') {
      console.error(`Failed to extract valid URL from model ${model.name} output:`, JSON.stringify(output, null, 2));
      throw new Error(`Could not extract valid image URL from model ${model.name}. Output type: ${typeof output}, isArray: ${Array.isArray(output)}`);
    }

    // Дополнительная проверка что это похоже на URL
    if (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
      console.error(`Extracted value is not a valid URL from model ${model.name}:`, imageUrl);
      throw new Error(`Invalid URL format from model ${model.name}: ${imageUrl}`);
    }

    // Загружаем изображение и определяем его тип
    const response = await fetch(imageUrl);
    
    // Проверяем успешность запроса
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error(`Failed to fetch image from ${imageUrl}: ${response.status} ${response.statusText}`, errorText);
      throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
    }

    // Читаем изображение в буфер
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Определяем Content-Type из заголовков ответа
    const contentType = response.headers.get('content-type') || 'image/png';
    console.log(`Image content-type: ${contentType}`);

    // Определяем расширение файла на основе Content-Type
    const extension = getFileExtensionFromContentType(contentType);
    if (extension === 'png' && contentType !== 'image/png') {
      console.warn(`Unknown content-type: ${contentType}, defaulting to png`);
    }

    // Генерируем имя файла с правильным расширением
    const fileName = `${randomUUID()}.${extension}`;

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: fileName,
      Body: buffer,
      ContentType: contentType,
    });

    await s3Client.send(command);
    const s3Url = `https://${bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;
    console.log(`Successfully uploaded image to S3: ${fileName} (${contentType})`);
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
