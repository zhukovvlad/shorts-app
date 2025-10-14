/**
 * Утилита для инвалидации кэша из воркера
 * 
 * Так как воркер работает вне контекста Next.js, он не может напрямую
 * использовать revalidateTag. Вместо этого мы делаем HTTP запрос к API endpoint.
 */

import { logger } from './logger';

/**
 * Инвалидирует кэш по тегу через API endpoint
 * 
 * @param tag - Тег кэша для инвалидации (например, 'videos')
 * @returns Promise<boolean> - true если успешно, false при ошибке
 */
export async function revalidateCacheFromWorker(tag: string): Promise<boolean> {
  try {
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const secret = process.env.REVALIDATE_SECRET;

    const response = await fetch(`${baseUrl}/api/revalidate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ tag, secret }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      logger.warn('Failed to revalidate cache', {
        tag,
        status: response.status,
        error: errorData,
      });
      return false;
    }

    const data = await response.json();
    logger.debug('Cache revalidated successfully', { tag, data });
    return true;
  } catch (error) {
    logger.error('Error revalidating cache from worker', {
      tag,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}
