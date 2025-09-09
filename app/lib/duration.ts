import { prisma } from "./db";

export const videoDuration = async (videoId: string) => {
  const video = await prisma.video.findUnique({
    where: { videoId },
  });

  const captions = video?.captions as any[];
  const calculateDuration = captions[captions.length - 1]?.endFrame;

  await prisma.video.update({
    where: { videoId },
    data: { duration: calculateDuration },
  });
};
