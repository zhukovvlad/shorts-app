/**
 * @fileoverview Конфигурация доступных моделей генерации изображений
 * 
 * Этот модуль содержит список всех поддерживаемых моделей Replicate и OpenAI
 * для генерации изображений с их характеристиками и параметрами.
 */

import { logger } from './logger';

export type ImageProvider = 'replicate' | 'openai';

/**
 * Базовые поля, общие для всех моделей
 */
interface BaseImageModel {
  id: string;
  name: string;
  description: string;
  defaultParams: Record<string, unknown>;
  isPro?: boolean;
  speed: 'fast' | 'medium' | 'slow';
  quality: 'standard' | 'high' | 'ultra';
}

/**
 * Модель Replicate - требует replicateModel
 */
export interface ReplicateImageModel extends BaseImageModel {
  provider: 'replicate';
  replicateModel: string;
  openaiModel?: never;
}

/**
 * Модель OpenAI - требует openaiModel
 */
export interface OpenAIImageModel extends BaseImageModel {
  provider: 'openai';
  openaiModel: string;
  replicateModel?: never;
}

/**
 * Discriminated union - гарантирует что модель имеет правильное поле в зависимости от провайдера
 */
export type ImageModel = ReplicateImageModel | OpenAIImageModel;

/**
 * Дефолтная модель на случай если IMAGE_MODELS пуст
 * Используется как fallback для гарантии работоспособности системы
 */
const FALLBACK_DEFAULT_MODEL: ReplicateImageModel = {
  id: 'ideogram-v3-turbo',
  name: 'Ideogram V3 Turbo',
  description: 'Быстрая генерация реалистичных изображений',
  provider: 'replicate' as const,
  replicateModel: 'ideogram-ai/ideogram-v3-turbo',
  defaultParams: {
    resolution: 'None',
    style_type: 'Realistic',
    aspect_ratio: '9:16',
    magic_prompt_option: 'On',
  },
  speed: 'fast' as const,
  quality: 'high' as const,
};

export const IMAGE_MODELS: readonly ImageModel[] = [
  {
    id: 'ideogram-v3-turbo',
    name: 'Ideogram V3 Turbo',
    description: 'Быстрая генерация реалистичных изображений',
    provider: 'replicate' as const,
    replicateModel: 'ideogram-ai/ideogram-v3-turbo',
    defaultParams: {
      resolution: 'None',
      style_type: 'Realistic',
      aspect_ratio: '9:16',
      magic_prompt_option: 'On',
    },
    speed: 'fast' as const,
    quality: 'high' as const,
  },
  {
    id: 'flux-schnell',
    name: 'FLUX Schnell',
    description: 'Очень быстрая генерация качественных изображений',
    provider: 'replicate' as const,
    replicateModel: 'black-forest-labs/flux-schnell',
    defaultParams: {
      aspect_ratio: '9:16',
      output_format: 'png',
      output_quality: 90,
    },
    speed: 'fast' as const,
    quality: 'standard' as const,
  },
  {
    id: 'flux-pro',
    name: 'FLUX Pro',
    description: 'Профессиональное качество с улучшенной детализацией',
    provider: 'replicate' as const,
    replicateModel: 'black-forest-labs/flux-pro',
    defaultParams: {
      aspect_ratio: '9:16',
      output_format: 'png',
      safety_tolerance: 2,
    },
    isPro: true,
    speed: 'medium' as const,
    quality: 'ultra' as const,
  },
  {
    id: 'flux-dev',
    name: 'FLUX Dev',
    description: 'Баланс качества и скорости',
    provider: 'replicate' as const,
    replicateModel: 'black-forest-labs/flux-dev',
    defaultParams: {
      aspect_ratio: '9:16',
      output_format: 'png',
      output_quality: 90,
      num_inference_steps: 28,
    },
    speed: 'medium' as const,
    quality: 'high' as const,
  },
  {
    id: 'sdxl',
    name: 'Stable Diffusion XL',
    description: 'Проверенная модель с хорошим качеством',
    provider: 'replicate' as const,
    replicateModel: 'stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b',
    defaultParams: {
      width: 768,
      height: 1344, // 9:16 aspect ratio
      num_inference_steps: 30,
      guidance_scale: 7.5,
      scheduler: 'DPMSolverMultistep',
    },
    speed: 'medium' as const,
    quality: 'high' as const,
  },
  // OpenAI Models
  {
    id: 'dall-e-3',
    name: 'DALL-E 3',
    description: 'Передовая модель OpenAI с отличным пониманием текста',
    provider: 'openai' as const,
    openaiModel: 'dall-e-3',
    defaultParams: {
      size: '1024x1792', // 9:16 aspect ratio
      quality: 'standard',
      style: 'vivid',
    },
    isPro: true,
    speed: 'medium' as const,
    quality: 'ultra' as const,
  },
  {
    id: 'dall-e-3-hd',
    name: 'DALL-E 3 HD',
    description: 'DALL-E 3 с максимальным качеством детализации',
    provider: 'openai' as const,
    openaiModel: 'dall-e-3',
    defaultParams: {
      size: '1024x1792', // 9:16 aspect ratio
      quality: 'hd',
      style: 'vivid',
    },
    isPro: true,
    speed: 'slow' as const,
    quality: 'ultra' as const,
  },
  {
    id: 'dall-e-2',
    name: 'DALL-E 2',
    description: 'Более быстрая и экономичная модель OpenAI (автоматическая конвертация в 9:16)',
    provider: 'openai' as const,
    openaiModel: 'dall-e-2',
    defaultParams: {
      size: '512x512', // Генерирует 512x512, автоматически конвертируется в 9:16
    },
    speed: 'fast' as const,
    quality: 'standard' as const,
  },
];

export const getModelById = (modelId: string): ImageModel | undefined => {
  return IMAGE_MODELS.find((model) => model.id === modelId);
};

// Коэффициенты стоимости по моделям (множитель от базовой стоимости в кредитах)
export const MODEL_COEFFICIENTS: Record<string, number> = {
  "FLUX Schnell": 1.0,
  "DALL-E 2": 1.0,
  "Stable Diffusion XL": 1.2,
  "Ideogram V3 Turbo": 1.5,
  "FLUX Dev": 1.5,
  "FLUX Pro": 2.0,
  "DALL-E 3": 2.0,
  "DALL-E 3 HD": 2.5,
};

/**
 * Получить коэффициент для модели по id или имени.
 * Если модель не найдена, возвращает 1.0
 */
export const getModelCoefficient = (modelIdOrName?: string): number => {
  if (!modelIdOrName) return 1.0;

  // Попробуем найти модель по id
  const byId = IMAGE_MODELS.find(m => m.id === modelIdOrName);
  const modelName = byId ? byId.name : modelIdOrName;

  const coeff = MODEL_COEFFICIENTS[modelName];
  return typeof coeff === 'number' && isFinite(coeff) && coeff > 0 ? coeff : 1.0;
};

/**
 * Вычислить стоимость в кредитах для выбранной модели.
 * Базовая стоимость по умолчанию = 1 кредит.
 * Результат округляется вверх до ближайшего целого (чтобы не допустить дробных кредитов).
 */
export const computeModelCost = (modelIdOrName?: string, baseCost = 1): number => {
  const coeff = getModelCoefficient(modelIdOrName);
  return Math.max(1, Math.ceil(baseCost * coeff));
};

/**
 * Возвращает модель по умолчанию для генерации изображений
 * Гарантированно возвращает валидную ImageModel
 * 
 * @returns ImageModel - модель по умолчанию (Ideogram V3 Turbo)
 * @throws {Error} Только если IMAGE_MODELS пуст и fallback недоступен (критическая ошибка конфигурации)
 */
export const getDefaultModel = (): ImageModel => {
  // Защита от пустого массива моделей
  if (IMAGE_MODELS.length === 0) {
    logger.warn('IMAGE_MODELS is empty, using fallback default model', {
      fallbackModel: FALLBACK_DEFAULT_MODEL.id,
      fallbackModelName: FALLBACK_DEFAULT_MODEL.name
    });
    return FALLBACK_DEFAULT_MODEL;
  }
  
  return IMAGE_MODELS[0]; // Ideogram V3 Turbo по умолчанию
};
