import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { logger } from '@/lib/logger';

/**
 * API endpoint для инвалидации кэша
 * Используется воркером для обновления кэша после завершения обработки видео
 * 
 * POST /api/revalidate
 * Body: { tag: string, secret?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tag, secret } = body;

    // Опциональная защита через secret (можно добавить переменную окружения)
    const REVALIDATE_SECRET = process.env.REVALIDATE_SECRET;
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
