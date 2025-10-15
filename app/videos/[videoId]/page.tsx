import { VideoActions } from "@/app/components/videoActions";
import { prisma } from "@/app/lib/db";
import { findPrompt } from "@/app/lib/findPrompt";
import { AnimatedShinyText } from "@/components/ui/animated-shiny-text";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { auth } from "@/auth";
import { ArrowRightIcon, Clock3, Film, Calendar } from "lucide-react";
import { ImageGallery } from "@/app/components/ImageGallery";
import { Transcript } from "@/app/components/Transcript";
import { Badge } from "@/components/ui/badge";
import { logger } from "@/lib/logger";

const page = async ({ params }: { params: Promise<{ videoId: string }> }) => {
    const { videoId } = await params;
    const session = await auth();

    if (!session?.user?.id) {
        return null
    }

    const userId = session.user.id;
    const prompt = await findPrompt(videoId)

    // Fetch video with owner constraint to prevent leaking other users' videos
    let video;
    try {
        video = await prisma.video.findUnique({
            where: { 
                videoId: videoId,
                userId: userId // Only return if current user is the owner
            }
        })
    } catch (error) {
        logger.error('Video page: database error occurred', {
            error: error instanceof Error ? error.message : 'unknown error',
            stack: error instanceof Error ? error.stack : undefined,
            videoId,
            userId
        });
        // Fail-soft on DB errors
        return (
            <div className="min-h-screen w-full relative overflow-x-hidden">
                <div className="mx-auto max-w-7xl px-4 pt-3 pb-6">
                    <p className="text-sm text-white/80">Video is unavailable right now. Please try again later.</p>
                </div>
            </div>
        )
    }

    if (!video) {
        // Not found or not owned by current user
        return (
            <div className="min-h-screen w-full relative overflow-x-hidden">
                <div className="mx-auto max-w-7xl px-4 pt-3 pb-6">
                    <p className="text-sm text-white/80">Video is unavailable right now. Please try again later.</p>
                </div>
            </div>
        )
    }

    const isOwner = true; // Always true now since query includes userId constraint
    const videoUrl = video?.videoUrl;
    const transcript = video?.content;

    // transcript can be missing, we render the rest of the page

    return (
        <div className="min-h-screen w-full relative overflow-x-hidden">
            <div className="mx-auto max-w-7xl px-3 sm:px-4 pt-2 sm:pt-3 pb-4 sm:pb-6">
                <div className="grid gap-y-3 gap-x-6 lg:grid-cols-[460px_1fr] lg:gap-y-4 lg:gap-x-8">
                    {/* Top bar: Actions row */}
                    <div className="mb-2 sm:mb-0 lg:col-span-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
                        {/* Left: actions, constrained to video column width on desktop */}
                        <div className="min-w-0 lg:w-[460px]">
                            <VideoActions
                                videoId={videoId}
                                videoUrl={videoUrl}
                                isOwner={isOwner}
                                layout="row"
                                showBackButton={false}
                            />
                        </div>
                        {/* Right: back button */}
                        <div className="flex justify-start sm:justify-end">
                            <VideoActions
                                videoId={videoId}
                                videoUrl={videoUrl}
                                isOwner={isOwner}
                                layout="row"
                                onlyBackButton
                            />
                        </div>
                    </div>

                    {/* Left: Video (sticky on desktop) */}
                    <div className="w-full lg:sticky lg:top-16 self-start">
                        <div className="aspect-[9/16] bg-black rounded-xl sm:rounded-2xl overflow-hidden mx-auto max-w-[460px] shadow-lg shadow-black/40 border border-white/10">
                            <video
                                key={videoId}
                                className="w-full h-full object-cover"
                                controls
                                playsInline
                                src={videoUrl ?? undefined}
                            >
                                Your old browser does not support the video tag.
                            </video>
                        </div>
                    </div>

                    {/* Right: Details */}
                    <div className="flex-1 flex flex-col gap-4 sm:gap-6 lg:mt-2">
                        {/* Header row: prompt + meta */}
                        <div className="space-y-2 sm:space-y-3">
                            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                                <div
                                    className={cn(
                                        "group rounded-full border border-black/5 bg-neutral-100 text-base text-white transition-all ease-in hover:cursor-default dark:border-white/5 dark:bg-neutral-800",
                                    )}
                                >
                                    <AnimatedShinyText className="inline-flex items-center justify-center px-2.5 sm:px-3.5 py-0.5 sm:py-1 text-xs sm:text-sm">
                                        <span>✨ Prompt</span>
                                        <ArrowRightIcon className="ml-1 size-2.5 sm:size-3" />
                                    </AnimatedShinyText>
                                </div>
                                {video.duration ? (
                                    <Badge variant="secondary" className="gap-1 text-xs sm:text-sm px-2 sm:px-2.5 py-0.5 h-6 sm:h-auto">
                                        <Clock3 className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> {Math.round((video.duration || 0) / 30)}s
                                    </Badge>
                                ) : null}
                                <Badge variant="secondary" className="gap-1 text-xs sm:text-sm px-2 sm:px-2.5 py-0.5 h-6 sm:h-auto">
                                    <Film className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> {video.imageLinks?.length || 0}
                                </Badge>
                                <Badge variant="secondary" className="gap-1 hidden sm:flex">
                                    <Calendar className="h-3.5 w-3.5" /> {new Date(video.createdAt).toLocaleDateString()}
                                </Badge>
                            </div>
                            {prompt && (
                            <Textarea
                                className="rounded w-full max-w-3xl text-black text-sm resize-none min-h-[60px]"
                                style={{ background: "#eee" }}
                                defaultValue={prompt}
                                disabled
                                rows={3}
                            />
                            )}
                        </div>

                        {/* Transcript */}
                        {transcript ? (
                            <Transcript text={transcript} />
                        ) : (
                            <div className="text-xs sm:text-sm text-white/60">Transcript is not available.</div>
                        )}

                        {/* Images Thumbnails */}
                        {video.imageLinks && video.imageLinks.length > 0 && (
                            <ImageGallery imageLinks={video.imageLinks} />
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

export default page