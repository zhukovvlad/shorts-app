import { auth } from "@clerk/nextjs/server";
import React from "react";
import { prisma, withRetry } from "../lib/db";
import { VideoCard } from "../components/videoCard";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { DashboardEmptyState } from "../components/DashboardEmptyState";
import { RefreshButton } from "../components/RefreshButton";
import { logger } from "@/lib/logger";
import { unstable_cache } from 'next/cache';

// Кэшированная функция для получения видео
const getCachedVideos = unstable_cache(
  async (userId: string) => {
    logger.debug('Dashboard: Starting cached database query', { userId });
    
    const videos = await withRetry(async () => {
      return await prisma.video.findMany({
        where: {
          userId: userId,
        },
        orderBy: {
          createdAt: "desc",
        },
        // Добавляем лимит для улучшения производительности
        take: 100,
      });
    });
    
    logger.debug('Dashboard: fetched videos', { count: videos.length });
    return videos;
  },
  ['user-videos'],
  {
    revalidate: 30, // Кэш на 30 секунд
    tags: ['videos'],
  }
);

const Dashboard = async () => {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  let videos: any[] = [];
  
  try {
    videos = await getCachedVideos(userId);
  } catch (error: any) {
    logger.error("Database error", { error: error.message });
    // Handle database error - return empty array but log error for debugging
    videos = [];
  }

  // Анализируем статусы видео для умного отображения
  const completedVideos = videos.filter(video => !video.processing && !video.failed && !!video.videoUrl);
  const processingVideos = videos.filter(video => video.processing);
  const errorVideos = videos.filter(video => video.failed === true);

  const getEmptyStateVariant = () => {
    if (videos.length === 0) return 'no-videos';
    if (completedVideos.length === 0 && processingVideos.length > 0) return 'all-processing';
    return 'mixed';
  };

  return (
    <div className="container mx-auto p-4 sm:p-6 mt-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white">Your Videos</h1>
          {videos.length > 0 && (
            <p className="text-gray-400 mt-1">
              {completedVideos.length} готово
              {processingVideos.length > 0 && `, ${processingVideos.length} обрабатывается`}
              {errorVideos.length > 0 && `, ${errorVideos.length} с ошибками`}
            </p>
          )}
        </div>
        
        {videos.length > 0 && (
          <div className="flex gap-2">
            <RefreshButton />
          </div>
        )}
      </div>

      {/* Content */}
      {videos.length === 0 ? (
        <DashboardEmptyState variant="no-videos" />
      ) : completedVideos.length === 0 && processingVideos.length > 0 ? (
        <DashboardEmptyState 
          variant="all-processing" 
          processingCount={processingVideos.length}
        />
      ) : (
        <>
          {/* Processing status banner */}
          {processingVideos.length > 0 && (
            <DashboardEmptyState 
              variant="mixed"
              totalVideos={videos.length}
              processingCount={processingVideos.length}
            />
          )}
          
          {/* Videos grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
            {videos.map((video) => (
              <VideoCard key={video.videoId} video={video} />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default Dashboard;