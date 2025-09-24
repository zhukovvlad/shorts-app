"use server"

import { currentUser } from "@clerk/nextjs/server"
import { prisma } from "./db"

/**
 * Получает промпт для видео по его ID, только если пользователь является владельцем
 * @param videoId - Уникальный идентификатор видео
 * @param userId - ID пользователя (опционально, если не передан - получается из текущей сессии)
 * @returns Промпт видео или null если видео не найдено или пользователь не является владельцем
 */
export const findPrompt = async (videoId: string, userId?: string): Promise<string | null> => {
	if (!videoId?.trim()) {
		return null;
	}

	try {
		// Получаем ID пользователя из параметра или текущей сессии
		const requestingUserId = userId || (await currentUser())?.id;
		
		if (!requestingUserId) {
			console.warn('findPrompt: Неавторизованный доступ к видео:', videoId);
			return null;
		}

		// Ищем видео только среди принадлежащих пользователю
		const data = await prisma.video.findFirst({
			where: {
				videoId: videoId.trim(),
				userId: requestingUserId,
			},
			select: {
				prompt: true,
			}
		});

		return data?.prompt || null;
	} catch (error) {
		console.error('Ошибка при поиске промпта для видео:', videoId, error);
		return null;
	}
}