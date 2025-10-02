"use client";

import { useEffect, useState, useRef } from 'react';
import { VideoProgress } from '@/lib/redis';
import { toast } from "sonner";

// Тип для ответа API, который включает videoId но не содержит timestamp и userId
interface VideoProgressResponse {
  status: 'script' | 'images' | 'audio' | 'captions' | 'render' | 'completed' | 'error' | 'retrying';
  step?: string;
  videoId?: string;
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
}

export const useVideoProgress = (videoId: string | null) => {
  const [progress, setProgress] = useState<VideoProgressResponse>({ status: 'script' });
  const [isPolling, setIsPolling] = useState(false);
  const lastProgressRef = useRef<VideoProgressResponse>({ status: 'script' });

  useEffect(() => {
    if (!videoId) return;

    let interval: NodeJS.Timeout;
    
    const checkProgress = async () => {
      try {
        const response = await fetch(`/api/video/${videoId}/progress`);
        const data: VideoProgressResponse = await response.json();
        
        // Логируем данные для отладки (только в development)
        if (process.env.NODE_ENV === 'development') {
          console.log('📊 Progress:', data.status, 
            data.completedSteps ? `(${Object.values(data.completedSteps).filter(Boolean).length}/5 completed)` : '(no checkpoint)');
        }
        
        // Проверяем изменения для показа уведомлений
        const lastProgress = lastProgressRef.current;
        
        // Уведомление о начале ретрая
        if (data.status === 'retrying' && lastProgress.status !== 'retrying') {
          toast.warning(`Повторная попытка ${data.retryCount}/${data.maxRetries}`, {
            description: data.retryReason || 'Возникла временная ошибка, пытаемся снова...',
            duration: 4000,
          });
        }
        
        // Уведомление об ошибке с предстоящим ретраем
        if (data.status === 'error' && data.retryCount && lastProgress.status !== 'error') {
          toast.error('Произошла ошибка', {
            description: `${data.error} Автоматически попробуем еще раз...`,
            duration: 3000,
          });
        }
        
        // Уведомление о финальной ошибке (без ретрая)
        if (data.status === 'error' && !data.retryCount && lastProgress.status !== 'error') {
          toast.error('Ошибка создания видео', {
            description: data.error || 'Произошла неизвестная ошибка',
            duration: 6000,
          });
        }
        
        // Уведомление об успешном завершении
        if (data.status === 'completed' && lastProgress.status !== 'completed') {
          toast.success('Видео готово!', {
            description: 'Ваше видео успешно создано и готово к просмотру',
            duration: 5000,
          });
        }
        
        setProgress(data);
        lastProgressRef.current = data;
        
        // Останавливаем polling только при успешном завершении или ФИНАЛЬНОЙ ошибке
        // Продолжаем polling при ретраях (status='error' с retryCount > 0)
        if (data.status === 'completed') {
          setIsPolling(false);
          clearInterval(interval);
        } else if (data.status === 'error' && !data.retryCount) {
          // Финальная ошибка без предстоящих ретраев - останавливаем
          setIsPolling(false);
          clearInterval(interval);
        }
        // Если status='error' И есть retryCount - продолжаем polling
        // Если status='retrying' - продолжаем polling
      } catch (error) {
        console.error('Failed to check progress:', error);
      }
    };

    setIsPolling(true);
    interval = setInterval(checkProgress, 1000); // Проверяем каждую секунду
    checkProgress(); // Первая проверка сразу

    return () => {
      clearInterval(interval);
      setIsPolling(false);
    };
  }, [videoId]);

  return { progress, isPolling };
};