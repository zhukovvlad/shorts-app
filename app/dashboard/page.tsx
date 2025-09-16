import { currentUser } from '@clerk/nextjs/server'
import React from 'react'
import { prisma } from '../lib/db';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { SignOutButton } from '@clerk/nextjs';
import { VideoCard } from '../components/videoCard';

const Dashboard = async () => {
    const user = await currentUser();

    if (!user) {
        return null
    }

    const videos = await prisma.video.findMany({
        where: {
            userId: user?.id
        },
        orderBy: {
            createdAt: 'desc'
        }
    })
    return (
        <div className='container mx-auto p-6 '>
            <div className='flex justify-between items-center mb-8'>
                <h1 className='text-3xl font bold'>Your Videos</h1>

                <div className='flex items-center gap-2'>
                    <Link href="/new">
                        <Button className='bg-gradient-to-br hover:opacity-80 text-white rounded-full from-[#3352CC] to-[#1C2D70] font-medium cursor-pointer text-sm sm:text-base px-3 sm:px-4'>
                            <Plus className='h-2 w-2' />
                            Create New
                        </Button>
                    </Link>

                    <SignOutButton>
                        <Button className="bg-black border border-gray-400 text-white rounded-full hover:bg-gray-900 transition-colors duration-150 cursor-pointer text-sm sm:text-base px-3 sm:px-4">
                            Sign Out
                        </Button>
                    </SignOutButton>
                </div>
            </div>

            {
                videos.length === 0 ? (
                    <div className='text-center py-16 bg-gray-800 rounded-lg'>
                        <p className='text-xl mb-4'>You have not created any videos yet</p>
                        <Button
                            asChild
                            className="bg-gradient-to-br hover:opacity-80 text-white rounded-full from-[#3352CC] to-[#1C2D70] font-medium cursor-pointer text-sm sm:text-base px-3 sm:px-4"
                        >
                            <Link href="/new">Create your first video</Link>
                        </Button>
                    </div>
                ) : (
                    <div className='grid grid-cols-3 gap-6'>
                        {videos.map((video) => (
                            <VideoCard key={video.videoId} video={video} />
                        ))}
                    </div>
                )
            }

        </div>
    )
}

export default Dashboard