import { prisma, withRetry } from "../lib/db";
import Replicate from "replicate";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";
import { getModelById, getDefaultModel } from "@/lib/imageModels";
import { logger } from "@/lib/logger";
import OpenAI from "openai";
import { convertTo9x16 } from "@/lib/imageConversion";

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

// Поддержка обеих переменных окружения для обратной совместимости
// AWS_S3_BUCKET_NAME (предпочтительно) или AWS_BUCKET_NAME (legacy)
// Валидация перенесена в runtime (внутрь функций) для избежания import-time crashes
const bucketName = process.env.AWS_S3_BUCKET_NAME ?? process.env.AWS_BUCKET_NAME;

/**
 * Функция для извлечения URL из различных форматов вывода Replicate моделей
 * Поддерживает строки, объекты с url/href/output свойствами и вложенные структуры
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const extractUrlFromValue = (value: any): string | null => {
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

/**
 * Проверяет, является ли сообщение об ошибке связанной с модерацией контента
 * Выполняет case-insensitive проверку на ключевые фразы OpenAI safety system
 * @param errorMessage - Сообщение об ошибке для проверки
 * @returns true если ошибка связана с модерацией, false в противном случае
 */
const isSafetyError = (errorMessage: string): boolean => {
  const lower = errorMessage.toLowerCase();
  return lower.includes('safety system') || 
         lower.includes('content policy') ||
         lower.includes('rejected as a result');
};

/**
 * Генерация изображения через OpenAI DALL-E
 */
const processImageWithOpenAI = async (prompt: string, modelId: string): Promise<string> => {
  try {
    // Runtime валидация S3 bucket configuration
    if (!bucketName) {
      const errorMsg = 'S3 bucket name is not configured. Set AWS_S3_BUCKET_NAME (preferred) or AWS_BUCKET_NAME.';
      logger.error(errorMsg);
      throw new Error(errorMsg);
    }

    // Валидация API ключа
    if (!process.env.OPENAI_API_KEY) {
      const errorMsg = 'OPENAI_API_KEY is not configured. Please add your OpenAI API key to environment variables to use DALL-E models. You can obtain an API key at https://platform.openai.com/api-keys';
      logger.error(errorMsg);
      throw new Error(errorMsg);
    }

    // Ленивая инициализация OpenAI клиента только при необходимости
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const modelConfig = getModelById(modelId);
    if (!modelConfig || modelConfig.provider !== 'openai') {
      throw new Error(`Invalid OpenAI model: ${modelId}`);
    }

    logger.info(`Generating image with OpenAI: ${modelConfig.name} (${modelConfig.id})`);

    const params: OpenAI.Images.ImageGenerateParams = {
      model: modelConfig.openaiModel!,
      prompt: prompt,
      n: 1,
      response_format: 'url',
      ...modelConfig.defaultParams,
    };

    const response = await openai.images.generate(params);

    if (!response.data || response.data.length === 0) {
      logger.error('OpenAI returned no data');
      throw new Error('OpenAI did not return any data');
    }

    const imageUrl = response.data[0]?.url;
    if (!imageUrl) {
      logger.error('OpenAI returned no image URL');
      throw new Error('OpenAI did not return an image URL');
    }

    logger.info(`OpenAI generated image URL: ${imageUrl}`);

    // Загружаем изображение с OpenAI и сохраняем в S3
    // Добавляем timeout (30s) для предотвращения зависания
    const abortController1 = new AbortController();
    const timeout1 = setTimeout(() => abortController1.abort(), 30_000);
    const imageResponse = await fetch(imageUrl, { signal: abortController1.signal })
      .finally(() => clearTimeout(timeout1));
    
    if (!imageResponse.ok) {
      const errorText = await imageResponse.text().catch(() => 'Unknown error');
      logger.error('Failed to fetch image from OpenAI URL', {
        imageUrl,
        status: imageResponse.status,
        statusText: imageResponse.statusText,
        errorText
      });
      throw new Error(`Failed to fetch image: ${imageResponse.status} ${imageResponse.statusText}`);
    }

    const arrayBuffer = await imageResponse.arrayBuffer();
    let buffer: Buffer = Buffer.from(arrayBuffer);
    let convertedToPng = false;

    // Автоматическая конвертация в 9:16 для квадратных изображений (DALL-E 2)
    if (modelConfig.id === 'dall-e-2' || modelConfig.defaultParams.size === '512x512') {
      logger.info('Detected square image output, converting to 9:16');
      const result = await convertTo9x16(buffer, modelConfig.id);
      buffer = result.buffer;
      convertedToPng = result.converted;
    }

    let contentType = imageResponse.headers.get('content-type') || 'image/png';
    
    // Если изображение было сконвертировано в PNG, обновляем content-type
    if (convertedToPng) {
      contentType = 'image/png';
      logger.info('Image was converted to PNG, updating content-type');
    }
    
    logger.info(`Image content-type: ${contentType}`);

    const extension = getFileExtensionFromContentType(contentType);
    const fileName = `${randomUUID()}.${extension}`;

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: fileName,
      Body: buffer,
      ContentType: contentType,
    });

    await s3Client.send(command);
    const s3Url = `https://${bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;
    logger.info("OpenAI image uploaded to S3", { fileName, contentType });
    return s3Url;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Проверяем, является ли это ошибкой модерации контента
    if (isSafetyError(errorMessage)) {
      logger.warn("Image rejected by OpenAI safety system", {
        error: errorMessage,
        promptPreview: prompt.substring(0, 150)
      });
    } else {
      logger.error("Error processing image from OpenAI", {
        error: errorMessage
      });
    }
    
    throw error;
  }
};

const processImage = async (img: string, modelId?: string) => {
  try {
    // Получаем конфигурацию модели
    const modelConfig = modelId ? getModelById(modelId) : getDefaultModel();
    if (!modelConfig) {
      logger.warn(`Model ${modelId} not found, using default model`);
    }
    const model = modelConfig || getDefaultModel();

    // Маршрутизация в зависимости от провайдера
    if (model.provider === 'openai') {
      return await processImageWithOpenAI(img, model.id);
    }

    // Для Replicate моделей используем существующую логику
    if (!model.replicateModel) {
      throw new Error(`Model ${model.id} is missing replicateModel configuration`);
    }

    // Runtime валидация S3 bucket configuration для Replicate пути
    if (!bucketName) {
      const errorMsg = 'S3 bucket name is not configured. Set AWS_S3_BUCKET_NAME (preferred) or AWS_BUCKET_NAME.';
      logger.error(errorMsg);
      throw new Error(errorMsg);
    }

    logger.info(`Processing image with Replicate model: ${model.name} (${model.id})`);

    // Формируем параметры для модели
    const input = {
      prompt: img,
      ...model.defaultParams,
    };

    const output = await replicate.run(model.replicateModel as `${string}/${string}` | `${string}/${string}:${string}`, {
      input,
    });

    logger.info('Output type from model', {
      modelName: model.name,
      outputType: typeof output,
      isArray: Array.isArray(output)
    });

    // Парсим результат от Replicate с защитой от различных форматов
    let imageUrl: string | null = null;
    
    if (Array.isArray(output)) {
      // Проверяем на пустой массив
      if (output.length === 0) {
        logger.error(`Model ${model.name} returned empty array`);
        throw new Error(`Model ${model.name} returned empty array - no images generated`);
      }
      
      // Извлекаем URL из первого элемента массива
      imageUrl = extractUrlFromValue(output[0]);
      if (imageUrl) {
        logger.info(`Model returned array format, extracted URL: ${imageUrl}`);
      }
    } else if (typeof output === 'string') {
      // Некоторые модели возвращают строку напрямую
      imageUrl = output;
      logger.info(`Model returned string format: ${imageUrl}`);
    } else if (output && typeof output === 'object') {
      // Извлекаем URL из объекта
      imageUrl = extractUrlFromValue(output);
      if (imageUrl) {
        logger.info(`Model returned object format, extracted URL: ${imageUrl}`);
      }
    }

    // Финальная проверка - удалось ли извлечь URL
    if (!imageUrl || typeof imageUrl !== 'string') {
      const outPreview = (() => {
        try { return JSON.stringify(output).slice(0, 2000); } catch { return '[unserializable]'; }
      })();
      logger.error('Failed to extract valid URL from model output', {
        modelName: model.name,
        outputPreview: outPreview
      });
      throw new Error(`Could not extract valid image URL from model ${model.name}. Output type: ${typeof output}, isArray: ${Array.isArray(output)}`);
    }

    // Дополнительная проверка что это похоже на URL
    if (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
      logger.error('Extracted value is not a valid URL', {
        modelName: model.name,
        extractedValue: imageUrl
      });
      throw new Error(`Invalid URL format from model ${model.name}: ${imageUrl}`);
    }

    // Загружаем изображение и определяем его тип
    // Добавляем timeout (30s) для предотвращения зависания
    const abortController2 = new AbortController();
    const timeout2 = setTimeout(() => abortController2.abort(), 30_000);
    const response = await fetch(imageUrl, { signal: abortController2.signal })
      .finally(() => clearTimeout(timeout2));
    
    // Проверяем успешность запроса
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      logger.error('Failed to fetch image from URL', {
        imageUrl,
        status: response.status,
        statusText: response.statusText,
        errorText
      });
      throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
    }

    // Читаем изображение в буфер
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Определяем Content-Type из заголовков ответа
    const contentType = response.headers.get('content-type') || 'image/png';
    logger.info(`Image content-type: ${contentType}`);

    // Определяем расширение файла на основе Content-Type
    const extension = getFileExtensionFromContentType(contentType);
    if (extension === 'png' && contentType !== 'image/png') {
      logger.warn(`Unknown content-type: ${contentType}, defaulting to png`);
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
    logger.info("Image uploaded to S3", { fileName, contentType });
    return s3Url;
  } catch (error) {
    logger.error("Error processing image from replicate", {
      error: error instanceof Error ? error.message : String(error)
    });
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
        logger.info(`Using imageModel from metadata: ${modelId}`);
      }
    } catch (redisError) {
      logger.warn('Failed to get imageModel from Redis, will use default', {
        error: redisError instanceof Error ? redisError.message : String(redisError)
      });
    }

    // Вспомогательная функция: пытаемся переписать промпт через OpenAI так, чтобы
    // он соответствовал политике безопасности, но сохранял исходный смысл.
    const sanitizePromptWithOpenAI = async (originalPrompt: string, maxRetries = 3) => {
      if (!process.env.OPENAI_API_KEY) {
        logger.warn('OPENAI_API_KEY not available for prompt sanitization');
        return null;
      }

      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      const systemInstruction = `You are a helpful assistant that rewrites image-generation prompts to conform with content safety policies. Rewrite the user's prompt to remove or soften any potentially disallowed content (violence, sexual content, hate, graphic descriptions, real-person or public figure likenesses) but preserve the original intent, composition, style, and important adjectives when possible. Return only the rewritten prompt text and nothing else.`;

      let attempt = 0;
      while (attempt < maxRetries) {
        attempt += 1;
        // Добавляем timeout (30s) для предотвращения зависания
        const abortController = new AbortController();
        const timeout = setTimeout(() => abortController.abort(), 30_000);
        
        try {
          const chat = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: systemInstruction },
              { role: 'user', content: originalPrompt }
            ],
            temperature: 0.2,
            max_tokens: 200
          }, {
            signal: abortController.signal
          });

          const sanitized = chat.choices?.[0]?.message?.content?.trim();
          if (sanitized && sanitized.length > 0) {
            logger.info('Sanitized prompt via OpenAI', { attempt, preview: sanitized.substring(0, 120) });
            return sanitized;
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          logger.warn('Prompt sanitization attempt failed', { attempt, error: msg });
          // на ошибки модерации/таймауты — сделаем retry
        } finally {
          clearTimeout(timeout);
        }
      }

      logger.warn('Prompt sanitization exhausted retries', { originalPreview: originalPrompt.substring(0, 120), retries: maxRetries });
      return null;
    };

    // Обрабатываем каждое изображение отдельно с попытками исправления модерации
    // Используем ограниченный параллелизм для избежания rate limits (максимум 3 одновременно)
    const processImageWithRetry = async (img: string, index: number) => {
      try {
        return await processImage(img, modelId);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        if (!isSafetyError(errorMessage)) {
          logger.error(`Failed to generate image ${index + 1}`, {
            videoId,
            error: errorMessage
          });
          throw error;
        }

        // Это модерационная ошибка — попробуем несколько раз переписать промпт и повторить
        logger.warn(`Image ${index + 1} rejected by safety system - attempting sanitization`, {
          videoId,
          promptPreview: img.substring(0, 120),
          error: errorMessage
        });

        const maxSanitizeRetries = 3;
        for (let attempt = 1; attempt <= maxSanitizeRetries; attempt += 1) {
          const sanitized = await sanitizePromptWithOpenAI(img, 1);
          if (!sanitized) {
            logger.warn('Sanitization returned empty, continuing to next attempt', { attempt, videoId, index });
            continue;
          }

          try {
            const result = await processImage(sanitized, modelId);
            logger.info(`Sanitization succeeded on attempt ${attempt} for image ${index + 1}`, { videoId, attempt });
            return result;
          } catch (retryErr) {
            const retryMsg = retryErr instanceof Error ? retryErr.message : String(retryErr);
            logger.warn(`Sanitized prompt attempt ${attempt} failed`, { videoId, attempt, retryError: retryMsg });
            // Если после санитизации всё ещё модерация — продолжаем цикл
            if (!isSafetyError(retryMsg)) {
              // техническая ошибка — пробрасываем
              throw retryErr;
            }
          }
        }

        // Все попытки стерилизации не помогли — логируем и возвращаем null
        logger.warn(`All sanitization retries failed for image ${index + 1}, skipping image`, { videoId, index });
        return null;
      }
    };

    // Ограничиваем параллелизм: обрабатываем не более 3 изображений одновременно
    const CONCURRENCY_LIMIT = 3;
    const imageResults: (string | null)[] = [];
    
    for (let i = 0; i < video.imagePrompts.length; i += CONCURRENCY_LIMIT) {
      const chunk = video.imagePrompts.slice(i, i + CONCURRENCY_LIMIT);
      const chunkResults = await Promise.all(
        chunk.map((img, chunkIndex) => processImageWithRetry(img, i + chunkIndex))
      );
      imageResults.push(...chunkResults);
    }
    
    // Фильтруем null значения (отклоненные изображения)
    const imageLinks = imageResults.filter((link): link is string => link !== null);
    
    // Проверяем, что хотя бы одно изображение было сгенерировано
    if (imageLinks.length === 0) {
      const error = new Error('All images were rejected by safety system or failed to generate');
      logger.error('No images could be generated', {
        videoId,
        totalPrompts: video.imagePrompts.length
      });
      throw error;
    }
    
    logger.info("Generated image links", {
      videoId,
      count: imageLinks.length,
      total: video.imagePrompts.length,
      rejectedCount: video.imagePrompts.length - imageLinks.length
    });

    await withRetry(() =>
      prisma.video.update({
        where: { videoId },
        data: { imageLinks, thumbnail: imageLinks[0] },
      })
    );
  } catch (error) {
    logger.error("Error generating images", {
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
};
