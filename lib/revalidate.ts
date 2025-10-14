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
 * @param maxAttempts - Максимальное количество попыток (по умолчанию 2, минимум 1)
 * @returns Promise<boolean> - true если успешно, false при ошибке
 */
export async function revalidateCacheFromWorker(
  tag: string,
  maxAttempts: number = 2
): Promise<boolean> {
  // Используем NEXTAUTH_URL с fallback на NEXT_PUBLIC_APP_URL
  const base = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  
  // Безопасное построение URL с fallback на localhost при ошибке
  let endpointUrl: string;
  try {
    // Используем URL API для корректного построения endpoint (избегаем // и других проблем)
    endpointUrl = new URL('/api/revalidate', base).toString();
  } catch {
    logger.warn('Invalid base URL for revalidation, falling back to localhost', { base });
    endpointUrl = 'http://localhost:3000/api/revalidate';
  }
  
  // Нормализуем secret (убираем пробелы для соответствия с API route)
  const secret = process.env.REVALIDATE_SECRET?.trim();

  // Helper функция для clamp задержки в безопасный диапазон [0, 60000]ms
  const clampDelay = (ms: number) => Math.min(Math.max(0, ms), 60000);

  // Гарантируем хотя бы одну попытку даже если maxAttempts=0
  const attemptsAllowed = Math.max(1, maxAttempts);

  for (let attempt = 1; attempt <= attemptsAllowed; attempt++) {
    // Создаем контроллер для timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 секунд timeout

    try {
      const response = await fetch(endpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tag, secret }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
          
          // Не ретраим при клиентских ошибках (4xx кроме 429)
          // 400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found, 
          // 405 Method Not Allowed, 410 Gone, 422 Unprocessable Entity и т.д.
          // Эти ошибки указывают на проблемы с конфигурацией или авторизацией, которые не исчезнут при повторе
          const nonRetryable4xx = [400, 401, 403, 404, 405, 410, 422];
          if (nonRetryable4xx.includes(response.status)) {
            logger.warn('Failed to revalidate cache (client error, no retry)', {
              tag,
              status: response.status,
              error: errorData,
              attempt,
            });
            return false;
        }

        // Ретраим при серверных ошибках (5xx), 429 Too Many Requests, и 408 Request Timeout
        // 5xx = транзиентные проблемы сервера, 429 = rate limiting, 408 = таймаут запроса
        const shouldRetry = 
          (response.status >= 500 && response.status < 600) || 
          response.status === 429 ||
          response.status === 408;

        if (shouldRetry && attempt < attemptsAllowed) {
            let delay: number;
            
            // Обработка заголовка Retry-After для 429 Too Many Requests
            // RFC 7231: Retry-After может быть задержкой в секундах или HTTP-date
            if (response.status === 429) {
              const retryAfter = response.headers.get('Retry-After');
              if (retryAfter) {
                // Retry-After может быть в секундах или HTTP-date
                const retryAfterSeconds = parseInt(retryAfter, 10);
                if (!isNaN(retryAfterSeconds)) {
                  // Формат: количество секунд (например, "120")
                  delay = retryAfterSeconds * 1000;
                } else {
                  // Формат: HTTP-date (например, "Wed, 21 Oct 2015 07:28:00 GMT")
                  const retryDate = new Date(retryAfter);
                  const now = new Date();
                  const ms = retryDate.getTime() - now.getTime();
                  // Если дата невалидная (NaN) → fallback на экспоненциальную задержку
                  delay = Number.isFinite(ms) ? Math.max(0, ms) : Math.pow(2, attempt - 1) * 1000;
                }
                // Ограничиваем максимальную задержку 60 секундами для безопасности
                // Это предотвращает зависание воркера при некорректных значениях Retry-After
                delay = clampDelay(delay);
              } else {
                // Если заголовка нет, используем экспоненциальную задержку
                delay = Math.pow(2, attempt - 1) * 1000;
              }
            } else {
              // Для 5xx используем экспоненциальную задержку: 1s, 2s, 4s, ...
              delay = Math.pow(2, attempt - 1) * 1000;
            }

            // Добавляем небольшой jitter для предотвращения thundering herd
            const jitter = Math.floor(Math.random() * 250);
            // Финальный clamp после jitter гарантирует безопасный диапазон [0, 60000]ms
            delay = clampDelay(delay + jitter);

            logger.warn('Failed to revalidate cache, retrying', {
              tag,
              status: response.status,
              attempt,
              maxAttempts: attemptsAllowed,
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
    } catch (error) {
      const isTimeout = error instanceof Error && error.name === 'AbortError';
      // Расширенная проверка сетевых ошибок (undici/Node.js паттерны)
      const isNetworkError = error instanceof Error && (
        /fetch failed|network|ECONNREFUSED|ECONNRESET|EAI_AGAIN|ENOTFOUND|ETIMEDOUT/i.test(error.message)
      );

      // Ретраим только при timeout или сетевых ошибках
      if ((isTimeout || isNetworkError) && attempt < attemptsAllowed) {
        const baseDelay = Math.pow(2, attempt - 1) * 1000; // Экспоненциальная задержка
        const jitter = Math.floor(Math.random() * 250); // Добавляем jitter
        // Финальный clamp для безопасности
        const delay = clampDelay(baseDelay + jitter);
        
        logger.warn('Error revalidating cache (retrying)', {
          tag,
          error: error instanceof Error ? error.message : String(error),
          isTimeout,
          isNetworkError,
          attempt,
          maxAttempts: attemptsAllowed,
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
        maxAttempts: attemptsAllowed,
      });
      return false;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  return false;
}
