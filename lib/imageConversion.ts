import sharp from "sharp";
import { logger } from "@/lib/logger";

// Target aspect ratio for vertical videos (9:16)
const TARGET_ASPECT_RATIO = 9 / 16;

// Standard height for vertical videos
const TARGET_HEIGHT = 1792;

// Tolerance for aspect ratio comparison (5%)
const ASPECT_RATIO_TOLERANCE = 0.05;

/**
 * Результат конвертации изображения
 */
export interface ConversionResult {
  buffer: Buffer;
  converted: boolean; // true если была выполнена конвертация в PNG
}

/**
 * Конвертирует изображение в формат 9:16 (вертикальное видео)
 * 
 * Обрабатывает квадратные изображения (например, 512x512 от DALL-E 2) и
 * конвертирует их в вертикальный формат 9:16 (1008x1792) для использования в видео.
 * 
 * Поведение:
 * - Если изображение уже близко к 9:16 (в пределах 5%), возвращается без изменений
 * - Квадратные и другие форматы конвертируются с использованием 'cover' режима
 * - В случае ошибки возвращается оригинальное изображение
 * - При конвертации выход всегда в формате PNG
 * 
 * @param inputBuffer - Буфер входного изображения
 * @param modelId - ID модели для логирования
 * @returns Объект с буфером изображения и флагом конвертации
 */
export const convertTo9x16 = async (
  inputBuffer: Buffer,
  modelId: string
): Promise<ConversionResult> => {
  try {
    // Validate input buffer
    if (!inputBuffer || inputBuffer.length === 0) {
      logger.error('Invalid input buffer: empty or null', { modelId });
      throw new Error('Input buffer is empty or null');
    }

    const metadata = await sharp(inputBuffer).metadata();
    const originalWidth = metadata.width || 512;
    const originalHeight = metadata.height || 512;
    const originalRatio = originalWidth / originalHeight;
    const targetRatio = TARGET_ASPECT_RATIO;

    logger.info('Converting image to 9:16 format', {
      modelId,
      originalSize: `${originalWidth}x${originalHeight}`,
      originalRatio: originalRatio.toFixed(2),
      targetRatio: targetRatio.toFixed(2)
    });

    // Если уже близко к 9:16 (в пределах tolerance), не обрабатываем
    if (Math.abs(originalRatio - targetRatio) < ASPECT_RATIO_TOLERANCE) {
      logger.info('Image already close to 9:16, skipping conversion');
      return { buffer: inputBuffer, converted: false };
    }

    // Целевые размеры для 9:16
    // Используем высоту как базу и вычисляем ширину
    const targetHeight = TARGET_HEIGHT;
    const targetWidth = Math.round(targetHeight * targetRatio);

    // Используем cover для заполнения всего кадра с обрезкой
    // Это обеспечивает что важный контент останется по центру
    const processedBuffer = await sharp(inputBuffer)
      .resize(targetWidth, targetHeight, {
        fit: 'cover', // Обрезает изображение для заполнения целевых размеров
        position: 'center', // Центрирует контент
      })
      .png() // Конвертируем в PNG для единообразия
      .toBuffer();

    logger.info('Image successfully converted to 9:16', {
      modelId,
      outputSize: `${targetWidth}x${targetHeight}`,
      originalSize: inputBuffer.length,
      processedSize: processedBuffer.length
    });

    return { buffer: processedBuffer, converted: true };
  } catch (error) {
    logger.error('Error converting image to 9:16', {
      modelId,
      error: error instanceof Error ? error.message : String(error)
    });
    // В случае ошибки возвращаем оригинал
    logger.warn('Returning original image due to conversion error');
    return { buffer: inputBuffer, converted: false };
  }
};
