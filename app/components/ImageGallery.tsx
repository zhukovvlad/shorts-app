"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { AnimatedGradientText } from "@/components/ui/animated-gradient-text"
import { ChevronLeft, ChevronRight, X } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ImageGalleryProps {
    imageLinks: string[]
}

export const ImageGallery = ({ imageLinks }: ImageGalleryProps) => {
    const [selectedImage, setSelectedImage] = useState<{ url: string; index: number } | null>(null)
    const [imageErrors, setImageErrors] = useState<Set<number>>(new Set())

    const handleImageError = (index: number) => {
        setImageErrors(prev => new Set(prev).add(index))
    }

    const goToPrevious = () => {
        if (selectedImage && selectedImage.index > 0) {
            setSelectedImage({
                url: imageLinks[selectedImage.index - 1],
                index: selectedImage.index - 1
            })
        }
    }

    const goToNext = () => {
        if (selectedImage && selectedImage.index < imageLinks.length - 1) {
            setSelectedImage({
                url: imageLinks[selectedImage.index + 1],
                index: selectedImage.index + 1
            })
        }
    }

    // Keyboard navigation for the modal
    useEffect(() => {
        if (!selectedImage) return

        const handleKeyDown = (e: KeyboardEvent) => {
            e.preventDefault() // Prevent default browser behavior
            
            if (e.key === 'ArrowLeft') {
                goToPrevious()
            } else if (e.key === 'ArrowRight') {
                goToNext()
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [selectedImage, imageLinks])

    return (
        <>
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
                            🎨 Images ({imageLinks.length})
                        </AnimatedGradientText>
                    </div>
                </div>
                <div className="mt-4 p-4 rounded-md bg-neutral-900/60 backdrop-blur-sm border border-white/10 w-full max-w-3xl">
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                        {imageLinks.map((imageUrl, index) => (
                            <button
                                key={index}
                                onClick={() => setSelectedImage({ url: imageUrl, index })}
                                className="group relative aspect-square rounded-lg overflow-hidden border-2 border-white/10 hover:border-purple-500/50 transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-purple-500/20 cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                            >
                                {imageErrors.has(index) ? (
                                    <div className="w-full h-full flex items-center justify-center bg-gray-800">
                                        <span className="text-gray-400 text-xs text-center px-2">
                                            Failed to load
                                        </span>
                                    </div>
                                ) : (
                                    <>
                                        <Image
                                            src={imageUrl}
                                            alt={`Scene ${index + 1}`}
                                            fill
                                            sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 20vw"
                                            className="object-cover transition-transform duration-300 group-hover:scale-110"
                                            onError={() => handleImageError(index)}
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                            <div className="absolute bottom-2 left-2 text-white text-xs font-semibold bg-black/50 px-2 py-1 rounded">
                                                Scene {index + 1}
                                            </div>
                                        </div>
                                    </>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Dialog for full-size image */}
            <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
                <DialogContent className="max-w-7xl w-[95vw] h-[95vh] p-0 bg-black/95 border-white/10" showCloseButton={false}>
                    {selectedImage && (
                        <div className="relative w-full h-full flex flex-col">
                            {/* Accessible title for screen readers */}
                            <DialogTitle className="sr-only">
                                Image {selectedImage.index + 1} of {imageLinks.length}
                            </DialogTitle>

                            {/* Close button */}
                            <Button
                                onClick={() => setSelectedImage(null)}
                                variant="ghost"
                                size="icon"
                                className="absolute top-4 right-4 z-30 h-10 w-10 rounded-full bg-black/50 hover:bg-black/70 text-white backdrop-blur-sm transition-all cursor-pointer"
                            >
                                <X className="h-6 w-6" />
                                <span className="sr-only">Close</span>
                            </Button>

                            {/* Header */}
                            <div className="absolute top-0 left-0 right-0 z-10 p-4 bg-gradient-to-b from-black/80 to-transparent">
                                <h3 className="text-white text-lg font-semibold">
                                    Scene {selectedImage.index + 1} of {imageLinks.length}
                                </h3>
                            </div>

                            {/* Image */}
                            <div className="relative w-full h-full flex items-center justify-center p-4">
                                {/* Previous button */}
                                {selectedImage.index > 0 && (
                                    <Button
                                        onClick={goToPrevious}
                                        variant="ghost"
                                        size="icon"
                                        className="absolute left-4 top-1/2 -translate-y-1/2 z-20 h-12 w-12 rounded-full bg-black/50 hover:bg-black/70 text-white backdrop-blur-sm transition-all cursor-pointer"
                                    >
                                        <ChevronLeft className="h-8 w-8" />
                                    </Button>
                                )}

                                <div className="relative w-full h-full">
                                    {imageErrors.has(selectedImage.index) ? (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <span className="text-white text-lg">
                                                Failed to load image
                                            </span>
                                        </div>
                                    ) : (
                                        <Image
                                            src={selectedImage.url}
                                            alt={`Scene ${selectedImage.index + 1}`}
                                            fill
                                            sizes="95vw"
                                            className="object-contain"
                                            priority
                                            unoptimized
                                            onError={() => handleImageError(selectedImage.index)}
                                        />
                                    )}
                                </div>

                                {/* Next button */}
                                {selectedImage.index < imageLinks.length - 1 && (
                                    <Button
                                        onClick={goToNext}
                                        variant="ghost"
                                        size="icon"
                                        className="absolute right-4 top-1/2 -translate-y-1/2 z-20 h-12 w-12 rounded-full bg-black/50 hover:bg-black/70 text-white backdrop-blur-sm transition-all cursor-pointer"
                                    >
                                        <ChevronRight className="h-8 w-8" />
                                    </Button>
                                )}
                            </div>

                            {/* Navigation hints */}
                            <div className="absolute bottom-0 left-0 right-0 z-10 p-4 bg-gradient-to-t from-black/80 to-transparent">
                                <p className="text-white/60 text-sm text-center">
                                    Use ← → to navigate • Click outside or press ESC to close
                                </p>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </>
    )
}
