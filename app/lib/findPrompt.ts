import { prisma } from "./db"

/**
 * Внутренняя функция для получения промпта по videoId и userId
 * Не использует аутентификацию через Clerk - предназначена для использования в воркерах
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
		console.error('findPrompt: database error occurred', error instanceof Error ? { message: error.message, name: error.name } : { message: 'unknown error' });
		throw new Error('findPrompt: internal error');
	}
}

// Функция для получения currentUser с отложенным импортом
async function getCurrentUser() {
	try {
		// Проверяем, доступен ли @clerk/nextjs/server
		const { currentUser } = await import("@clerk/nextjs/server");
		return currentUser;
	} catch {
		// Clerk недоступен (например, в воркере)
		console.log('Clerk not available - running in worker mode');
		return null;
	}
}

/**
 * Получает промпт для видео по его ID, только если пользователь является владельцем
 * @param videoId - Уникальный идентификатор видео
 * @param userId - ID пользователя (игнорируется в целях безопасности, используется только сессия)
 * @returns Промпт видео или null если видео не найдено или пользователь не является владельцем
 */
export const findPrompt = async (videoId: string, userId?: string): Promise<string | null> => {
	"use server"
	
	if (!videoId?.trim()) {
		return null;
	}

	try {
		const currentUser = await getCurrentUser();
		
		// Если Clerk недоступен и передан userId - используем его напрямую (режим воркера)
		if (!currentUser && userId) {
			return await findPromptInternal(videoId, userId);
		}

		// Обычный режим с аутентификацией через Clerk
		if (!currentUser) {
			console.warn('findPrompt: no authentication available');
			return null;
		}

		const requestingUserId = (await currentUser())?.id;
		
		// Если передан userId, но он не совпадает с сессией - логируем это
		if (userId && userId !== requestingUserId) {
			console.warn('findPrompt: attempted access with mismatched userId for video');
		}
		
		if (!requestingUserId) {
			console.warn('findPrompt: unauthorized access attempt to video');
			return null;
		}

		return await findPromptInternal(videoId, requestingUserId);
	} catch (error) {
		console.error('findPrompt: error occurred', error instanceof Error ? { message: error.message, name: error.name } : { message: 'unknown error' });
		throw new Error('findPrompt: internal error');
	}
}