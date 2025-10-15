import { VideoActions } from "@/app/components/videoActions";
import { prisma } from "@/app/lib/db";
import { findPrompt } from "@/app/lib/findPrompt";
import { AnimatedShinyText } from "@/components/ui/animated-shiny-text";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { auth } from "@/auth";
import { ArrowRightIcon, Clock3, Film, Calendar } from "lucide-react";
import { ImageGallery } from "@/app/components/ImageGallery";
import { Transcript } from "@/app/components/Transcript";
import { Badge } from "@/components/ui/badge";

const page = async ({ params }: { params: Promise<{ videoId: string }> }) => {
    const { videoId } = await params;
    const session = await auth();

    if (!session?.user?.id) {
        return null
    }

    const userId = session.user.id;
    const prompt = await findPrompt(videoId)

    const video = await prisma.video.findUnique({
        where: { videoId: videoId }
    })

    if (!video) {
        // Soft empty state when video not found or DB down
        return (
            <div className="min-h-screen w-full relative overflow-x-hidden">
                <div className="mx-auto max-w-7xl px-4 pt-3 pb-6">
                    <p className="text-sm text-white/80">Video is unavailable right now. Please try again later.</p>
                </div>
            </div>
        )
    }

    const isOwner = userId === video.userId;
    const videoUrl = video?.videoUrl;
    const transcript = video?.content;

    // transcript can be missing, we render the rest of the page

    return (
        <div className="min-h-screen w-full relative overflow-x-hidden">
            <div className="mx-auto max-w-7xl px-4 pt-3 pb-6">
                <div className="grid gap-y-3 gap-x-6 lg:grid-cols-[460px_1fr] lg:gap-y-4 lg:gap-x-8">
                    {/* Top bar: full-width, actions aligned to video column, back at container right */}
                    <div className="mb-0 lg:mb-0 lg:col-span-2 flex items-center justify-between gap-3">
                        {/* Left: actions, constrained to video column width */}
                        <div className="min-w-0 lg:w-[460px]">
                            <VideoActions
                                videoId={videoId}
                                videoUrl={videoUrl}
                                isOwner={isOwner}
                                layout="row"
                                showBackButton={false}
                            />
                        </div>
                        {/* Right: back aligned to container right */}
                        <div className="hidden sm:flex justify-end pr-1">
                            <VideoActions
                                videoId={videoId}
                                videoUrl={videoUrl}
                                isOwner={isOwner}
                                layout="row"
                                onlyBackButton
                            />
                        </div>
                        {/* Mobile back under actions */}
                        <div className="sm:hidden mt-2">
                            <VideoActions
                                videoId={videoId}
                                videoUrl={videoUrl}
                                isOwner={isOwner}
                                layout="row"
                                onlyBackButton
                            />
                        </div>
                    </div>
                    {/* Left: Video (sticky) */}
                    <div className="w-full lg:sticky lg:top-16 self-start">
                        <div className="aspect-[9/16] bg-black rounded-2xl overflow-hidden mx-auto max-w-[460px] shadow-lg shadow-black/40 border border-white/10">
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
                    <div className="flex-1 flex flex-col gap-6 lg:mt-2">
                        {/* Header row: prompt + meta */}
                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <div
                                    className={cn(
                                        "group rounded-full border border-black/5 bg-neutral-100 text-base text-white transition-all ease-in hover:cursor-default dark:border-white/5 dark:bg-neutral-800",
                                    )}
                                >
                                    <AnimatedShinyText className="inline-flex items-center justify-center px-3.5 py-1 text-sm">
                                        <span>✨ Prompt</span>
                                        <ArrowRightIcon className="ml-1 size-3" />
                                    </AnimatedShinyText>
                                </div>
                                {video.duration ? (
                                    <Badge variant="secondary" className="gap-1">
                                        <Clock3 className="h-3.5 w-3.5" /> {Math.round((video.duration || 0) / 30)}s
                                    </Badge>
                                ) : null}
                                <Badge variant="secondary" className="gap-1">
                                    <Film className="h-3.5 w-3.5" /> {video.imageLinks?.length || 0} images
                                </Badge>
                                <Badge variant="secondary" className="gap-1 hidden sm:flex">
                                    <Calendar className="h-3.5 w-3.5" /> {new Date(video.createdAt).toLocaleDateString()}
                                </Badge>
                            </div>
                            {prompt && (
                            <Input
                                className="rounded h-9 w-full max-w-3xl text-black"
                                style={{ background: "#eee" }}
                                defaultValue={prompt}
                                disabled
                            />
                            )}
                        </div>

                        {/* Actions are now at the top bar */}

                        {/* Transcript */}
                        {transcript ? (
                            <Transcript text={transcript} />
                        ) : (
                            <div className="text-sm text-white/60">Transcript is not available.</div>
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