"use client"

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Copy, Download, MoreVertical, Trash2 } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { useVideoActions } from "../hooks/useVideoActions"
import { useEffect, useState } from "react"

interface VideoCardVideo {
    videoId: string;
    videoUrl: string;
    thumbnail?: string;
    prompt?: string;
    createdAt: string | Date;
}

export const VideoCard = ({ video }: { video: VideoCardVideo }) => {
    const [dropdownOpen, setDropdownOpen] = useState(false)
    const [imageError, setImageError] = useState(false)

    useEffect(() => {
        setImageError(false)
    }, [video.thumbnail])
    
    const {
        isDeleting,
        handleDelete,
        handleDownload,
        handleCopyLink
    } = useVideoActions({
        videoUrl: video.videoUrl,
        videoId: video.videoId,
    })
    return (
        <div className='border bg-gray-700 rounded-lg overflow-hidden hover:shadow-lg transition-shadow duration-300 relative'>
            <Link href={`/videos/${video.videoId}`} className="block">
                <div className="aspect-video bg-gray-800 relative">
                    {video.thumbnail && !imageError ? (
                        <Image
                            src={video.thumbnail}
                            alt="Video Thumbnail"
                            fill
                            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                            className="object-cover"
                            priority={false}
                            loading="lazy"
                            onError={(e) => {
                                setImageError(true);
                            }}
                            onLoad={() => {
                                // Image loaded successfully, no action needed
                            }}
                        />
                    ) : (
                        <div className="flex items-center justify-center h-full">
                            <span className="text-gray-400">
                                {imageError ? 'Image failed to load' : 'No preview available'}
                            </span>
                        </div>
                    )}
                </div>
                <div className="p-4">
                    <h3 className="font-medium truncate">
                        {video.prompt || "Untitled Video"}
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                        {new Date(video.createdAt).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit'
                        })}
                    </p>
                </div>
            </Link>
            <div className="absolute bottom-2 right-2">
                <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 bg-black/50 hover:bg-black/70 text-white cursor-pointer"
                            onClick={(e) => e.preventDefault()}
                        >
                            <MoreVertical className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-48" align="end">
                        <DropdownMenuItem
                            onSelect={(e) => { e.stopPropagation(); handleDownload(); setDropdownOpen(false); }}
                            className="cursor-pointer"
                        >
                            <Download className="mr-2 h-4 w-4" />
                            <span>Download</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onSelect={(e) => { e.stopPropagation(); handleCopyLink(); setDropdownOpen(false); }}
                            className="cursor-pointer"
                        >
                            <Copy className="mr-2 h-4 w-4" />
                            <span>Copy Link</span>
                        </DropdownMenuItem>
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <DropdownMenuItem
                                    onSelect={(e) => e.preventDefault()}
                                    className="text-red-400 hover:bg-red-950 focus:bg-red-950 hover:text-red-400 focus:text-red-400 cursor-pointer"
                                >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    <span>Delete</span>
                                </DropdownMenuItem>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Are you sure you want to delete this video?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        This action cannot be undone. This will permanently delete your video and all its data.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel onClick={() => setDropdownOpen(false)} className="rounded-full cursor-pointer">Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => { handleDelete(); setDropdownOpen(false); }} disabled={isDeleting} className="bg-gradient-to-br from-red-500 to-red-700 hover:from-red-600 hover:to-red-800 text-white rounded-full cursor-pointer">Delete</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>
    )
}