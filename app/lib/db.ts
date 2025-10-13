/**
 * @fileoverview Конфигурация базы данных Prisma с механизмом retry и управлением соединениями
 * 
 * Этот модуль обеспечивает:
 * - Единый экземпляр Prisma Client с глобальным кэшированием
 * - Автоматический выбор URL подключения в зависимости от окружения
 * - Graceful shutdown в режиме разработки без утечек memory
 * - Механизм автоматических повторных попыток для сетевых ошибок
 */

import { PrismaClient } from "@prisma/client";
import { logger } from "@/lib/logger";

/**
 * Глобальный объект для кэширования экземпляра Prisma Client и состояния обработчиков событий.
 * Используется для предотвращения создания множественных подключений в режиме разработки
 * при Hot Module Reload (HMR) в Next.js.
 */
const globalForPrisma = global as unknown as { 
	prisma: PrismaClient;
	hasBeforeExitHandler?: boolean;
};

/**
 * Автоматический выбор URL подключения к базе данных в зависимости от окружения.
 * 
 * В development и production режимах используется DATABASE_URL как основной,
 * а DIRECT_URL как fallback при отсутствии основного.
 */
const isDev = process.env.NODE_ENV !== "production";
const primaryUrl = isDev ? process.env.DATABASE_URL : process.env.DATABASE_URL;
const secondaryUrl = isDev ? process.env.DIRECT_URL : process.env.DIRECT_URL;
const resolvedDbUrl = primaryUrl || secondaryUrl;

if (!resolvedDbUrl) {
	throw new Error(
		"Database connection URL is not set. Please define DATABASE_URL or DIRECT_URL in your .env",
	);
}

/**
 * Экземпляр Prisma Client для взаимодействия с базой данных.
 */
export const prisma =
	globalForPrisma.prisma ||
	new PrismaClient({
		datasources: {
			db: {
				url: resolvedDbUrl,
			},
		},
		log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
	});

/**
 * Глобальная конфигурация для всех окружений
 * В development кэшируем для HMR
 */
if (process.env.NODE_ENV !== "production") {
	globalForPrisma.prisma = prisma;
}

/**
 * Graceful shutdown для всех окружений
 * Автоматически закрываем соединение только через beforeExit
 * (когда event loop пуст и процесс завершается)
 * 
 * Для явного управления (например, в worker) используйте prisma.$disconnect()
 */
if (!globalForPrisma.hasBeforeExitHandler) {
	globalForPrisma.hasBeforeExitHandler = true;
	
	process.on('beforeExit', async () => {
		try {
			await prisma.$disconnect();
			logger.debug('Prisma connection closed via beforeExit');
		} catch (error) {
			// Игнорируем ошибки при повторном закрытии
			if (error instanceof Error && !error.message.includes('already')) {
				logger.error('Error disconnecting Prisma', {
					error: error.message
				});
			}
		}
	});
}

/**
 * Обертка для операций с базой данных с механизмом автоматических повторных попыток.
 */
export async function withRetry<T>(
	operation: () => Promise<T>,
	maxRetries = 3,
	delayMs = 1000
): Promise<T> {
	for (let attempt = 1; attempt <= maxRetries; attempt++) {
		try {
			return await operation();
		} catch (error: any) {
			if (attempt === maxRetries) {
				throw error;
			}
			
			if (error.code === 'P1001' || error.code === 'P1017') {
				logger.warn('Database connection failed, retrying', { attempt, maxRetries, delayMs });
				await new Promise(resolve => setTimeout(resolve, delayMs));
				continue;
			}
			
			throw error;
		}
	}
	
	throw new Error('Maximum retries exceeded');
}