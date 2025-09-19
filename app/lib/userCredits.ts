import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "./db";

/**
 * Получает количество кредитов пользователя
 * @returns Количество кредитов пользователя или 0 если пользователь не найден
 */
export const userCredits = async (userIdFromCaller?: string | null): Promise<number> => {
  try {
    const resolvedUserId = userIdFromCaller ?? (await currentUser())?.id;
    if (!resolvedUserId) {
      console.warn(
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
      console.warn(`Пользователь с ID ${resolvedUserId} не найден в базе данных`);
      return 0;
    }

    return userData.credits;
  } catch (error) {
    console.error("Ошибка при получении кредитов пользователя:", error);
    // В продакшене можно отправлять ошибки в систему мониторинга
    return 0;
  }
};
