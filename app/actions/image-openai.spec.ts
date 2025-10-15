/**
 * @jest-environment node
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { getModelById } from '@/lib/imageModels';

// Mock модулей
jest.mock('../lib/db', () => ({
  prisma: {
    video: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({
    send: jest.fn() as any,
  })),
  PutObjectCommand: jest.fn(),
}));

jest.mock('openai', () => {
  return {
    default: jest.fn().mockImplementation(() => ({
      images: {
        generate: jest.fn(),
      },
    })),
  };
});

jest.mock('replicate', () => {
  return {
    default: jest.fn().mockImplementation(() => ({
      run: jest.fn(),
    })),
  };
});

jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('OpenAI Image Models', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Model Configuration', () => {
    it('should have OpenAI models in IMAGE_MODELS', () => {
      const dallE3 = getModelById('dall-e-3');
      expect(dallE3).toBeDefined();
      expect(dallE3?.provider).toBe('openai');
      expect(dallE3?.openaiModel).toBe('dall-e-3');
    });

    it('should have DALL-E 3 HD model', () => {
      const dallE3HD = getModelById('dall-e-3-hd');
      expect(dallE3HD).toBeDefined();
      expect(dallE3HD?.provider).toBe('openai');
      expect(dallE3HD?.defaultParams.quality).toBe('hd');
    });

    it('should have DALL-E 2 model', () => {
      const dallE2 = getModelById('dall-e-2');
      expect(dallE2).toBeDefined();
      expect(dallE2?.provider).toBe('openai');
      expect(dallE2?.openaiModel).toBe('dall-e-2');
    });

    it('DALL-E 3 should have correct default params', () => {
      const dallE3 = getModelById('dall-e-3');
      expect(dallE3?.defaultParams).toEqual({
        size: '1024x1792',
        quality: 'standard',
        style: 'vivid',
      });
    });

    it('all OpenAI models should have provider set to openai', () => {
      const openaiModels = ['dall-e-3', 'dall-e-3-hd', 'dall-e-2'];
      
      openaiModels.forEach(modelId => {
        const model = getModelById(modelId);
        expect(model?.provider).toBe('openai');
        expect(model?.openaiModel).toBeDefined();
      });
    });

    it('OpenAI models should have correct quality ratings', () => {
      const dallE3 = getModelById('dall-e-3');
      const dallE3HD = getModelById('dall-e-3-hd');
      const dallE2 = getModelById('dall-e-2');

      expect(dallE3?.quality).toBe('ultra');
      expect(dallE3HD?.quality).toBe('ultra');
      expect(dallE2?.quality).toBe('standard');
    });

    it('OpenAI models should have correct speed ratings', () => {
      const dallE3 = getModelById('dall-e-3');
      const dallE3HD = getModelById('dall-e-3-hd');
      const dallE2 = getModelById('dall-e-2');

      expect(dallE3?.speed).toBe('medium');
      expect(dallE3HD?.speed).toBe('slow');
      expect(dallE2?.speed).toBe('fast');
    });

    it('DALL-E 3 models should be marked as pro', () => {
      const dallE3 = getModelById('dall-e-3');
      const dallE3HD = getModelById('dall-e-3-hd');

      expect(dallE3?.isPro).toBe(true);
      expect(dallE3HD?.isPro).toBe(true);
    });
  });
});
