"use server"

import { prisma } from "./db"

/**
 * Получает промпт для видео по его ID
 * @param videoId - Уникальный идентификатор видео
 * @returns Промпт видео или null если видео не найдено
 */
export const findPrompt = async (videoId: string): Promise<string | null> => {
	if (!videoId?.trim()) {
		return null;
	}

	try {
		const data = await prisma.video.findUnique({
			where: {
				videoId: videoId.trim(),
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