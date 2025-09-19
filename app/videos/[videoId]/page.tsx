import { VideoActions } from "@/app/components/videoActions";
import { prisma } from "@/app/lib/db";
import { findPrompt } from "@/app/lib/findPrompt";
import { AnimatedGradientText } from "@/components/ui/animated-gradient-text";
import { AnimatedShinyText } from "@/components/ui/animated-shiny-text";
import { Input } from "@/components/ui/input";
import { TypingAnimation } from "@/components/ui/typing-animation";
import { cn } from "@/lib/utils";
import { currentUser } from "@clerk/nextjs/server";
import { ArrowRightIcon } from "lucide-react";

const page = async ({ params }: { params: { videoId: string } }) => {
    const { videoId } = params;
    const user = await currentUser();

    if (!user) {
        return null
    }

    const userId = user?.id;
    const prompt = await findPrompt(videoId)
    if (!prompt || prompt === undefined) {
        return null
    }

    const video = await prisma.video.findUnique({
        where: { videoId: videoId }
    })

    if (!video) {
        return null
    }

    const isOwner = userId === video.userId;
    const videoUrl = video?.videoUrl;
    const transcript = video?.content;

    if (!transcript) {
        return null
    }

    return (
        <div className="min-h-screen w-full relative overflow-x-hidden">
            <div className="mx-auto max-w-7xl px-4 py-6">
                <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
                    {/* Left: Video */}
                    <div className="w-full lg:w-[420px] lg:shrink-0">
                        <div className="mt-2 lg:mt-6">
                            <div className="aspect-[9/16] bg-gray-800 rounded-2xl overflow-hidden mx-auto max-w-[420px]">
                                <video
                                    key={videoId}
                                    className="w-full h-full object-cover rounded-2xl"
                                    controls
                                    playsInline
                                    src={videoUrl ?? undefined}
                                >
                                    Your old browser does not support the video tag.
                                </video>
                            </div>
                        </div>
                    </div>

                    {/* Right: Details and actions */}
                    <div className="flex-1 flex flex-col gap-6 lg:mt-6">
                        {/* Prompt row */}
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                            <div
                                className={cn(
                                    "group rounded-full border border-black/5 bg-neutral-100 text-base text-white transition-all ease-in hover:cursor-pointer hover:bg-neutral-200 dark:border-white/5 dark:bg-neutral-800 dark:hover:bg-neutral-800",
                                )}
                            >
                                <AnimatedShinyText className="inline-flex items-center justify-center px-4 py-1 transition ease-out hover:text-neutral-600 hover:duration-300 hover:dark:text-neutral-400">
                                    <span>✨ Prompt</span>
                                    <ArrowRightIcon className="ml-1 size-3 transition-transform duration-300 ease-in-out group-hover:translate-x-0.5" />
                                </AnimatedShinyText>
                            </div>
                            <Input
                                className="rounded h-9 w-full max-w-xl"
                                style={{ background: "#eee", color: "#000" }}
                                defaultValue={prompt}
                                disabled
                            />
                        </div>

                        {/* Transcript */}
                        <div>
                            <div className="w-fit">
                                <div className="group relative mx-auto flex items-center justify-center rounded-full px-2 py-1.5 shadow-[inset_0_-8px_10px_#8fdfff1f] transition-shadow duration-500 ease-out hover:shadow-[inset_0_-5px_10px_#8fdfff3f] ">
                                    <span
                                        className={cn(
                                            "absolute inset-0 block h-full w-full animate-gradient rounded-[inherit] bg-gradient-to-r from-[#b0b0b0]/50 via-[#9c40ff]/50 to-[#b0b0b0]/50 bg-[length:300%_100%] p-[1px]",
                                        )}
                                        style={{
                                            WebkitMask:
                                                "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                                            WebkitMaskComposite: "destination-out",
                                            mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                                            maskComposite: "subtract",
                                            WebkitClipPath: "padding-box",
                                        }}
                                    />

                                    <AnimatedGradientText className="text-sm font-medium">
                                        Transcript
                                    </AnimatedGradientText>

                                </div>
                            </div>
                            <div className="mt-4 p-4 rounded-md bg-neutral-900/60 backdrop-blur-sm border border-white/10 w-full max-w-3xl max-h-64 sm:max-h-80 md:max-h-[420px] overflow-auto">
                                <TypingAnimation className="text-sm leading-relaxed text-transparent bg-clip-text bg-gradient-to-r from-gray-300 via-gray-100 to-gray-400 whitespace-pre-wrap break-words">
                                    {transcript}
                                </TypingAnimation>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="sm:self-start">
                            <VideoActions videoId={videoId} videoUrl={videoUrl} isOwner={isOwner} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default page