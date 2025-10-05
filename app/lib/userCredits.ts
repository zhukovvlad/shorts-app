import { auth, currentUser } from "@clerk/nextjs/server";
import { prisma } from "./db";
import { logger } from "@/lib/logger";

/**
 * Получает количество кредитов пользователя
 * @returns Количество кредитов пользователя или 0 если пользователь не найден
 */
export const userCredits = async (userIdFromCaller?: string | null): Promise<number> => {
  try {
    const resolvedUserId = userIdFromCaller ?? (await currentUser())?.id;
    if (!resolvedUserId) {
      logger.warn(
        "Попытка получить кредиты для неаутентифицированного пользователя"
      );
      return 0;
    }

    // Более эффективный запрос - получаем только поле credits
    const userData = await prisma.user.findUnique({
      where: { userId: resolvedUserId },
      select: { credits: true },
    });

    if (!userData) {
      logger.warn('Пользователь не найден в базе данных', { userId: resolvedUserId });
      return 0;
    }

    return userData.credits;
  } catch (error) {
    console.error("Ошибка при получении кредитов пользователя:", error);
    // В продакшене можно отправлять ошибки в систему мониторинга
    return 0;
  }
};
