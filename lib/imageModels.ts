/**
 * @fileoverview Конфигурация доступных моделей генерации изображений
 * 
 * Этот модуль содержит список всех поддерживаемых моделей Replicate
 * для генерации изображений с их характеристиками и параметрами.
 */

import { logger } from './logger';

export type ImageProvider = 'replicate' | 'openai';

export interface ImageModel {
  id: string;
  name: string;
  description: string;
  provider: ImageProvider;
  replicateModel?: string; // Для Replicate моделей
  openaiModel?: string; // Для OpenAI моделей
  defaultParams: Record<string, any>;
  isPro?: boolean; // Платная модель
  speed: 'fast' | 'medium' | 'slow';
  quality: 'standard' | 'high' | 'ultra';
}

/**
 * Дефолтная модель на случай если IMAGE_MODELS пуст
 * Используется как fallback для гарантии работоспособности системы
 */
const FALLBACK_DEFAULT_MODEL: ImageModel = {
  id: 'ideogram-v3-turbo',
  name: 'Ideogram V3 Turbo',
  description: 'Быстрая генерация реалистичных изображений',
  provider: 'replicate',
  replicateModel: 'ideogram-ai/ideogram-v3-turbo',
  defaultParams: {
    resolution: 'None',
    style_type: 'Realistic',
    aspect_ratio: '9:16',
    magic_prompt_option: 'On',
  },
  speed: 'fast',
  quality: 'high',
};

export const IMAGE_MODELS: ImageModel[] = [
  {
    id: 'ideogram-v3-turbo',
    name: 'Ideogram V3 Turbo',
    description: 'Быстрая генерация реалистичных изображений',
    provider: 'replicate',
    replicateModel: 'ideogram-ai/ideogram-v3-turbo',
    defaultParams: {
      resolution: 'None',
      style_type: 'Realistic',
      aspect_ratio: '9:16',
      magic_prompt_option: 'On',
    },
    speed: 'fast',
    quality: 'high',
  },
  {
    id: 'flux-schnell',
    name: 'FLUX Schnell',
    description: 'Очень быстрая генерация качественных изображений',
    provider: 'replicate',
    replicateModel: 'black-forest-labs/flux-schnell',
    defaultParams: {
      aspect_ratio: '9:16',
      output_format: 'png',
      output_quality: 90,
    },
    speed: 'fast',
    quality: 'standard',
  },
  {
    id: 'flux-pro',
    name: 'FLUX Pro',
    description: 'Профессиональное качество с улучшенной детализацией',
    provider: 'replicate',
    replicateModel: 'black-forest-labs/flux-pro',
    defaultParams: {
      aspect_ratio: '9:16',
      output_format: 'png',
      safety_tolerance: 2,
    },
    isPro: true,
    speed: 'medium',
    quality: 'ultra',
  },
  {
    id: 'flux-dev',
    name: 'FLUX Dev',
    description: 'Баланс качества и скорости',
    provider: 'replicate',
    replicateModel: 'black-forest-labs/flux-dev',
    defaultParams: {
      aspect_ratio: '9:16',
      output_format: 'png',
      output_quality: 90,
      num_inference_steps: 28,
    },
    speed: 'medium',
    quality: 'high',
  },
  {
    id: 'sdxl',
    name: 'Stable Diffusion XL',
    description: 'Проверенная модель с хорошим качеством',
    provider: 'replicate',
    replicateModel: 'stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b',
    defaultParams: {
      width: 768,
      height: 1344, // 9:16 aspect ratio
      num_inference_steps: 30,
      guidance_scale: 7.5,
      scheduler: 'DPMSolverMultistep',
    },
    speed: 'medium',
    quality: 'high',
  },
  // OpenAI Models
  {
    id: 'dall-e-3',
    name: 'DALL-E 3',
    description: 'Передовая модель OpenAI с отличным пониманием текста',
    provider: 'openai',
    openaiModel: 'dall-e-3',
    defaultParams: {
      size: '1024x1792', // 9:16 aspect ratio
      quality: 'standard',
      style: 'vivid',
    },
    isPro: true,
    speed: 'medium',
    quality: 'ultra',
  },
  {
    id: 'dall-e-3-hd',
    name: 'DALL-E 3 HD',
    description: 'DALL-E 3 с максимальным качеством детализации',
    provider: 'openai',
    openaiModel: 'dall-e-3',
    defaultParams: {
      size: '1024x1792', // 9:16 aspect ratio
      quality: 'hd',
      style: 'vivid',
    },
    isPro: true,
    speed: 'slow',
    quality: 'ultra',
  },
  {
    id: 'dall-e-2',
    name: 'DALL-E 2',
    description: 'Более быстрая и экономичная модель OpenAI',
    provider: 'openai',
    openaiModel: 'dall-e-2',
    defaultParams: {
      size: '512x512', // DALL-E 2 не поддерживает 9:16, будет обрезано
    },
    speed: 'fast',
    quality: 'standard',
  },
];

export const getModelById = (modelId: string): ImageModel | undefined => {
  return IMAGE_MODELS.find((model) => model.id === modelId);
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
