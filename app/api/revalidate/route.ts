import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { logger } from '@/lib/logger';

// Разрешенные теги для инвалидации кэша
// Это предотвращает потенциальное злоупотребление endpoint
const ALLOWED_TAGS = ['videos'] as const;
type AllowedTag = typeof ALLOWED_TAGS[number];

// Type guard для проверки тега в allowlist
const isAllowedTag = (t: string): t is AllowedTag =>
  (ALLOWED_TAGS as readonly string[]).includes(t);

/**
 * API endpoint для инвалидации кэша
 * Используется воркером для обновления кэша после завершения обработки видео
 * 
 * POST /api/revalidate
 * Body: { tag: string, secret?: string }
 * 
 * Note: Rate limiting должен быть настроен на уровне nginx/load balancer
 */
export async function POST(request: NextRequest) {
  try {
    // Безопасный парсинг JSON
    let body: any;
    try {
      body = await request.json();
    } catch {
      logger.warn('Revalidate: invalid JSON body');
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    let { tag, secret } = body;

    // Опциональная защита через secret (можно добавить переменную окружения)
    // Note: Rate limiting должен быть настроен на уровне nginx/load balancer
    // В production рекомендуется требовать secret для предотвращения злоупотребления
    const REVALIDATE_SECRET = process.env.REVALIDATE_SECRET;
    
    // Fail-closed: отклоняем запросы если secret не установлен в production
    if (process.env.NODE_ENV === 'production' && !REVALIDATE_SECRET) {
      logger.error('REVALIDATE_SECRET not set in production - endpoint is unprotected!');
      return NextResponse.json(
        { error: 'Endpoint disabled: missing REVALIDATE_SECRET' },
        { status: 503 }
      );
    }

    if (REVALIDATE_SECRET && secret !== REVALIDATE_SECRET) {
      logger.warn('Revalidate: unauthorized attempt', { tag });
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (!tag || typeof tag !== 'string') {
      return NextResponse.json(
        { error: 'Tag is required and must be a string' },
        { status: 400 }
      );
    }

    // Нормализуем тег (убираем пробелы)
    tag = tag.trim();

    if (!tag) {
      return NextResponse.json(
        { error: 'Tag cannot be empty' },
        { status: 400 }
      );
    }

    // Проверяем, что тег находится в разрешенном списке (type-safe)
    if (!isAllowedTag(tag)) {
      logger.warn('Revalidate: invalid tag attempted', { tag });
      return NextResponse.json(
        { error: 'Invalid tag' },
        { status: 400 }
      );
    }

    // Инвалидируем кэш по тегу
    revalidateTag(tag);

    logger.info('Cache revalidated successfully', { tag });

    return NextResponse.json({
      revalidated: true,
      tag,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Revalidate error', {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
