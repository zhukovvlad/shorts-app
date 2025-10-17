import { prisma } from "./db";
import { logger } from "@/lib/logger";
import { DEFAULT_VIDEO_DURATION_FRAMES } from "@/app/constants/video";

interface Caption {
  endFrame?: number;
  [key: string]: unknown;
}

export const videoDuration = async (videoId: string) => {
  const video = await prisma.video.findUnique({
    where: { videoId },
  });

  if (!video?.captions) {
    logger.warn('No captions found for video, setting default duration', { videoId });
    await prisma.video.update({
      where: { videoId },
      data: { duration: DEFAULT_VIDEO_DURATION_FRAMES },
    });
    return;
  }

  const captions = video.captions as Caption[];
  if (!Array.isArray(captions) || captions.length === 0) {
    logger.warn('Invalid captions data for video, setting default duration', { videoId });
    await prisma.video.update({
      where: { videoId },
      data: { duration: DEFAULT_VIDEO_DURATION_FRAMES },
    });
    return;
  }

  const calculateDuration = Number(captions[captions.length - 1]?.endFrame);
  
  if (!Number.isFinite(calculateDuration) || calculateDuration < 0) {
    logger.warn('Invalid calculated duration for video, setting default duration', { videoId, duration: calculateDuration });
    await prisma.video.update({
      where: { videoId },
      data: { duration: DEFAULT_VIDEO_DURATION_FRAMES },
    });
    return;
  }

  await prisma.video.update({
    where: { videoId },
    data: { duration: calculateDuration },
  });
};
