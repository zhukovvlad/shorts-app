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
        
        // Останавливаем polling если видео готово или ошибка (но не ретрай)
        if (data.status === 'completed' || (data.status === 'error' && !data.retryCount)) {
          setIsPolling(false);
          clearInterval(interval);
        }
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