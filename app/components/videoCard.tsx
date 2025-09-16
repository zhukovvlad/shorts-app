import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Copy, Download, MoreVertical, Trash2 } from "lucide-react"
import Link from "next/link"

export const VideoCard = ({ video }: { video: any }) => {
    return (
        <div className='border bg-gray-700 rounded-lg overflow-hidden hover:shadow-lg transition-shadow duration-300 relative'>
            <Link href={`/video/${video.videoId}`} className="block">
                <div className="aspect-video bg-gray-800 relative">
                    {video.thumbnail ? (
                        <img
                            src={video.thumbnail}
                            alt="Video Thumbnail"
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <div className="flex items-center justify-between h-full">
                            <span className="text-gray-400">
                                No preview available
                            </span>
                        </div>
                    )}
                </div>
                <div className="p-4">
                    <h3 className="font-medium truncate">
                        {video.prompt || "Untitled Video"}
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                        {new Date(video.createdAt).toLocaleDateString()}
                    </p>
                </div>
            </Link>
            <div className="absolute bottom-2 right-2">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 bg-black/50 hover:bg-black/70 text-white"
                        >
                            <MoreVertical className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-48" align="end">
                        <DropdownMenuItem>
                            <Download className="mr-2 h-4 w-4" />
                            <span>Download</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                            <Copy className="mr-2 h-4 w-4" />
                            <span>Copy Link</span>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <DropdownMenuItem className="text-red-400 hover:bg-red-950 focus:bg-red-950 hover:text-red-400 focus:text-red-400">
                                <Trash2 className="mr-2 h-4 w-4"/>
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
                                <AlertDialogCancel className="rounded-full">Cancel</AlertDialogCancel>
                                <AlertDialogAction className="bg-gradient-to-br from-red-500 to-red-700 hover:from-red-600 hover:from-red-800 text-white rounded-full">Delete</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </DropdownMenu>
            </div>
        </div>
    )
}