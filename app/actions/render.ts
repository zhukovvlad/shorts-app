import { prisma } from "@/app/lib/db";
import { getRenderProgress, renderMediaOnLambda } from "@remotion/lambda/client";
import { logger } from "@/lib/logger";

export const renderVideo = async (videoId: string) => {
    try {
        const data = await prisma.video.findUnique({
            where: { videoId },
        });

        if (!data) {
            return undefined;
        }

        const { bucketName, renderId } = await renderMediaOnLambda({
            region: "eu-north-1",
            functionName: "remotion-render-4-0-345-mem2048mb-disk2048mb-120sec",
            composition: "MyVideo",
            serveUrl: "https://remotionlambda-eunorth1-835ln9mr0e.s3.eu-north-1.amazonaws.com/sites/shorts-app/index.html",
            codec: "h264",
            inputProps: {
                imageLinks: data.imageLinks,
                audio: data.audio,
                captions: data.captions,
                durationInFrames: data.duration && data.duration > 0 ? data.duration : 180, // Default to 6 seconds at 30fps
            },
            framesPerLambda: 400,
        })

        while (true) {
            const progress = await getRenderProgress({
                region: "eu-north-1",
                functionName: "remotion-render-4-0-345-mem2048mb-disk2048mb-120sec",
                renderId,
                bucketName
            });
            if (progress.fatalErrorEncountered) {
                logger.error("Render failed", {
                  errors: progress.errors
                });
            }
            if (progress.done) {
                const videoUrl = progress.outputFile || `https://${bucketName}.s3.eu-north-1.amazonaws.com/${renderId}/out.mp4`;
                logger.info("Render completed", { renderId });

                await prisma.video.update({
                    where: { videoId },
                    data: { videoUrl, processing: false }
                })

                return videoUrl;
            }

            const framesRendered = progress.framesRendered || 0;
            const percent = Math.floor(progress.overallProgress * 100);

            logger.info((`progress is ${percent}, frames rendered: ${framesRendered}`));
        }
    } catch (error) {
        logger.error('Error while rendering video in remotion', {
          error: error instanceof Error ? error.message : String(error)
        });
        throw error;
    }
};