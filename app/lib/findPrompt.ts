import { prisma } from "./db"
import { logger } from "@/lib/logger"
import { auth } from "@/auth"

/**
 * Внутренняя функция для получения промпта по videoId и userId
 * Не использует аутентификацию - предназначена для использования в воркерах
 */
export const findPromptInternal = async (videoId: string, userId: string): Promise<string | null> => {
	if (!videoId?.trim() || !userId?.trim()) {
		return null;
	}

	try {
		const data = await prisma.video.findFirst({
			where: {
				videoId: videoId.trim(),
				userId: userId.trim(),
			},
			select: {
				prompt: true,
			}
		});

		return data?.prompt || null;
	} catch (error) {
		logger.error('findPrompt: database error occurred', { error: error instanceof Error ? error.message : 'unknown error' });
		throw new Error('findPrompt: internal error');
	}
}

/**
 * Получает промпт для видео по его ID, только если пользователь является владельцем
 * @param videoId - Уникальный идентификатор видео
 * @param userId - ID пользователя (опциональный, для режима воркера)
 * @returns Промпт видео или null если видео не найдено или пользователь не является владельцем
 */
export const findPrompt = async (videoId: string, userId?: string): Promise<string | null> => {
	"use server"
	
	if (!videoId?.trim()) {
		return null;
	}

	try {
		// Пытаемся получить сессию
		const session = await auth();
		
		// Если сессии нет и передан userId - используем его напрямую (режим воркера)
		if (!session?.user?.id && userId) {
			logger.debug('findPrompt: running in worker mode with provided userId');
			return await findPromptInternal(videoId, userId);
		}

		// Обычный режим с аутентификацией через NextAuth
		if (!session?.user?.id) {
			logger.warn('findPrompt: no authentication available');
			return null;
		}

		const requestingUserId = session.user.id;
		
		// Если передан userId, но он не совпадает с сессией - логируем это
		if (userId && userId !== requestingUserId) {
			logger.warn('findPrompt: attempted access with mismatched userId for video');
		}

		return await findPromptInternal(videoId, requestingUserId);
	} catch (error) {
		logger.error('findPrompt: error occurred', { error: error instanceof Error ? error.message : 'unknown error' });
		throw new Error('findPrompt: internal error');
	}
}