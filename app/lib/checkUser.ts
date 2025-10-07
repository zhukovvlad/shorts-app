import { auth } from "@/auth";
import { prisma, withRetry } from "./db";
import { logger } from "@/lib/logger";
import crypto from "crypto";

/**
 * Проверяет существование пользователя в базе данных и возвращает его ID.
 * Использует атомарную операцию upsert для избежания race conditions при первом входе.
 * Оптимизирована для производительности - использует NextAuth session.
 * 
 * @returns Promise<string | null> - ID пользователя если аутентифицирован и пользователь существует/создан, иначе null
 */
const checkUser = async (): Promise<string | null> => {
  try {
    // Получаем сессию из NextAuth
    const session = await auth();
    
    if (!session?.user?.id) {
      return null;
    }

    const userId = session.user.id;
    const email = session.user.email;

    // Проверяем, существует ли пользователь в базе данных
    const existingUser = await withRetry(async () => {
      return await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true }
      });
    });

    if (existingUser) {
      return userId;
    }

    // Создаем нового пользователя с атомарной операцией upsert
    // Пользователь должен был быть создан через PrismaAdapter при первом входе,
    // но на всякий случай делаем upsert
    // Upsert выполняется безусловно, чтобы гарантировать создание записи пользователя,
    // даже если провайдер не вернул email (GitHub с скрытым email, сбои Mail.ru и т.д.)
    
    // Вычисляем email для пользователя - либо из провайдера, либо генерируем fallback
    let userEmail = email;
    if (!userEmail) {
      // Используем SHA-256 хеш от userId для уникальности и меньшей предсказуемости
      const hash = crypto.createHash('sha256').update(userId).digest('hex').substring(0, 16);
      // Используем noreply поддомен - замените yourdomain.com на ваш контролируемый домен
      userEmail = `no-email-${hash}@noreply.yourdomain.com`;
    }
    
    // Дополнительная проверка безопасности (не должно происходить, но делаем явной инвариант)
    if (!userEmail) {
      throw new Error('Cannot create user without email: both provider email and fallback are missing');
    }
    
    await withRetry(async () => {
      return await prisma.user.upsert({
        where: { id: userId },
        update: {}, // Обновления не нужны, если пользователь уже существует
        create: {
          id: userId,
          email: userEmail,
          name: session.user?.name ?? null,
          image: session.user?.image ?? null,
        },
      });
    });

    return userId;
  } catch (error) {
    if (error instanceof Error) {
      logger.error("Ошибка в checkUser()", {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
    } else {
      logger.error("checkUser() завершился с неизвестной ошибкой", { error });
    }
    return null;
  }
};

export default checkUser;
