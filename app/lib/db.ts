/**
 * @fileoverview Конфигурация базы данных Prisma с механизмом retry и управлением соединениями
 * 
 * Этот модуль обеспечивает:
 * - Единый экземпляр Prisma Client с глобальным кэшированием
 * - Автоматический выбор URL подключения в зависимости от окружения
 * - Graceful shutdown во всех окружениях без утечек memory
 * - Механизм автоматических повторных попыток для сетевых ошибок
 */

import { PrismaClient, Prisma } from "@prisma/client";
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
 * Автоматический выбор URL подключения к базе данных.
 * 
 * Используется DATABASE_URL как основной,
 * а DIRECT_URL как fallback при отсутствии основного.
 */
const resolvedDbUrl = process.env.DATABASE_URL || process.env.DIRECT_URL;

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
 * ВАЖНО: beforeExit не срабатывает, если вызван process.exit().
 * Worker явно вызывает prisma.$disconnect() перед process.exit(),
 * поэтому этот обработчик служит только fallback механизмом.
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
 * 
 * Использует экспоненциальный backoff с jitter для предотвращения thundering herd.
 * Повторяет только при определенных ошибках соединения (P1001, P1017).
 */
export async function withRetry<T>(
	operation: () => Promise<T>,
	maxRetries = 3,
	delayMs = 1000
): Promise<T> {
	let lastError: unknown;
	for (let attempt = 1; attempt <= Math.max(1, maxRetries); attempt++) {
		try {
			return await operation();
		} catch (error: unknown) {
			lastError = error;
			const isPrismaKnown = error instanceof Prisma.PrismaClientKnownRequestError;
			const code = isPrismaKnown ? error.code : undefined;
			const retryable = code === 'P1001' || code === 'P1017';

			if (attempt === maxRetries || !retryable) {
				throw error;
			}

			// Exponential backoff with small jitter, capped at 30s
			const backoff = Math.min(delayMs * 2 ** (attempt - 1), 30_000) + Math.floor(Math.random() * 250);
			logger.warn('Database connection failed, retrying', { attempt, maxRetries, delayMs: backoff, code });
			await new Promise((resolve) => setTimeout(resolve, backoff));
		}
	}
	throw lastError instanceof Error ? lastError : new Error('Maximum retries exceeded');
}