import { auth } from "@/auth";
import { prisma } from "./db";
import { logger } from "@/lib/logger";

/**
 * Облегченная версия checkUser, которая только проверяет существование пользователя в базе данных.
 * Рекомендуется использовать когда дополнительные данные пользователя не требуются.
 * 
 * @returns Promise<string | null> - ID пользователя если аутентифицирован и пользователь существует/создан, иначе null
 */
const checkUserLight = async (): Promise<string | null> => {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return null;
    }

    const userId = session.user.id;
    const email = session.user.email;

    // Атомарная операция upsert с минимальными данными
    // PrismaAdapter должен был создать пользователя, но на всякий случай делаем upsert
    if (email) {
      await prisma.user.upsert({
        where: { id: userId },
        update: {}, // Обновления не нужны
        create: {
          id: userId,
          email,
          name: session.user.name,
          image: session.user.image,
        },
      });
    }

    return userId;
  } catch (error) {
    if (error instanceof Error) {
      logger.error("Ошибка в checkUserLight()", {
        message: error.message,
        userId: 'скрыто для безопасности'
      });
    } else {
      logger.error("checkUserLight() завершился с неизвестной ошибкой", { error });
    }
    return null;
  }
};

export default checkUserLight;