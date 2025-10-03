/**
 * @fileoverview Конфигурация доступных моделей генерации изображений
 * 
 * Этот модуль содержит список всех поддерживаемых моделей Replicate
 * для генерации изображений с их характеристиками и параметрами.
 */

export interface ImageModel {
  id: string;
  name: string;
  description: string;
  replicateModel: string;
  defaultParams: Record<string, any>;
  isPro?: boolean; // Платная модель
  speed: 'fast' | 'medium' | 'slow';
  quality: 'standard' | 'high' | 'ultra';
}

export const IMAGE_MODELS: ImageModel[] = [
  {
    id: 'ideogram-v3-turbo',
    name: 'Ideogram V3 Turbo',
    description: 'Быстрая генерация реалистичных изображений',
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
];

export const getModelById = (modelId: string): ImageModel | undefined => {
  return IMAGE_MODELS.find((model) => model.id === modelId);
};

export const getDefaultModel = (): ImageModel => {
  return IMAGE_MODELS[0]; // Ideogram V3 Turbo по умолчанию
};
