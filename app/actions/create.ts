'use server'

import { auth } from "@clerk/nextjs/server"
import { randomUUID } from "crypto"
import { prisma } from "../lib/db"
import { videoQueue } from "../lib/queue"

// Валидация входных данных
const validatePrompt = (prompt: string): string => {
    if (!prompt || typeof prompt !== 'string') {
        throw new Error('Prompt is required and must be a string')
    }
    
    const trimmedPrompt = prompt.trim()
    if (trimmedPrompt.length < 10) {
        throw new Error('Prompt must be at least 10 characters long')
    }
    
    if (trimmedPrompt.length > 500) {
        throw new Error('Prompt must be less than 500 characters long')
    }
    
    return trimmedPrompt
}

// Проверка кредитов пользователя
const checkUserCredits = async (userId: string): Promise<void> => {
    const user = await prisma.user.findUnique({
        where: { userId },
        select: { credits: true }
    })
    
    if (!user) {
        throw new Error('User not found')
    }
    
    if (user.credits <= 0) {
        throw new Error('Insufficient credits. Please purchase more credits to create a video.')
    }
}

export const createVideo = async (prompt: string) => {
    const startTime = Date.now()
    let videoId: string | null = null
    
    try {
        // Валидация входных данных
        const validatedPrompt = validatePrompt(prompt)
        
        // Аутентификация пользователя
        const { userId } = await auth()
        if (!userId) {
            throw new Error('User not authenticated')
        }
        
        console.log(`[${userId}] Creating video with prompt length: ${validatedPrompt.length}`)
        
        // Проверка кредитов перед началом операций
        await checkUserCredits(userId)
        
        videoId = randomUUID()
        
        // Используем транзакцию для атомарности операций
        await prisma.$transaction(async (tx) => {
            // Создаем запись о видео
            await tx.video.create({
                data: {
                    videoId: videoId!,
                    userId,
                    prompt: validatedPrompt,
                    processing: true
                }
            })
            
            // Списываем кредиты
            await tx.user.update({
                where: { userId },
                data: { credits: { decrement: 1 } }
            })
        })
        
        // Добавляем задачу в очередь только после успешного создания записи в БД
        const job = await videoQueue.add('generate-video', 
            { 
                videoId, 
                userId, 
                prompt: validatedPrompt,
                timestamp: Date.now()
            },
            {
                // Настройки для повторных попыток
                attempts: 3,
                backoff: {
                    type: 'exponential',
                    delay: 5000,
                },
                // Удаление джобов для экономии места
                removeOnComplete: 10,
                removeOnFail: 5
            }
        )
        
        const executionTime = Date.now() - startTime
        console.log(`[${userId}] Video creation completed successfully. VideoId: ${videoId}, JobId: ${job.id}, ExecutionTime: ${executionTime}ms`)
        
        return { 
            videoId, 
            jobId: job.id,
            message: 'Video creation started successfully'
        }

    } catch (error) {
        const executionTime = Date.now() - startTime
        console.error(`Video creation failed. ExecutionTime: ${executionTime}ms`, {
            error: error instanceof Error ? error.message : 'Unknown error',
            videoId,
            userId: await auth().then(auth => auth.userId).catch(() => 'unknown')
        })
        
        // Если видео было создано, но что-то пошло не так после этого, 
        // помечаем его как failed
        if (videoId) {
            try {
                await prisma.video.update({
                    where: { videoId },
                    data: { 
                        processing: false,
                        failed: true
                    }
                })
            } catch (updateError) {
                console.error('Failed to update video status:', updateError)
            }
        }
        
        throw error
    }
}
