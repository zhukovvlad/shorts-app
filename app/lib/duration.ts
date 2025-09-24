import { prisma } from "./db";

export const videoDuration = async (videoId: string) => {
  const video = await prisma.video.findUnique({
    where: { videoId },
  });

  if (!video?.captions) {
    console.warn(`No captions found for video ${videoId}, setting default duration`);
    await prisma.video.update({
      where: { videoId },
      data: { duration: 180 }, // 6 seconds at 30fps as default
    });
    return;
  }

  const captions = video.captions as any[];
  if (!Array.isArray(captions) || captions.length === 0) {
    console.warn(`Invalid captions data for video ${videoId}, setting default duration`);
    await prisma.video.update({
      where: { videoId },
      data: { duration: 180 }, // 6 seconds at 30fps as default
    });
    return;
  }

  const calculateDuration = captions[captions.length - 1]?.endFrame;
  
  if (!calculateDuration || calculateDuration <= 0) {
    console.warn(`Invalid calculated duration for video ${videoId}, setting default duration`);
    await prisma.video.update({
      where: { videoId },
      data: { duration: 180 }, // 6 seconds at 30fps as default
    });
    return;
  }

  await prisma.video.update({
    where: { videoId },
    data: { duration: calculateDuration },
  });
};
