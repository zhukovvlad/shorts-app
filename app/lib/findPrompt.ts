import { prisma } from "./db"
import { logger } from "@/lib/logger"
import { auth } from "@/auth"

/**
 * Внутренняя функция для получения промпта по videoId и userId
 * Не использует аутентификацию - предназначена для использования в воркерах
 * @returns Промпт видео или null при ошибках/отсутствии данных
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
		// Log full error for observability
		logger.error('findPrompt: database error occurred', { 
			error: error instanceof Error ? error.message : 'unknown error',
			stack: error instanceof Error ? error.stack : undefined,
			videoId,
			userId
		});
		// Fail-soft: return null to avoid breaking the page when DB is unreachable
		return null;
	}
}

/**
 * Получает промпт для видео по его ID, только если пользователь является владельцем
 * @param videoId - Уникальный идентификатор видео
 * @param userId - ID пользователя (опциональный, для режима воркера)
 * @returns Промпт видео или null если видео не найдено, пользователь не является владельцем, или произошла ошибка БД
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
		// Log full error for observability and telemetry
		logger.error('findPrompt: error occurred', { 
			error: error instanceof Error ? error.message : 'unknown error',
			stack: error instanceof Error ? error.stack : undefined,
			videoId
		});
		// Fail-soft: return null to allow the caller to handle absence of prompt
		return null;
	}
}