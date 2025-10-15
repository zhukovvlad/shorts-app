"use client"

import { Button } from "@/components/ui/button";
import { ArrowLeft, Copy, Download, Trash2 } from "lucide-react";
import { useVideoActions } from "../hooks/useVideoActions";
import { useRouter } from "next/navigation";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import Link from "next/link";

interface VideoActionsProps {
    videoId: string;
    videoUrl: string | null;
    isOwner?: boolean;
    /** Layout direction, defaults to column for legacy usage */
    layout?: 'column' | 'row';
    /** Controls rendering of the back button (we'll place it elsewhere on the top bar) */
    showBackButton?: boolean;
    /** If true, renders only the back button (useful for right-aligned top bar) */
    onlyBackButton?: boolean;
}

export const VideoActions = ({ videoId, videoUrl, isOwner, layout = 'column', showBackButton = true, onlyBackButton = false }: VideoActionsProps) => {
    const router = useRouter()
    const { handleDownload, handleCopyLink, handleDelete, isDeleting, copied } = useVideoActions({
        videoId,
        videoUrl,
        onDeleteSuccessAction: () => router.push('/dashboard')
    })

    const isRow = layout === 'row';

    const containerClass = isRow
        ? "flex flex-row gap-2 items-center w-full"
        : "flex flex-col gap-3 mt-8 sm:mt-10 ml-0 sm:ml-8 justify-center items-stretch sm:items-start w-full";

    // In row mode (and not back-only), make all action buttons share space equally.
    const equalCell = isRow ? "flex-1 min-w-0" : "";
    const buttonWidth = isRow ? "w-full" : "w-full sm:w-48";

    // Back-only rendering path
    if (onlyBackButton) {
        return (
            <div className={containerClass}>
                <Button asChild variant="ghost" className={`flex items-center gap-2 hover:bg-gray-800 rounded-full justify-center sm:justify-start w-auto cursor-pointer`}>
                    <Link href="/dashboard">
                        <ArrowLeft className="h-4 w-4" />
                        Back to Dashboard
                    </Link>
                </Button>
            </div>
        );
    }

    return (
        <div className={containerClass}>
            <div className={equalCell}>
            <Button
                onClick={handleDownload}
                className={`bg-gradient-to-br hover:opacity-80 text-white rounded-full from-[#3352CC] to-[#1C2D70] font-medium flex items-center gap-2 justify-center sm:justify-start ${buttonWidth} cursor-pointer`}
                disabled={!videoUrl}
            >
                <Download className="h-4 w-4 " />
                Download
            </Button>
            </div>

            <div className={equalCell}>
            <Button
                variant="outline"
                onClick={handleCopyLink}
                className={`flex items-center gap-2 rounded-full justify-center sm:justify-start ${buttonWidth} cursor-pointer`}
            >
                <Copy className="h-4 w-4" />
                {copied ? 'Copied!' : 'Copy Link'}
            </Button>
            </div>

            {
                isOwner && (
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button
                                variant="outline"
                                className={`${equalCell} flex items-center gap-2 text-red-600 hover:bg-red-50 border-red-200 rounded-full dark:hover:bg-red-950 dark:border-red-800 justify-center sm:justify-start ${buttonWidth} cursor-pointer`}
                            >
                                <Trash2 className="h-4 w-4" />
                                Delete
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    This action cannot be undone. This will permanently delete your
                                    video and remove your video from our servers.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel className="rounded-full cursor-pointer">Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                    onClick={handleDelete}
                                    disabled={isDeleting}
                                    className="bg-gradient-to-br from-red-500 to-red-700 hover:from-red-600 hover:to-red-800 text-white rounded-full cursor-pointer"
                                >
                                    Delete
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                )
            }

            {showBackButton && (
                <div className={equalCell}>
                    <Button asChild variant="ghost" className={`flex items-center gap-2 hover:bg-gray-800 rounded-full justify-center sm:justify-start ${buttonWidth} cursor-pointer`}>
                        <Link href="/dashboard">
                            <ArrowLeft className="h-4 w-4" />
                            Back to Dashboard
                        </Link>
                    </Button>
                </div>
            )}

        </div>
    )
}