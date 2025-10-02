import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getVideoProgress } from '@/lib/redis';
import { prisma } from '@/app/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { videoId } = await params;
    
    // Сначала проверяем Redis
    const progress = await getVideoProgress(videoId);
    
    if (progress) {
      // Проверяем, что пользователь имеет доступ к этому видео
      if (progress.userId !== userId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      
      return NextResponse.json({
        status: progress.status,
        step: progress.step,
        error: progress.error,
        retryCount: progress.retryCount,
        maxRetries: progress.maxRetries,
        lastError: progress.lastError,
        retryReason: progress.retryReason,
        currentStepId: progress.currentStepId,
        videoId
      });
    }

    // Если нет в Redis, проверяем финальное состояние в БД
    const video = await prisma.video.findFirst({
      where: { videoId, userId },
      select: {
        processing: true,
        failed: true,
        videoUrl: true
      }
    });

    if (!video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    // Определяем финальный статус
    let status = 'completed';
    if (video.failed) {
      status = 'error';
    } else if (video.processing) {
      status = 'render'; // Если еще обрабатывается, но нет в Redis
    }

    return NextResponse.json({ status, videoId });

  } catch (error) {
    console.error('Progress check error:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}