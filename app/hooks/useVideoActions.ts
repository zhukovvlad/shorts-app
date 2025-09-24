"use client";

import { useState } from "react";
import { toast } from "sonner";
import { deleteVideo } from "../lib/deleteVideo";
import { useRouter } from "next/navigation";

/**
 * Свойства для хука useVideoActions
 */
type UseVideoActionsProps = {
  /** Уникальный идентификатор видео */
  videoId: string;
  /** URL файла видео для скачивания, может быть null если недоступен */
  videoUrl: string | null;
  /** Опциональная функция обратного вызова, выполняемая после успешного удаления видео. 
   * Суффикс "Action" следует конвенции Next.js для Server Actions */
  onDeleteSuccessAction?: () => void;
};

/**
 * Возвращаемый тип для хука useVideoActions
 */
type UseVideoActionsReturn = {
  /** Функция для обработки скачивания видео */
  handleDownload: () => void;
  /** Функция для обработки копирования ссылки на видео в буфер обмена */
  handleCopyLink: () => Promise<void>;
  /** Функция для обработки удаления видео */
  handleDelete: () => Promise<void>;
  /** Логическое значение, указывающее, была ли недавно скопирована ссылка */
  copied: boolean;
  /** Логическое значение, указывающее, выполняется ли удаление */
  isDeleting: boolean;
};

/**
 * Пользовательский хук для обработки действий с видео (скачивание, копирование ссылки, удаление)
 * 
 * Этот хук предоставляет унифицированную функциональность для управления действиями с видео
 * с правильной обработкой ошибок, обратной связью пользователю через toast уведомления
 * и состояниями загрузки.
 * 
 * @param props - Объект конфигурации для хука
 * @param props.videoId - Уникальный идентификатор видео
 * @param props.videoUrl - URL файла видео, null если недоступен
 * @param props.onDeleteSuccessAction - Опциональный обратный вызов после успешного удаления (конвенция Next.js)
 * 
 * @returns Объект, содержащий обработчики действий и индикаторы состояния
 * 
 * @example
 * ```tsx
 * import { useRouter } from 'next/navigation';
 * 
 * function VideoComponent() {
 *   const router = useRouter();
 *   const { handleDownload, handleCopyLink, handleDelete, copied, isDeleting } = useVideoActions({
 *     videoId: "video-123",
 *     videoUrl: "https://example.com/video.mp4",
 *     onDeleteSuccessAction: () => router.push('/dashboard')
 *   });
 * 
 *   return (
 *     <div>
 *       <button onClick={handleDownload}>Скачать</button>
 *       <button onClick={handleCopyLink}>{copied ? 'Скопировано!' : 'Копировать ссылку'}</button>
 *       <button onClick={handleDelete} disabled={isDeleting}>
 *         {isDeleting ? 'Удаление...' : 'Удалить'}
 *       </button>
 *     </div>
 *   );
 * }
 * ```
 */
export const useVideoActions = ({
  videoId,
  videoUrl,
  onDeleteSuccessAction,
}: UseVideoActionsProps): UseVideoActionsReturn => {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  /**
   * Обрабатывает скачивание видео, создавая временную ссылку для загрузки
   * 
   * Валидирует URL на безопасные протоколы (http:, https:, blob:) для предотвращения XSS атак.
   * Создает элемент anchor с атрибутами для скачивания и запускает загрузку.
   * Показывает toast уведомления об успехе/ошибке в зависимости от результата.
   * 
   * @returns void
   */
  const handleDownload = (): void => {
    if (!videoUrl) {
      toast.error("Download failed", {
        description: "Video file is not available.",
      });
      return;
    }

    try {
      // Parse and allowlist URL protocols to prevent injection
      const parsed = new URL(videoUrl, window.location.href);
      const allowed = new Set(["http:", "https:", "blob:"]);
      if (!allowed.has(parsed.protocol)) {
        toast.error("Download failed", {
          description: "Unsupported video URL.",
        });
        return;
      }
      
      const a = document.createElement("a");
      a.href = parsed.toString();
      a.download = `video-${videoId}.mp4`;
      a.target = "_blank";
      a.rel = "noopener noreferrer"; // mitigate reverse-tabnabbing when _blank is used
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      toast.success("Download started", {
        description: "Your video is being downloaded.",
      });
    } catch (error) {
      console.error("Download failed:", error);
      toast.error("Download failed", {
        description: "An error occurred while downloading the video.",
      });
    }
  };

  /**
   * Копирует ссылку на видео в буфер обмена пользователя
   * 
   * Проверяет поддержку Clipboard API, копирует URL видео в буфер обмена
   * и предоставляет визуальную обратную связь. Состояние скопированности сбрасывается через 2 секунды.
   * 
   * @returns Promise<void>
   */
  const handleCopyLink = async (): Promise<void> => {
    // Check if Clipboard API is supported
    if (!navigator.clipboard) {
      toast.error("Copy failed", {
        description: "Clipboard is not supported in this browser.",
      });
      return;
    }

    try {
      const videoLink = `${window.location.origin}/videos/${videoId}`;
      await navigator.clipboard.writeText(videoLink);
      
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);

      toast.success("Link copied", {
        description: "Video link copied to clipboard.",
      });
    } catch (error) {
      console.error("Failed to copy link:", error);
      toast.error("Copy failed", {
        description: "Failed to copy link to clipboard.",
      });
    }
  };

  /**
   * Обрабатывает удаление видео с правильной обработкой ошибок и обратной связью пользователю
   * 
   * Вызывает серверное действие deleteVideo, обрабатывает различные состояния ошибок
   * и предоставляет соответствующую обратную связь пользователю. Выполняет обратный вызов
   * onDeleteSuccessAction или обновляет роутер, если обратный вызов не предоставлен.
   * 
   * @returns Promise<void>
   */
  const handleDelete = async (): Promise<void> => {
    setIsDeleting(true);

    try {
      const result = await deleteVideo(videoId);
      
      if (!result) {
        toast.error("Delete failed", {
          description: "You must be logged in to delete videos.",
        });
        return;
      }

      if (result.success) {
        toast.success("Video deleted", {
          description: "The video has been deleted successfully.",
        });

        if (onDeleteSuccessAction) {
          onDeleteSuccessAction();
        } else {
          router.refresh();
        }
      } else {
        toast.error("Delete failed", {
          description: result.error || "Failed to delete video.",
        });
      }
    } catch (error) {
      console.error("Delete operation failed:", error);
      toast.error("Delete failed", { 
        description: "An unexpected error occurred while deleting the video." 
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return {
    handleDownload,
    handleCopyLink,
    handleDelete,
    copied,
    isDeleting,
  };
};
