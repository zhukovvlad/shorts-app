import { prisma } from "@/app/lib/db";
import { getRenderProgress, renderMediaOnLambda } from "@remotion/lambda/client";

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
                console.log("render failed:", progress.errors);
            }
            if (progress.done) {
                const videoUrl = progress.outputFile || `https://${bucketName}.s3.eu-north-1.amazonaws.com/${renderId}/out.mp4`;
                console.log("render completed:", videoUrl);

                await prisma.video.update({
                    where: { videoId },
                    data: { videoUrl, processing: false }
                })

                return videoUrl;
            }

            const framesRendered = progress.framesRendered || 0;
            const percent = Math.floor(progress.overallProgress * 100);

            console.log((`progress is ${percent}, frames rendered: ${framesRendered}`));
        }
    } catch (error) {
        console.error('error while rendering video in remotion:', error);
        throw error;
    }
};