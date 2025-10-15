/**
 * @jest-environment node
 */

import { describe, it, expect } from '@jest/globals';
import { 
  ImageModel, 
  ReplicateImageModel, 
  OpenAIImageModel,
  getModelById,
  IMAGE_MODELS 
} from '@/lib/imageModels';

describe('ImageModel Discriminated Union', () => {
  describe('Type Safety', () => {
    it('Replicate models should have replicateModel field', () => {
      const replicateModels = IMAGE_MODELS.filter(m => m.provider === 'replicate');
      
      replicateModels.forEach(model => {
        expect(model.provider).toBe('replicate');
        expect(model.replicateModel).toBeDefined();
        expect(typeof model.replicateModel).toBe('string');
        expect((model as any).openaiModel).toBeUndefined();
      });
    });

    it('OpenAI models should have openaiModel field', () => {
      const openaiModels = IMAGE_MODELS.filter(m => m.provider === 'openai');
      
      openaiModels.forEach(model => {
        expect(model.provider).toBe('openai');
        expect(model.openaiModel).toBeDefined();
        expect(typeof model.openaiModel).toBe('string');
        expect((model as any).replicateModel).toBeUndefined();
      });
    });

    it('should not allow models with both replicateModel and openaiModel', () => {
      // TypeScript должен предотвратить это на этапе компиляции
      // Этот тест проверяет runtime поведение
      IMAGE_MODELS.forEach(model => {
        if (model.provider === 'replicate') {
          expect((model as any).openaiModel).toBeUndefined();
        } else if (model.provider === 'openai') {
          expect((model as any).replicateModel).toBeUndefined();
        }
      });
    });

    it('should correctly type check Replicate models', () => {
      const fluxModel = getModelById('flux-schnell');
      
      if (fluxModel && fluxModel.provider === 'replicate') {
        // TypeScript знает что это ReplicateImageModel
        expect(fluxModel.replicateModel).toBe('black-forest-labs/flux-schnell');
        // openaiModel не должно существовать
        expect((fluxModel as any).openaiModel).toBeUndefined();
      }
    });

    it('should correctly type check OpenAI models', () => {
      const dalleModel = getModelById('dall-e-3');
      
      if (dalleModel && dalleModel.provider === 'openai') {
        // TypeScript знает что это OpenAIImageModel
        expect(dalleModel.openaiModel).toBe('dall-e-3');
        // replicateModel не должно существовать
        expect((dalleModel as any).replicateModel).toBeUndefined();
      }
    });
  });

  describe('Discriminated Union Guards', () => {
    it('should use provider as discriminator', () => {
      const models = IMAGE_MODELS;
      
      models.forEach(model => {
        if (model.provider === 'replicate') {
          // TypeScript narrowing работает
          const replicateModel: ReplicateImageModel = model;
          expect(replicateModel.replicateModel).toBeDefined();
        } else if (model.provider === 'openai') {
          // TypeScript narrowing работает
          const openaiModel: OpenAIImageModel = model;
          expect(openaiModel.openaiModel).toBeDefined();
        }
      });
    });

    it('should narrow type correctly based on provider check', () => {
      const testModel: ImageModel | undefined = getModelById('dall-e-2');
      
      expect(testModel).toBeDefined();
      
      if (testModel) {
        if (testModel.provider === 'openai') {
          // Здесь TypeScript знает что это OpenAIImageModel
          expect(testModel.openaiModel).toBe('dall-e-2');
        } else {
          // Это Replicate модель
          expect(testModel.replicateModel).toBeDefined();
        }
      }
    });
  });

  describe('Model Configuration Integrity', () => {
    it('all Replicate models should have valid replicateModel format', () => {
      const replicateModels = IMAGE_MODELS.filter(m => m.provider === 'replicate');
      
      replicateModels.forEach(model => {
        expect(model.replicateModel).toMatch(/^[a-z0-9-]+\/[a-z0-9-]+/);
      });
    });

    it('all OpenAI models should have valid openaiModel values', () => {
      const openaiModels = IMAGE_MODELS.filter(m => m.provider === 'openai');
      const validOpenAIModels = ['dall-e-2', 'dall-e-3'];
      
      openaiModels.forEach(model => {
        expect(validOpenAIModels).toContain(model.openaiModel);
      });
    });

    it('all models should have required base fields', () => {
      IMAGE_MODELS.forEach(model => {
        expect(model.id).toBeDefined();
        expect(typeof model.id).toBe('string');
        expect(model.name).toBeDefined();
        expect(typeof model.name).toBe('string');
        expect(model.description).toBeDefined();
        expect(typeof model.description).toBe('string');
        expect(model.provider).toBeDefined();
        expect(['replicate', 'openai']).toContain(model.provider);
        expect(model.defaultParams).toBeDefined();
        expect(typeof model.defaultParams).toBe('object');
        expect(model.speed).toBeDefined();
        expect(['fast', 'medium', 'slow']).toContain(model.speed);
        expect(model.quality).toBeDefined();
        expect(['standard', 'high', 'ultra']).toContain(model.quality);
      });
    });
  });

  describe('Type Inference', () => {
    it('should correctly infer union type for getModelById', () => {
      const model = getModelById('flux-dev');
      
      // model может быть undefined
      if (model) {
        // Теперь TypeScript знает что model существует
        expect(model.provider).toBeDefined();
        
        // И мы можем сузить тип через проверку provider
        if (model.provider === 'replicate') {
          expect(model.replicateModel).toContain('flux-dev');
        }
      }
    });

    it('should handle both model types in a single function', () => {
      const processModel = (model: ImageModel): string => {
        if (model.provider === 'replicate') {
          return model.replicateModel;
        } else {
          return model.openaiModel;
        }
      };

      const replicateModel = getModelById('flux-schnell');
      const openaiModel = getModelById('dall-e-3');

      if (replicateModel) {
        const result = processModel(replicateModel);
        expect(result).toContain('flux-schnell');
      }

      if (openaiModel) {
        const result = processModel(openaiModel);
        expect(result).toBe('dall-e-3');
      }
    });
  });
});
