/**
 * @fileoverview Система создания видео с безопасными транзакциями
 * 
 * Этот модуль реализует создание видео с использованием атомарных операций
 * и защиты от состояний гонки. Включает валидацию промптов, управление кредитами,
 * постановку задач в очередь и обработку ошибок.
 * 
 * Основные особенности:
 * - Атомарные транзакции для целостности данных
 * - Защита от отрицательного баланса кредитов
 * - Безопасная обработка ошибок с обновлением статусов
 * - Интеграция с системой очередей Bull
 * - Подробное логирование для мониторинга
 * 
 * @author Система видеогенерации
 * @version 2.0.0
 * @since 2025-09-24
 */

'use server'

import { auth } from "@clerk/nextjs/server"
import { randomUUID } from "crypto"
import { prisma } from "../lib/db"
import { videoQueue } from "../lib/queue"

/**
 * Валидирует и очищает входной промпт для создания видео
 * 
 * @param prompt - Пользовательский промпт для генерации видео
 * @returns Очищенный и валидированный промпт
 * @throws {Error} Если промпт пустой, не строка, слишком короткий или длинный
 * 
 * @example
 * ```typescript
 * const validPrompt = validatePrompt("Create a video about cats")
 * // Возвращает: "Create a video about cats"
 * 
 * validatePrompt("   ") // Выбросит ошибку: слишком короткий
 * validatePrompt("a".repeat(501)) // Выбросит ошибку: слишком длинный
 * ```
 */
const validatePrompt = (prompt: string): string => {
    if (!prompt || typeof prompt !== 'string') {
        throw new Error('Prompt is required and must be a string')
    }
    
    const trimmedPrompt = prompt.trim()
    if (trimmedPrompt.length < 10) {
        throw new Error('Prompt must be at least 10 characters long')
    }
    
    if (trimmedPrompt.length > 500) {
        throw new Error('Prompt must be at most 500 characters long')
    }
    
    return trimmedPrompt
}

/**
 * Создает новое видео и запускает процесс его генерации
 * 
 * Эта функция выполняет следующие операции:
 * 1. Валидирует входной промпт
 * 2. Аутентифицирует пользователя
 * 3. Атомарно создает запись о видео и списывает кредиты
 * 4. Добавляет задачу генерации видео в очередь
 * 5. Возвращает информацию о созданном видео
 * 
 * @param prompt - Пользовательский промпт для генерации видео (10-500 символов)
 * @returns Promise объекта с информацией о созданном видео
 * 
 * @throws {Error} "User not authenticated" - Если пользователь не авторизован
 * @throws {Error} "Prompt must be at least 10 characters long" - Если промпт слишком короткий
 * @throws {Error} "Prompt must be at most 500 characters long" - Если промпт слишком длинный
 * @throws {Error} "User not found" - Если пользователь не найден в БД
 * @throws {Error} "Insufficient credits..." - Если недостаточно кредитов
 * 
 * @example
 * ```typescript
 * const result = await createVideo("Create a video about space exploration")
 * // Возвращает:
 * // {
 * //   videoId: "550e8400-e29b-41d4-a716-446655440000",
 * //   jobId: "12345",
 * //   message: "Video creation started successfully"
 * // }
 * ```
 * 
 * @security
 * - Функция защищена от состояний гонки при списании кредитов
 * - Использует атомарные транзакции для целостности данных
 * - Проверяет принадлежность пользователя при обновлении статуса
 * 
 * @performance
 * - Оптимизирован для минимизации вызовов БД
 * - Использует выборочную загрузку полей (select)
 * - Кэширует userId для логирования
 */
export const createVideo = async (prompt: string) => {
    const startTime = Date.now()
    let videoId: string | null = null
    let transactionCommitted = false
    
    // Захватываем userId заранее для использования в логах
    // Это предотвращает повторные вызовы auth() и улучшает производительность
    const { userId } = await auth()
    if (!userId) {
        throw new Error('User not authenticated')
    }
    
    try {
        // Валидация входных данных
        const validatedPrompt = validatePrompt(prompt)
        
        console.log(`[${userId}] Creating video with prompt length: ${validatedPrompt.length}`)
        
        // Примечание: проверка кредитов происходит атомарно внутри транзакции
        // для предотвращения состояний гонки
        
        // Используем транзакцию для атомарности операций
        // Все операции внутри будут либо выполнены полностью, либо откачены
        await prisma.$transaction(async (tx) => {
            const newVideoId = randomUUID()
            
            // Создаем запись о видео в статусе "processing"
            await tx.video.create({
                data: {
                    videoId: newVideoId,
                    userId,
                    prompt: validatedPrompt,
                    processing: true
                }
            })
            
            // Атомарно списываем кредиты с проверкой достаточности
            // updateMany с условием предотвращает отрицательный баланс
            const creditUpdateResult = await tx.user.updateMany({
                where: { 
                    userId,
                    credits: { gt: 0 } // Только если кредитов больше 0
                },
                data: { credits: { decrement: 1 } }
            })
            
            // Проверяем, что обновление прошло успешно
            // Если count = 0, нужно различить "пользователь не найден" от "недостаточно кредитов"
            if (creditUpdateResult.count === 0) {
                // Выполняем дополнительную проверку существования пользователя в той же транзакции
                const userExists = await tx.user.findUnique({
                    where: { userId },
                    select: { userId: true } // Загружаем минимум данных для проверки
                })
                
                if (!userExists) {
                    throw new Error('User not found')
                } else {
                    throw new Error('Insufficient credits. Credits may have been used by another operation.')
                }
            }
            
            // Устанавливаем videoId только после успешного выполнения транзакции
            // Это гарантирует, что ID будет доступен только для реально созданных видео
            videoId = newVideoId
        })
        
        // Добавляем задачу в очередь только после успешного создания записи в БД
        // Это гарантирует, что воркер получит только валидные задачи
        const job = await videoQueue.add('generate-video', 
            { 
                videoId, 
                userId, 
                prompt: validatedPrompt,
                timestamp: Date.now()
            },
            {
                // Настройки надежности для критически важных задач
                attempts: 3, // Максимум 3 попытки выполнения
                backoff: {
                    type: 'exponential', // Экспоненциальная задержка между попытками
                    delay: 5000, // Начальная задержка 5 секунд
                },
                // Автоочистка для экономии памяти Redis
                removeOnComplete: 10, // Сохранить 10 последних успешных задач
                removeOnFail: 5 // Сохранить 5 последних неудачных задач
            }
        )
        
        // Устанавливаем флаг успеха только после всех критических операций
        // Это важно для правильной работы блока catch
        transactionCommitted = true
        
        const executionTime = Date.now() - startTime
        console.log(`[${userId}] Video creation completed successfully. VideoId: ${videoId}, JobId: ${job.id}, ExecutionTime: ${executionTime}ms`)
        
        return { 
            videoId, 
            jobId: job.id,
            message: 'Video creation started successfully'
        }

    } catch (error) {
        const executionTime = Date.now() - startTime
        console.error(`[${userId}] Video creation failed. ExecutionTime: ${executionTime}ms`, {
            error: error instanceof Error ? error.message : 'Unknown error',
            videoId,
            transactionCommitted
        })
        
        // Критически важная секция: обновление статуса видео при ошибке
        // Обновляем статус только если транзакция была успешной И videoId установлен
        // Это предотвращает попытки обновления несуществующих записей
        if (transactionCommitted && videoId) {
            try {
                // Сначала проверяем что запись действительно существует в БД
                // Это дополнительная защита от состояний гонки
                const existingVideo = await prisma.video.findUnique({
                    where: { videoId },
                    select: { videoId: true, userId: true } // Загружаем только нужные поля
                })
                
                if (!existingVideo) {
                    console.warn(`[${userId}] Video record ${videoId} not found in database, cannot update status`)
                } else if (existingVideo.userId !== userId) {
                    console.warn(`[${userId}] Video record ${videoId} belongs to different user, cannot update status`)
                } else {
                    // Запись существует и принадлежит пользователю, безопасно обновляем статус
                    await prisma.video.update({
                        where: { videoId },
                        data: { 
                            processing: false,
                            failed: true
                        }
                    })
                    console.log(`[${userId}] Video ${videoId} marked as failed`)
                }
            } catch (updateError) {
                // Ошибка при обновлении статуса не должна прерывать основной поток
                console.error(`[${userId}] Failed to update video status:`, updateError)
            }
        }
        
        // Пробрасываем оригинальную ошибку для обработки на верхнем уровне
        throw error
    }
}
