"use server"

import { currentUser } from "@clerk/nextjs/server"
import { prisma } from "./db"

/**
 * Получает промпт для видео по его ID, только если пользователь является владельцем
 * @param videoId - Уникальный идентификатор видео
 * @param userId - ID пользователя (игнорируется в целях безопасности, используется только сессия)
 * @returns Промпт видео или null если видео не найдено или пользователь не является владельцем
 */
export const findPrompt = async (videoId: string, userId?: string): Promise<string | null> => {
	if (!videoId?.trim()) {
		return null;
	}

	try {
		// Всегда получаем ID пользователя только из сессии для безопасности
		const requestingUserId = (await currentUser())?.id;
		
		// Если передан userId, но он не совпадает с сессией - логируем это
		if (userId && userId !== requestingUserId) {
			console.warn('findPrompt: Попытка использовать чужой userId:', {
				providedUserId: userId,
				sessionUserId: requestingUserId,
				videoId: videoId.trim()
			});
		}
		
		if (!requestingUserId) {
			console.warn('findPrompt: Неавторизованный доступ к видео:', videoId);
			return null;
		}

		// Ищем видео только среди принадлежащих пользователю из сессии
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