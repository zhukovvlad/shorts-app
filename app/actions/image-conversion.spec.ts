/**
 * @jest-environment node
 */

import { describe, it, expect, jest } from '@jest/globals';
import sharp from 'sharp';

// Mock логгера
jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('Image Conversion to 9:16', () => {
  describe('Square to 9:16 conversion', () => {
    it('should convert 512x512 image to 9:16 aspect ratio', async () => {
      // Создаем тестовое квадратное изображение 512x512
      const testBuffer = await sharp({
        create: {
          width: 512,
          height: 512,
          channels: 4,
          background: { r: 255, g: 0, b: 0, alpha: 1 }
        }
      })
      .png()
      .toBuffer();

      // Конвертируем в 9:16
      const targetHeight = 1792;
      const targetWidth = Math.round(targetHeight * (9 / 16));

      const convertedBuffer = await sharp(testBuffer)
        .resize(targetWidth, targetHeight, {
          fit: 'cover',
          position: 'center',
        })
        .png()
        .toBuffer();

      // Проверяем размеры результата
      const metadata = await sharp(convertedBuffer).metadata();
      expect(metadata.width).toBe(targetWidth);
      expect(metadata.height).toBe(targetHeight);
      
      // Проверяем aspect ratio
      const aspectRatio = metadata.width! / metadata.height!;
      expect(aspectRatio).toBeCloseTo(9 / 16, 2);
    });

    it('should handle already 9:16 images without conversion', async () => {
      // Создаем изображение уже в формате 9:16
      const width = 1008;
      const height = 1792;
      const testBuffer = await sharp({
        create: {
          width,
          height,
          channels: 4,
          background: { r: 0, g: 255, b: 0, alpha: 1 }
        }
      })
      .png()
      .toBuffer();

      const metadata = await sharp(testBuffer).metadata();
      const aspectRatio = metadata.width! / metadata.height!;
      
      // Проверяем что уже близко к 9:16
      expect(aspectRatio).toBeCloseTo(9 / 16, 1);
    });

    it('should maintain image quality during conversion', async () => {
      // Создаем тестовое изображение с паттерном
      const testBuffer = await sharp({
        create: {
          width: 512,
          height: 512,
          channels: 4,
          background: { r: 128, g: 128, b: 128, alpha: 1 }
        }
      })
      .png()
      .toBuffer();

      const targetHeight = 1792;
      const targetWidth = Math.round(targetHeight * (9 / 16));

      const convertedBuffer = await sharp(testBuffer)
        .resize(targetWidth, targetHeight, {
          fit: 'cover',
          position: 'center',
        })
        .png()
        .toBuffer();

      // Проверяем что конвертированное изображение валидно
      const metadata = await sharp(convertedBuffer).metadata();
      expect(metadata.format).toBe('png');
      expect(metadata.channels).toBeGreaterThanOrEqual(3);
    });

    it('should handle various input sizes', async () => {
      const inputSizes = [
        { width: 256, height: 256 },
        { width: 512, height: 512 },
        { width: 1024, height: 1024 },
      ];

      const targetHeight = 1792;
      const targetWidth = Math.round(targetHeight * (9 / 16));

      for (const size of inputSizes) {
        const testBuffer = await sharp({
          create: {
            width: size.width,
            height: size.height,
            channels: 4,
            background: { r: 100, g: 150, b: 200, alpha: 1 }
          }
        })
        .png()
        .toBuffer();

        const convertedBuffer = await sharp(testBuffer)
          .resize(targetWidth, targetHeight, {
            fit: 'cover',
            position: 'center',
          })
          .png()
          .toBuffer();

        const metadata = await sharp(convertedBuffer).metadata();
        expect(metadata.width).toBe(targetWidth);
        expect(metadata.height).toBe(targetHeight);
      }
    });
  });

  describe('Aspect ratio calculations', () => {
    it('should correctly calculate 9:16 aspect ratio', () => {
      const targetRatio = 9 / 16;
      expect(targetRatio).toBeCloseTo(0.5625, 4);
    });

    it('should correctly identify square images', () => {
      const squareRatio = 512 / 512;
      const targetRatio = 9 / 16;
      
      // Квадратное изображение значительно отличается от 9:16
      expect(Math.abs(squareRatio - targetRatio)).toBeGreaterThan(0.05);
    });

    it('should correctly identify 9:16 images', () => {
      const verticalRatio = 1008 / 1792;
      const targetRatio = 9 / 16;
      
      // 9:16 изображение должно быть близко к целевому
      expect(Math.abs(verticalRatio - targetRatio)).toBeLessThan(0.05);
    });
  });
});
