import { auth, clerkClient } from "@clerk/nextjs/server";
import { prisma, withRetry } from "./db";

/**
 * Проверяет существование пользователя в базе данных и возвращает его Clerk ID.
 * Использует атомарную операцию upsert для избежания race conditions при первом входе.
 * Оптимизирована для производительности - использует auth() вместо currentUser().
 * 
 * @returns Promise<string | null> - ID пользователя если аутентифицирован и пользователь существует/создан, иначе null
 */
const checkUser = async (): Promise<string | null> => {
  try {
    // Используем auth() вместо currentUser() для лучшей производительности
    // auth() только извлекает userId из токена без дополнительных API вызовов
    const { userId } = await auth();
    
    if (!userId) {
      return null;
    }

    // Проверяем, существует ли пользователь в базе данных, чтобы избежать ненужных API вызовов
    const existingUser = await withRetry(async () => {
      return await prisma.user.findUnique({
        where: { userId },
        select: { userId: true }
      });
    });

    if (existingUser) {
      return userId;
    }

    // Получаем полные данные пользователя из Clerk только если нужно создать нового пользователя
    let email: string;
    try {
      const client = await clerkClient();
      const user = await client.users.getUser(userId);
      email = user.primaryEmailAddress?.emailAddress ?? `${userId}@placeholder.invalid`;
    } catch (clerkError) {
      console.warn("Не удалось получить данные пользователя из Clerk, используем placeholder email:", clerkError);
      email = `${userId}@placeholder.invalid`;
    }

    // Создаем нового пользователя с атомарной операцией upsert
    await withRetry(async () => {
      return await prisma.user.upsert({
        where: { userId },
        update: {}, // Обновления не нужны, если пользователь каким-то образом уже существует
        create: {
          userId,
          email,
        },
      });
    });

    return userId;
  } catch (error) {
    if (error instanceof Error) {
      console.error("Ошибка в checkUser():", {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
    } else {
      console.error("checkUser() завершился с неизвестной ошибкой:", error);
    }
    return null;
  }
};

export default checkUser;
