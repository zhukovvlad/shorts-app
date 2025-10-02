"use client";

import { CheckCircle, Clock, Loader2, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProgressStep {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'current' | 'completed' | 'error';
  estimatedTime?: string;
}

interface VideoCreationProgressProps {
  currentStep: string;
  step?: string;
  error?: string;
  retryCount?: number;
  maxRetries?: number;
  lastError?: string;
  retryReason?: string;
  currentStepId?: string;
  completedSteps?: {
    script: boolean;
    images: boolean;
    audio: boolean;
    captions: boolean;
    render: boolean;
  };
  className?: string;
}

const defaultSteps: ProgressStep[] = [
  {
    id: 'script',
    name: 'Генерация сценария',
    description: 'AI анализирует ваш промпт и создает увлекательный сценарий',
    estimatedTime: '10-15 сек',
    status: 'pending'
  },
  {
    id: 'images', 
    name: 'Создание изображений',
    description: 'Генерация визуального контента для каждой сцены',
    estimatedTime: '30-45 сек',
    status: 'pending'
  },
  {
    id: 'audio',
    name: 'Синтез речи',
    description: 'Создание естественного голосового сопровождения',
    estimatedTime: '15-20 сек',
    status: 'pending'
  },
  {
    id: 'captions',
    name: 'Генерация субтитров',
    description: 'Автоматическое создание синхронизированных субтитров',
    estimatedTime: '5-10 сек',
    status: 'pending'
  },
  {
    id: 'render',
    name: 'Рендеринг видео',
    description: 'Финальная сборка всех элементов в готовое видео',
    estimatedTime: '60-90 сек',
    status: 'pending'
  }
];

export const VideoCreationProgress = ({ 
  currentStep, 
  step,
  error,
  retryCount,
  maxRetries,
  lastError,
  retryReason,
  currentStepId,
  completedSteps,
  className 
}: VideoCreationProgressProps) => {
  // Нормализуем currentStep для корректного отображения прогресса
  const normalizeCurrentStep = (status: string, currentStepId?: string, retryCount?: number): string => {
    // Если у нас есть точный stepId, используем его
    if (currentStepId && defaultSteps.some(s => s.id === currentStepId)) {
      return currentStepId;
    }

    if (status === 'retrying') {
      // При ретрае определяем активный шаг из step описания или используем последний
      // Ищем название шага в step строке
      const stepMatch = step?.match(/(script|images|audio|captions|render)/i);
      if (stepMatch) {
        return stepMatch[1].toLowerCase();
      }
      // Fallback: если ретрай, то скорее всего это captions (частая ошибка)
      return 'captions';
    }
    
    if (status === 'completed') {
      return 'render'; // показываем как завершенный render
    }
    
    if (status === 'error' && retryCount) {
      // При ошибке с ретраем пытаемся определить проблемный шаг
      const stepMatch = step?.match(/(script|images|audio|captions|render)/i);
      if (stepMatch) {
        return stepMatch[1].toLowerCase();
      }
    }
    
    // Проверяем, что currentStep является валидным шагом
    if (defaultSteps.some(s => s.id === status)) {
      return status;
    }
    
    // Fallback для неизвестных статусов
    return 'script';
  };

  const activeStepId = normalizeCurrentStep(currentStep, currentStepId, retryCount);
  const isRetrying = currentStep === 'retrying';
  const isCompleted = currentStep === 'completed';
  const isErrorWithRetry = currentStep === 'error' && retryCount;

  // Логируем для отладки (можно отключить в production)
  if (process.env.NODE_ENV === 'development') {
    console.log('🎨 VideoCreationProgress:', {
      currentStep,
      activeStepId,
      hasCompletedSteps: !!completedSteps,
      completedCount: completedSteps ? Object.values(completedSteps).filter(Boolean).length : 0
    });
  }

  // Обновляем статусы шагов на основе реальных данных о завершенности
  const steps = defaultSteps.map((step, index) => {
    const stepIndex = defaultSteps.findIndex(s => s.id === step.id);
    const activeIndex = defaultSteps.findIndex(s => s.id === activeStepId);
    
    if (isCompleted) {
      // Если всё завершено, все шаги completed
      return { ...step, status: 'completed' as const };
    } else if (error && step.id === activeStepId && !retryCount) {
      // Финальная ошибка без ретрая
      return { ...step, status: 'error' as const };
    } else if ((isRetrying || isErrorWithRetry) && step.id === activeStepId) {
      // Текущий шаг при ретрае или ошибке с предстоящим ретраем
      return { ...step, status: 'current' as const };
    } else if (step.id === activeStepId) {
      // Текущий активный шаг
      return { ...step, status: 'current' as const };
    } else if (completedSteps) {
      // Если есть информация о checkpoint, используем её
      if (completedSteps[step.id as keyof typeof completedSteps]) {
        return { ...step, status: 'completed' as const };
      } else if (stepIndex < activeIndex) {
        // ВАЖНО: Если мы на более позднем шаге, но checkpoint не обновлен,
        // логически предыдущие шаги должны быть завершены
        return { ...step, status: 'completed' as const };
      } else {
        // Шаг не завершен согласно checkpoint и находится после текущего
        return { ...step, status: 'pending' as const };
      }
    } else if (stepIndex < activeIndex) {
      // Fallback ТОЛЬКО если completedSteps отсутствует:
      // шаги до текущего считаем завершенными
      return { ...step, status: 'completed' as const };
    } else {
      // Будущие шаги
      return { ...step, status: 'pending' as const };
    }
  });

  // Логируем финальное состояние (только в development)
  if (process.env.NODE_ENV === 'development') {
    const completedCount = steps.filter(step => step.status === 'completed').length;
    console.log(`📊 Steps: ${completedCount} completed, active: ${activeStepId}`);
  }

  // Для прогресс-бара учитываем специальные состояния
  let completedStepsCount = steps.filter(step => step.status === 'completed').length;
  
  if (isCompleted) {
    completedStepsCount = steps.length; // 100% при завершении
  } else if (isRetrying || isErrorWithRetry) {
    // При ретрае добавляем частичный прогресс для текущего шага
    const activeIndex = defaultSteps.findIndex(s => s.id === activeStepId);
    completedStepsCount = activeIndex; // количество завершенных шагов до текущего
  } else {
    // Для обычного текущего шага добавляем частичный прогресс (50% от шага)
    const activeIndex = defaultSteps.findIndex(s => s.id === activeStepId);
    const currentStepStatus = steps.find(s => s.id === activeStepId)?.status;
    if (currentStepStatus === 'current' && activeIndex >= 0) {
      // Добавляем 0.5 к завершенным шагам для показа частичного прогресса текущего шага
      completedStepsCount = completedStepsCount + 0.5;
    }
  }

  const currentStepData = steps.find(step => step.id === activeStepId);
  const totalSteps = steps.length;
  const progressPercentage = Math.round((completedStepsCount / totalSteps) * 100);

  return (
    <div className={cn("w-full max-w-2xl mx-auto p-6 bg-gray-800/50 rounded-xl border border-gray-700", className)}>
      {/* Header */}
      <div className="text-center mb-6">
        <h3 className="text-xl font-semibold text-white mb-2">
          Создание вашего видео
        </h3>
        {error && !retryCount ? (
          <p className="text-red-400 text-sm">Произошла ошибка: {error}</p>
        ) : retryCount ? (
          <div className="space-y-1">
            <p className="text-yellow-400 text-sm font-medium">
              Повторная попытка {retryCount}/{maxRetries ?? 3}
            </p>
            <p className="text-gray-300 text-xs">
              {retryReason || 'Возникла временная проблема, пытаемся снова...'}
            </p>
            {lastError && (
              <p className="text-gray-400 text-xs">
                Предыдущая ошибка: {lastError.length > 100 ? lastError.substring(0, 100) + '...' : lastError}
              </p>
            )}
          </div>
        ) : (
          <p className="text-gray-300 text-sm">
            {step || (currentStepData ? `${currentStepData.name}...` : 'Инициализация...')}
          </p>
        )}
      </div>

      {/* Progress Bar */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm text-gray-400">Прогресс</span>
          <span className="text-sm text-gray-400">{progressPercentage}%</span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-2">
          <div 
            className="bg-gradient-to-r from-[#3352CC] to-[#1C2D70] h-2 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-4">
        {steps.map((step) => {
          const isRetrying = retryCount && step.status === 'current';
          const Icon = step.status === 'completed' 
            ? CheckCircle 
            : isRetrying
              ? RotateCcw
            : step.status === 'current' 
              ? Loader2 
              : step.status === 'error'
                ? CheckCircle  // можно заменить на ErrorIcon если есть
                : Clock;

          return (
            <div 
              key={step.id}
              className={cn(
                "flex items-start gap-4 p-4 rounded-lg transition-all duration-300",
                step.status === 'current' && !isRetrying && "bg-blue-500/10 border border-blue-500/20",
                step.status === 'current' && isRetrying && "bg-yellow-500/10 border border-yellow-500/20",
                step.status === 'completed' && "bg-green-500/10 border border-green-500/20",
                step.status === 'error' && "bg-red-500/10 border border-red-500/20",
                step.status === 'pending' && "bg-gray-700/30"
              )}
            >
              {/* Icon */}
              <div className={cn(
                "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
                step.status === 'completed' && "bg-green-500 text-white",
                step.status === 'current' && !isRetrying && "bg-blue-500 text-white",
                step.status === 'current' && isRetrying && "bg-yellow-500 text-white",
                step.status === 'error' && "bg-red-500 text-white", 
                step.status === 'pending' && "bg-gray-600 text-gray-300"
              )}>
                <Icon 
                  className={cn(
                    "h-4 w-4",
                    step.status === 'current' && !isRetrying && "animate-spin",
                    isRetrying && "animate-spin"
                  )} 
                />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <h4 className={cn(
                    "font-medium",
                    step.status === 'completed' && "text-green-400",
                    step.status === 'current' && !isRetrying && "text-blue-400",
                    step.status === 'current' && isRetrying && "text-yellow-400",
                    step.status === 'error' && "text-red-400",
                    step.status === 'pending' && "text-gray-400"
                  )}>
                    {step.name}
                    {isRetrying && (
                      <span className="ml-2 text-xs text-yellow-300">
                        (повтор {retryCount}/{maxRetries ?? 3})
                      </span>
                    )}
                  </h4>
                  {step.estimatedTime && step.status === 'current' && (
                    <span className="text-xs text-gray-400 bg-gray-700 px-2 py-1 rounded">
                      ~{step.estimatedTime}
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500">
                  {step.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="mt-6 pt-4 border-t border-gray-700">
        <p className="text-xs text-gray-400 text-center">
          {error && !retryCount ? (
            "Пожалуйста, попробуйте позже или обратитесь в поддержку"
          ) : retryCount ? (
            `Автоматическая повторная попытка... Обычно проблемы решаются за несколько попыток.`
          ) : currentStepData?.status === 'current' ? (
            `Обычно ${currentStepData.name.toLowerCase()} занимает ${currentStepData.estimatedTime}`
          ) : (
            "Общее время создания: 2-3 минуты"
          )}
        </p>
      </div>
    </div>
  );
};

export default VideoCreationProgress;