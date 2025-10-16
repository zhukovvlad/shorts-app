/**
 * @fileoverview Тесты для системы коэффициентов стоимости моделей
 * 
 * Проверяет корректность вычисления стоимости генерации изображений
 * на основе коэффициентов различных моделей.
 */

import { 
  getModelCoefficient, 
  computeModelCost, 
  MODEL_COEFFICIENTS,
  IMAGE_MODELS 
} from './imageModels';

describe('Model Coefficients System', () => {
  describe('MODEL_COEFFICIENTS', () => {
    it('should contain all expected model coefficients', () => {
      expect(MODEL_COEFFICIENTS).toBeDefined();
      expect(typeof MODEL_COEFFICIENTS).toBe('object');
      
      // Проверяем наличие ключевых моделей
      expect(MODEL_COEFFICIENTS['FLUX Schnell']).toBe(1.0);
      expect(MODEL_COEFFICIENTS['DALL-E 2']).toBe(1.0);
      expect(MODEL_COEFFICIENTS['Stable Diffusion XL']).toBe(1.2);
      expect(MODEL_COEFFICIENTS['Ideogram V3 Turbo']).toBe(1.5);
      expect(MODEL_COEFFICIENTS['FLUX Dev']).toBe(1.5);
      expect(MODEL_COEFFICIENTS['FLUX Pro']).toBe(2.0);
      expect(MODEL_COEFFICIENTS['DALL-E 3']).toBe(2.0);
      expect(MODEL_COEFFICIENTS['DALL-E 3 HD']).toBe(2.5);
    });

    it('all coefficients should be positive numbers', () => {
      Object.entries(MODEL_COEFFICIENTS).forEach(([name, coeff]) => {
        expect(typeof coeff).toBe('number');
        expect(coeff).toBeGreaterThan(0);
        expect(isFinite(coeff)).toBe(true);
      });
    });
  });

  describe('getModelCoefficient', () => {
    describe('by model ID', () => {
      it('should return correct coefficient for flux-schnell', () => {
        expect(getModelCoefficient('flux-schnell')).toBe(1.0);
      });

      it('should return correct coefficient for dall-e-2', () => {
        expect(getModelCoefficient('dall-e-2')).toBe(1.0);
      });

      it('should return correct coefficient for sdxl', () => {
        expect(getModelCoefficient('sdxl')).toBe(1.2);
      });

      it('should return correct coefficient for ideogram-v3-turbo', () => {
        expect(getModelCoefficient('ideogram-v3-turbo')).toBe(1.5);
      });

      it('should return correct coefficient for flux-dev', () => {
        expect(getModelCoefficient('flux-dev')).toBe(1.5);
      });

      it('should return correct coefficient for flux-pro', () => {
        expect(getModelCoefficient('flux-pro')).toBe(2.0);
      });

      it('should return correct coefficient for dall-e-3', () => {
        expect(getModelCoefficient('dall-e-3')).toBe(2.0);
      });

      it('should return correct coefficient for dall-e-3-hd', () => {
        expect(getModelCoefficient('dall-e-3-hd')).toBe(2.5);
      });
    });

    describe('by model name', () => {
      it('should return correct coefficient for FLUX Schnell by name', () => {
        expect(getModelCoefficient('FLUX Schnell')).toBe(1.0);
      });

      it('should return correct coefficient for DALL-E 3 HD by name', () => {
        expect(getModelCoefficient('DALL-E 3 HD')).toBe(2.5);
      });

      it('should return correct coefficient for Ideogram V3 Turbo by name', () => {
        expect(getModelCoefficient('Ideogram V3 Turbo')).toBe(1.5);
      });
    });

    describe('fallback behavior', () => {
      it('should return 1.0 for unknown model ID', () => {
        expect(getModelCoefficient('unknown-model')).toBe(1.0);
      });

      it('should return 1.0 for unknown model name', () => {
        expect(getModelCoefficient('Unknown Model Name')).toBe(1.0);
      });

      it('should return 1.0 for undefined input', () => {
        expect(getModelCoefficient(undefined)).toBe(1.0);
      });

      it('should return 1.0 for empty string', () => {
        expect(getModelCoefficient('')).toBe(1.0);
      });

      it('should return 1.0 for null input', () => {
        // @ts-expect-error testing null input
        expect(getModelCoefficient(null)).toBe(1.0);
      });
    });

    describe('case and whitespace robustness', () => {
      it('should handle trailing whitespace in model ID', () => {
        expect(getModelCoefficient('flux-schnell ')).toBe(1.0);
        expect(getModelCoefficient(' flux-dev')).toBe(1.5);
        expect(getModelCoefficient('  sdxl  ')).toBe(1.2);
      });

      it('should handle trailing whitespace in model name', () => {
        expect(getModelCoefficient('FLUX Schnell ')).toBe(1.0);
        expect(getModelCoefficient(' DALL-E 3')).toBe(2.0);
        expect(getModelCoefficient('  FLUX Pro  ')).toBe(2.0);
      });

      it('should NOT match different casing (case-sensitive by design)', () => {
        // Наши ID и имена регистрозависимы, это ожидаемое поведение
        expect(getModelCoefficient('FLUX-SCHNELL')).toBe(1.0); // fallback
        expect(getModelCoefficient('flux schnell')).toBe(1.0); // fallback
        expect(getModelCoefficient('dall-e-2')).toBe(1.0); // correct
        expect(getModelCoefficient('DALL-E-2')).toBe(1.0); // fallback
      });
    });

    describe('all IMAGE_MODELS should have valid coefficients', () => {
      it('should return valid coefficient for each model in IMAGE_MODELS', () => {
        IMAGE_MODELS.forEach(model => {
          const coeff = getModelCoefficient(model.id);
          expect(coeff).toBeGreaterThan(0);
          expect(isFinite(coeff)).toBe(true);
        });
      });
    });
  });

  describe('computeModelCost', () => {
    describe('with default base cost (1)', () => {
      it('should compute cost for FLUX Schnell (1x)', () => {
        expect(computeModelCost('flux-schnell')).toBe(1);
      });

      it('should compute cost for DALL-E 2 (1x)', () => {
        expect(computeModelCost('dall-e-2')).toBe(1);
      });

      it('should compute cost for SDXL (1.2x -> 2 credits)', () => {
        expect(computeModelCost('sdxl')).toBe(2);
      });

      it('should compute cost for Ideogram V3 Turbo (1.5x -> 2 credits)', () => {
        expect(computeModelCost('ideogram-v3-turbo')).toBe(2);
      });

      it('should compute cost for FLUX Dev (1.5x -> 2 credits)', () => {
        expect(computeModelCost('flux-dev')).toBe(2);
      });

      it('should compute cost for FLUX Pro (2x)', () => {
        expect(computeModelCost('flux-pro')).toBe(2);
      });

      it('should compute cost for DALL-E 3 (2x)', () => {
        expect(computeModelCost('dall-e-3')).toBe(2);
      });

      it('should compute cost for DALL-E 3 HD (2.5x -> 3 credits)', () => {
        expect(computeModelCost('dall-e-3-hd')).toBe(3);
      });
    });

    describe('with custom base cost', () => {
      it('should compute cost with base cost = 2', () => {
        expect(computeModelCost('flux-schnell', 2)).toBe(2);
        expect(computeModelCost('sdxl', 2)).toBe(3); // 2 * 1.2 = 2.4 -> ceil -> 3
        expect(computeModelCost('flux-pro', 2)).toBe(4); // 2 * 2.0 = 4
        expect(computeModelCost('dall-e-3-hd', 2)).toBe(5); // 2 * 2.5 = 5
      });

      it('should compute cost with base cost = 5', () => {
        expect(computeModelCost('flux-schnell', 5)).toBe(5);
        expect(computeModelCost('sdxl', 5)).toBe(6); // 5 * 1.2 = 6
        expect(computeModelCost('ideogram-v3-turbo', 5)).toBe(8); // 5 * 1.5 = 7.5 -> ceil -> 8
        expect(computeModelCost('dall-e-3-hd', 5)).toBe(13); // 5 * 2.5 = 12.5 -> ceil -> 13
      });

      it('should compute cost with base cost = 10', () => {
        expect(computeModelCost('flux-schnell', 10)).toBe(10);
        expect(computeModelCost('sdxl', 10)).toBe(12); // 10 * 1.2 = 12
        expect(computeModelCost('flux-pro', 10)).toBe(20); // 10 * 2.0 = 20
        expect(computeModelCost('dall-e-3-hd', 10)).toBe(25); // 10 * 2.5 = 25
      });
    });

    describe('rounding behavior', () => {
      it('should round up fractional results', () => {
        // SDXL: 1 * 1.2 = 1.2 -> ceil -> 2
        expect(computeModelCost('sdxl', 1)).toBe(2);
        
        // Ideogram: 1 * 1.5 = 1.5 -> ceil -> 2
        expect(computeModelCost('ideogram-v3-turbo', 1)).toBe(2);
        
        // DALL-E 3 HD: 1 * 2.5 = 2.5 -> ceil -> 3
        expect(computeModelCost('dall-e-3-hd', 1)).toBe(3);
      });

      it('should not round when result is already integer', () => {
        expect(computeModelCost('flux-schnell', 1)).toBe(1);
        expect(computeModelCost('flux-pro', 1)).toBe(2);
        expect(computeModelCost('dall-e-3', 1)).toBe(2);
      });
    });

    describe('minimum cost enforcement', () => {
      it('should enforce minimum cost of 1 credit', () => {
        expect(computeModelCost('flux-schnell', 0)).toBe(1);
        expect(computeModelCost('flux-schnell', -5)).toBe(1);
        expect(computeModelCost('flux-schnell', 0.1)).toBe(1);
        expect(computeModelCost('flux-schnell', 0.5)).toBe(1);
      });

      it('should handle edge case with very small base cost', () => {
        expect(computeModelCost('flux-pro', 0.1)).toBe(1); // 0.1 * 2.0 = 0.2 -> max(1, ceil(0.2)) = 1
      });
    });

    describe('fallback behavior', () => {
      it('should use coefficient 1.0 for unknown model', () => {
        expect(computeModelCost('unknown-model', 1)).toBe(1);
        expect(computeModelCost('unknown-model', 5)).toBe(5);
      });

      it('should use coefficient 1.0 for undefined model', () => {
        expect(computeModelCost(undefined, 1)).toBe(1);
        expect(computeModelCost(undefined, 10)).toBe(10);
      });

      it('should use default base cost of 1 when not provided', () => {
        expect(computeModelCost('flux-schnell')).toBe(1);
        expect(computeModelCost('flux-pro')).toBe(2);
      });
    });

    describe('all IMAGE_MODELS cost computation', () => {
      it('should compute valid cost for all models', () => {
        IMAGE_MODELS.forEach(model => {
          const cost = computeModelCost(model.id);
          expect(cost).toBeGreaterThanOrEqual(1);
          expect(Number.isInteger(cost)).toBe(true);
        });
      });

      it('should compute cost matching expected values', () => {
        const expectedCosts = {
          'ideogram-v3-turbo': 2,
          'flux-schnell': 1,
          'flux-pro': 2,
          'flux-dev': 2,
          'sdxl': 2,
          'dall-e-3': 2,
          'dall-e-3-hd': 3,
          'dall-e-2': 1,
        };

        Object.entries(expectedCosts).forEach(([modelId, expectedCost]) => {
          expect(computeModelCost(modelId)).toBe(expectedCost);
        });
      });
    });

    describe('cost progression', () => {
      it('should have progressive costs: cheap < medium < expensive', () => {
        const cheapCost = computeModelCost('flux-schnell'); // 1x
        const mediumCost = computeModelCost('flux-dev'); // 1.5x
        const expensiveCost = computeModelCost('dall-e-3-hd'); // 2.5x

        expect(cheapCost).toBeLessThan(mediumCost);
        expect(mediumCost).toBeLessThan(expensiveCost);
      });

      it('should have same cost for models with equal coefficients', () => {
        const cost1 = computeModelCost('flux-schnell'); // 1.0
        const cost2 = computeModelCost('dall-e-2'); // 1.0
        expect(cost1).toBe(cost2);

        const cost3 = computeModelCost('flux-pro'); // 2.0
        const cost4 = computeModelCost('dall-e-3'); // 2.0
        expect(cost3).toBe(cost4);

        const cost5 = computeModelCost('flux-dev'); // 1.5
        const cost6 = computeModelCost('ideogram-v3-turbo'); // 1.5
        expect(cost5).toBe(cost6);
      });
    });
  });

  describe('Integration: coefficient -> cost flow', () => {
    it('should correctly flow from model ID to final cost', () => {
      const modelId = 'dall-e-3-hd';
      const coefficient = getModelCoefficient(modelId);
      const cost = computeModelCost(modelId);

      expect(coefficient).toBe(2.5);
      expect(cost).toBe(Math.max(1, Math.ceil(1 * coefficient)));
      expect(cost).toBe(3);
    });

    it('should maintain consistency across multiple calls', () => {
      const modelId = 'flux-pro';
      
      const coeff1 = getModelCoefficient(modelId);
      const coeff2 = getModelCoefficient(modelId);
      expect(coeff1).toBe(coeff2);

      const cost1 = computeModelCost(modelId);
      const cost2 = computeModelCost(modelId);
      expect(cost1).toBe(cost2);
    });
  });
});
