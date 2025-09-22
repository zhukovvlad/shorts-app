"use client"

import { useState } from "react";
import { toast } from "sonner";
import { deleteVideo } from "../lib/deleteVideo";
import { useRouter } from "next/navigation";


interface UseVideoActionsProps {
    videoId: string;
    videoUrl: string | null;
    onDeleteSuccess?: () => void;
}

export const useVideoActions = ({ videoId, videoUrl, onDeleteSuccess }: UseVideoActionsProps) => {
    const router = useRouter();
    const [copied, setCopied] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)
    const handleDownload = () => {
        if (!videoUrl) {
            toast.error("Download failed", { description: "Video file is not available." });
            return
        }

        const a = document.createElement('a')
        a.href = videoUrl
        a.download = `video-${videoId}.mp4`
        a.target = '_blank'
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)

        toast.success("Download started", { description: "Your video is being downloaded." });
    }

    const handleCopyLink = async () => {
        try {
            await navigator.clipboard.writeText(window.location.origin + `/videos/${videoId}`);
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)

            toast.success("Link copied", { description: "Video link copied to clipboard." });
        } catch (error) {
            toast.error("Copy failed", { description: "Failed to copy link to clipboard." });
        }
    }

    const handleDelete = async () => {
        setIsDeleting(true)

        try {
            const result = await deleteVideo(videoId)
            if (!result) {
                return null
            }
            if (result.success) {
                toast.error("Video deleted", { description: "The video has been deleted successfully." });

                if (onDeleteSuccess) {
                    onDeleteSuccess()
                } else {
                    router.refresh()
                }
            } else {
                toast.error("error occured", { description: result.error || "Failed to delete video." });
            }
        } catch (error) {
            toast.error("error occured", { description: "Failed to delete video." });
        } finally {
            setIsDeleting(false)
        }
    }

    return {
        handleDownload,
        handleCopyLink,
        handleDelete,
        copied,
        isDeleting
    }
}