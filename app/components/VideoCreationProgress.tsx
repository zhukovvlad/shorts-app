"use client";

import { CheckCircle, Clock, Loader2 } from "lucide-react";
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
  className 
}: VideoCreationProgressProps) => {
  // Обновляем статусы шагов на основе текущего шага
  const steps = defaultSteps.map(step => {
    const stepIndex = defaultSteps.findIndex(s => s.id === step.id);
    const currentIndex = defaultSteps.findIndex(s => s.id === currentStep);
    
    if (error && step.id === currentStep) {
      return { ...step, status: 'error' as const };
    } else if (stepIndex < currentIndex) {
      return { ...step, status: 'completed' as const };
    } else if (step.id === currentStep) {
      return { ...step, status: 'current' as const };
    } else {
      return { ...step, status: 'pending' as const };
    }
  });

  const currentStepData = steps.find(step => step.id === currentStep);
  const completedSteps = steps.filter(step => step.status === 'completed').length;
  const totalSteps = steps.length;
  const progressPercentage = (completedSteps / totalSteps) * 100;

  return (
    <div className={cn("w-full max-w-2xl mx-auto p-6 bg-gray-800/50 rounded-xl border border-gray-700", className)}>
      {/* Header */}
      <div className="text-center mb-6">
        <h3 className="text-xl font-semibold text-white mb-2">
          Создание вашего видео
        </h3>
        {error ? (
          <p className="text-red-400 text-sm">Произошла ошибка: {error}</p>
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
          <span className="text-sm text-gray-400">{Math.round(progressPercentage)}%</span>
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
        {steps.map((step, index) => {
          const Icon = step.status === 'completed' 
            ? CheckCircle 
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
                step.status === 'current' && "bg-blue-500/10 border border-blue-500/20",
                step.status === 'completed' && "bg-green-500/10 border border-green-500/20",
                step.status === 'error' && "bg-red-500/10 border border-red-500/20",
                step.status === 'pending' && "bg-gray-700/30"
              )}
            >
              {/* Icon */}
              <div className={cn(
                "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
                step.status === 'completed' && "bg-green-500 text-white",
                step.status === 'current' && "bg-blue-500 text-white",
                step.status === 'error' && "bg-red-500 text-white", 
                step.status === 'pending' && "bg-gray-600 text-gray-300"
              )}>
                <Icon 
                  className={cn(
                    "h-4 w-4",
                    step.status === 'current' && "animate-spin"
                  )} 
                />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <h4 className={cn(
                    "font-medium",
                    step.status === 'completed' && "text-green-400",
                    step.status === 'current' && "text-blue-400",
                    step.status === 'error' && "text-red-400",
                    step.status === 'pending' && "text-gray-400"
                  )}>
                    {step.name}
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
          {error ? (
            "Пожалуйста, попробуйте позже или обратитесь в поддержку"
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