'use server'

import { auth } from "@clerk/nextjs/server"
import { randomUUID } from "crypto"
import { prisma } from "../lib/db"
import { decreaseCredits } from "../lib/decreaseCredits"
import { videoQueue } from "../lib/queue"
import { redirect } from "next/navigation"


export const createVideo = async (prompt: string) => {
    try {
        const videoId = randomUUID()
        
        console.log('Attempting to get auth info...')
        const { userId } = await auth()
        console.log('Auth result:', userId ? 'User authenticated' : 'No user', userId)

        if (!userId) {
            console.log('No user ID available')
            throw new Error('User not authenticated')
        }

        await prisma.video.create({
            data: {
                videoId,
                userId,
                prompt,
                processing: true
            }
        })

        await decreaseCredits(userId)

        await videoQueue.add('generate-video', { videoId })
        console.log('job added to queue succesffuly')

        return { videoId }

    } catch (error) {
        console.error('Error creating video:', error)
        throw error
    }
}
