import { auth } from "@clerk/nextjs/server";
import { prisma } from "./db";
import { logger } from "@/lib/logger";

/**
 * Облегченная версия checkUser, которая только проверяет существование пользователя в базе данных
 * без получения дополнительных данных из Clerk API.
 * Рекомендуется использовать когда реальный email пользователя не критично важен.
 * 
 * @returns Promise<string | null> - ID пользователя если аутентифицирован и пользователь существует/создан, иначе null
 */
const checkUserLight = async (): Promise<string | null> => {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return null;
    }

    // Атомарная операция upsert с минимальными данными
    await prisma.user.upsert({
      where: { userId },
      update: {}, // Обновления не нужны
      create: {
        userId,
        email: `${userId}@placeholder.invalid`, // Используем placeholder для соответствия ограничениям схемы
      },
    });

    return userId;
  } catch (error) {
    if (error instanceof Error) {
      console.error("Ошибка в checkUserLight():", {
        message: error.message,
        userId: 'скрыто для безопасности'
      });
    } else {
      console.error("checkUserLight() завершился с неизвестной ошибкой:", error);
    }
    return null;
  }
};

export default checkUserLight;