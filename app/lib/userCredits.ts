import { auth } from "@/auth";
import { prisma } from "./db";
import { logger } from "@/lib/logger";

/**
 * Получает количество кредитов пользователя
 * @param userIdFromCaller - Опциональный ID пользователя (если не передан, берётся из сессии)
 * @returns Количество кредитов пользователя или 0 если пользователь не найден
 */
export const userCredits = async (userIdFromCaller?: string | null): Promise<number> => {
  try {
    let resolvedUserId = userIdFromCaller;
    
    // Если userId не передан, получаем из сессии
    if (!resolvedUserId) {
      const session = await auth();
      resolvedUserId = session?.user?.id;
    }
    
    if (!resolvedUserId) {
      logger.warn(
        "Попытка получить кредиты для неаутентифицированного пользователя"
      );
      return 0;
    }

    // Более эффективный запрос - получаем только поле credits
    const userData = await prisma.user.findUnique({
      where: { id: resolvedUserId },
      select: { credits: true },
    });

    if (!userData) {
      logger.warn('Пользователь не найден в базе данных', { userId: resolvedUserId });
      return 0;
    }

    return userData.credits;
  } catch (error) {
    logger.error("Ошибка при получении кредитов пользователя", {
      error: error instanceof Error ? error.message : String(error)
    });
    // В продакшене можно отправлять ошибки в систему мониторинга
    return 0;
  }
};
