"use client";

import { useEffect, useState } from 'react';
import { VideoProgress } from '@/lib/redis';

// Тип для ответа API, который включает videoId но не содержит timestamp и userId
interface VideoProgressResponse {
  status: 'script' | 'images' | 'audio' | 'captions' | 'render' | 'completed' | 'error';
  step?: string;
  videoId?: string;
  error?: string;
}

export const useVideoProgress = (videoId: string | null) => {
  const [progress, setProgress] = useState<VideoProgressResponse>({ status: 'script' });
  const [isPolling, setIsPolling] = useState(false);

  useEffect(() => {
    if (!videoId) return;

    let interval: NodeJS.Timeout;
    
    const checkProgress = async () => {
      try {
        const response = await fetch(`/api/video/${videoId}/progress`);
        const data: VideoProgressResponse = await response.json();
        
        setProgress(data);
        
        // Останавливаем polling если видео готово или ошибка
        if (data.status === 'completed' || data.status === 'error') {
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