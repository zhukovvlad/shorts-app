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
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

const ITEMS_PER_PAGE = 20;

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
        // Получаем все видео для корректной пагинации
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

const Dashboard = async ({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) => {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const params = await searchParams;
  const currentPage = Number(params.page) || 1;

  let videos: any[] = [];
  
  try {
    videos = await getCachedVideos(userId);
  } catch (error: any) {
    logger.error("Database error", { error: error.message });
    // Handle database error - return empty array but log error for debugging
    videos = [];
  }

  // Вычисляем пагинацию
  const totalVideos = videos.length;
  const totalPages = Math.ceil(totalVideos / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedVideos = videos.slice(startIndex, endIndex);

  // Анализируем статусы видео для умного отображения (используем все видео для статистики)
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 sm:gap-6">
            {paginatedVideos.map((video, index) => (
              <VideoCard 
                key={video.videoId} 
                video={video} 
                priority={index < 5}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-8 flex justify-center">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious 
                      href={currentPage > 1 ? `/dashboard?page=${currentPage - 1}` : '#'}
                      className={currentPage <= 1 ? 'pointer-events-none opacity-50' : ''}
                    />
                  </PaginationItem>
                  
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                    // Показываем первую, последнюю, текущую и соседние страницы
                    const showPage = 
                      page === 1 || 
                      page === totalPages || 
                      (page >= currentPage - 1 && page <= currentPage + 1);
                    
                    const showEllipsisBefore = page === currentPage - 2 && currentPage > 3;
                    const showEllipsisAfter = page === currentPage + 2 && currentPage < totalPages - 2;

                    if (showEllipsisBefore || showEllipsisAfter) {
                      return (
                        <PaginationItem key={page}>
                          <PaginationEllipsis />
                        </PaginationItem>
                      );
                    }

                    if (!showPage) return null;

                    return (
                      <PaginationItem key={page}>
                        <PaginationLink 
                          href={`/dashboard?page=${page}`}
                          isActive={currentPage === page}
                        >
                          {page}
                        </PaginationLink>
                      </PaginationItem>
                    );
                  })}
                  
                  <PaginationItem>
                    <PaginationNext 
                      href={currentPage < totalPages ? `/dashboard?page=${currentPage + 1}` : '#'}
                      className={currentPage >= totalPages ? 'pointer-events-none opacity-50' : ''}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Dashboard;