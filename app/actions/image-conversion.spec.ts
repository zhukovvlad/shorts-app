/**
 * @jest-environment node
 */

import { describe, it, expect, jest } from '@jest/globals';
import sharp from 'sharp';
import { convertTo9x16 } from '@/lib/imageConversion';

// Mock логгера
jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('Image Conversion to 9:16', () => {
  const TEST_MODEL_ID = 'dall-e-2';

  describe('Square to 9:16 conversion', () => {
    it('should convert 512x512 image to 9:16 aspect ratio with correct dimensions', async () => {
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

      const result = await convertTo9x16(testBuffer, TEST_MODEL_ID);

      expect(result.converted).toBe(true);
      
      const metadata = await sharp(result.buffer).metadata();
      const targetHeight = 1792;
      const targetWidth = Math.round(targetHeight * (9 / 16));
      
      expect(metadata.width).toBe(targetWidth);
      expect(metadata.height).toBe(targetHeight);
      expect(metadata.width).toBe(1008);
      expect(metadata.height).toBe(1792);
      
      const aspectRatio = metadata.width! / metadata.height!;
      expect(aspectRatio).toBeCloseTo(9 / 16, 2);
    });

    it('should output PNG format', async () => {
      const testBuffer = await sharp({
        create: {
          width: 512,
          height: 512,
          channels: 3,
          background: { r: 100, g: 100, b: 100 }
        }
      })
      .jpeg()
      .toBuffer();

      const result = await convertTo9x16(testBuffer, TEST_MODEL_ID);

      expect(result.converted).toBe(true);
      
      const metadata = await sharp(result.buffer).metadata();
      expect(metadata.format).toBe('png');
    });
  });

  describe('Near-9:16 skip path', () => {
    it('should skip conversion for images already close to 9:16 (within 5% tolerance)', async () => {
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

      const result = await convertTo9x16(testBuffer, TEST_MODEL_ID);

      expect(result.converted).toBe(false);

      const originalMetadata = await sharp(testBuffer).metadata();
      const convertedMetadata = await sharp(result.buffer).metadata();
      
      expect(convertedMetadata.width).toBe(originalMetadata.width);
      expect(convertedMetadata.height).toBe(originalMetadata.height);
    });

    it('should skip conversion for slightly off 9:16 images within tolerance', async () => {
      const width = 1000;
      const height = 1780;
      const testBuffer = await sharp({
        create: {
          width,
          height,
          channels: 4,
          background: { r: 0, g: 0, b: 255, alpha: 1 }
        }
      })
      .png()
      .toBuffer();

      const originalRatio = width / height;
      const targetRatio = 9 / 16;
      const difference = Math.abs(originalRatio - targetRatio);

      expect(difference).toBeLessThan(0.05);

      const result = await convertTo9x16(testBuffer, TEST_MODEL_ID);

      expect(result.converted).toBe(false);

      const convertedMetadata = await sharp(result.buffer).metadata();
      expect(convertedMetadata.width).toBe(width);
      expect(convertedMetadata.height).toBe(height);
    });
  });

  describe('Error fallback', () => {
    it('should return original buffer on conversion error', async () => {
      const invalidBuffer = Buffer.alloc(0);

      const result = await convertTo9x16(invalidBuffer, TEST_MODEL_ID);

      expect(result.converted).toBe(false);
      expect(result.buffer).toBe(invalidBuffer);
      expect(result.buffer.length).toBe(0);
    });

    it('should return original buffer if sharp throws error', async () => {
      const corruptedBuffer = Buffer.from('not an image data');

      const result = await convertTo9x16(corruptedBuffer, TEST_MODEL_ID);

      expect(result.converted).toBe(false);
      expect(result.buffer).toBe(corruptedBuffer);
    });
  });

  describe('Various input sizes', () => {
    it('should handle various square input sizes', async () => {
      const sizes = [256, 512, 1024];

      for (const size of sizes) {
        const testBuffer = await sharp({
          create: {
            width: size,
            height: size,
            channels: 4,
            background: { r: 128, g: 128, b: 128, alpha: 1 }
          }
        })
        .png()
        .toBuffer();

        const result = await convertTo9x16(testBuffer, TEST_MODEL_ID);
        
        expect(result.converted).toBe(true);
        
        const metadata = await sharp(result.buffer).metadata();

        expect(metadata.width).toBe(1008);
        expect(metadata.height).toBe(1792);
        expect(metadata.format).toBe('png');
      }
    });
  });

  describe('Image quality', () => {
    it('should maintain image quality during conversion', async () => {
      const testBuffer = await sharp({
        create: {
          width: 512,
          height: 512,
          channels: 4,
          background: { r: 200, g: 150, b: 100, alpha: 1 }
        }
      })
      .png()
      .toBuffer();

      const result = await convertTo9x16(testBuffer, TEST_MODEL_ID);

      expect(result.converted).toBe(true);

      const metadata = await sharp(result.buffer).metadata();
      expect(metadata.width).toBe(1008);
      expect(metadata.height).toBe(1792);
      expect(metadata.channels).toBeGreaterThanOrEqual(3);
      
      expect(result.buffer.length).toBeGreaterThan(0);
      expect(result.buffer.length).toBeGreaterThan(testBuffer.length * 0.5);
    });
  });
});
