/**
 * Утилита для инвалидации кэша из воркера
 * 
 * Так как воркер работает вне контекста Next.js, он не может напрямую
 * использовать revalidateTag. Вместо этого мы делаем HTTP запрос к API endpoint.
 */

import { logger } from './logger';

/**
 * Инвалидирует кэш по тегу через API endpoint с retry логикой
 * 
 * @param tag - Тег кэша для инвалидации (например, 'videos')
 * @param maxRetries - Максимальное количество попыток (по умолчанию 2)
 * @returns Promise<boolean> - true если успешно, false при ошибке
 */
export async function revalidateCacheFromWorker(
  tag: string,
  maxRetries: number = 2
): Promise<boolean> {
  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
  const secret = process.env.REVALIDATE_SECRET;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Создаем контроллер для timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 секунд timeout

      try {
        const response = await fetch(`${baseUrl}/api/revalidate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ tag, secret }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          
          // Не ретраим при 400/401 ошибках (неправильный запрос)
          if (response.status === 400 || response.status === 401) {
            logger.warn('Failed to revalidate cache (client error, no retry)', {
              tag,
              status: response.status,
              error: errorData,
              attempt,
            });
            return false;
          }

          // Ретраим при серверных ошибках (5xx)
          if (attempt < maxRetries) {
            const delay = Math.pow(2, attempt - 1) * 1000; // Экспоненциальная задержка
            logger.warn('Failed to revalidate cache, retrying', {
              tag,
              status: response.status,
              attempt,
              maxRetries,
              retryAfterMs: delay,
            });
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }

          logger.warn('Failed to revalidate cache (final attempt)', {
            tag,
            status: response.status,
            error: errorData,
            attempt,
          });
          return false;
        }

        const data = await response.json();
        logger.debug('Cache revalidated successfully', { tag, data, attempt });
        return true;
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (error) {
      const isTimeout = error instanceof Error && error.name === 'AbortError';
      const isNetworkError = error instanceof Error && (
        error.message.includes('fetch failed') ||
        error.message.includes('network') ||
        error.message.includes('ECONNREFUSED')
      );

      // Ретраим только при timeout или сетевых ошибках
      if ((isTimeout || isNetworkError) && attempt < maxRetries) {
        const delay = Math.pow(2, attempt - 1) * 1000; // Экспоненциальная задержка
        logger.warn('Error revalidating cache (retrying)', {
          tag,
          error: error instanceof Error ? error.message : String(error),
          isTimeout,
          isNetworkError,
          attempt,
          maxRetries,
          retryAfterMs: delay,
        });
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      // Финальная ошибка
      logger.error('Error revalidating cache from worker (final attempt)', {
        tag,
        error: error instanceof Error ? error.message : String(error),
        attempt,
        maxRetries,
      });
      return false;
    }
  }

  return false;
}
