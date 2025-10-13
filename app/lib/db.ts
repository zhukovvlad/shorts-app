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
	prisma?: PrismaClient;
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
	globalForPrisma.prisma ??
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
 * Проверяет, является ли ошибка Prisma retryable (временной).
 * Может использоваться в других модулях для консистентной обработки Prisma ошибок.
 * 
 * Retryable коды:
 * - P1001: Can't reach database server
 * - P1008: Operations timed out
 * - P1017: Server has closed the connection
 * 
 * @param error - Ошибка для проверки
 * @returns true если ошибка временная и можно сделать retry
 * 
 * @example
 * ```typescript
 * try {
 *   await prisma.user.create({ ... });
 * } catch (error) {
 *   if (isPrismaRetryable(error)) {
 *     // Можно повторить операцию
 *   } else {
 *     // Логическая ошибка, retry бесполезен
 *   }
 * }
 * ```
 */
export function isPrismaRetryable(error: unknown): boolean {
	// Определяем код ошибки из разных типов Prisma ошибок
	let code: string | undefined;
	
	if (error instanceof Prisma.PrismaClientKnownRequestError) {
		code = error.code;
	} else if (error instanceof Prisma.PrismaClientInitializationError) {
		code = error.errorCode;
	}
	
	// Retryable коды: проблемы подключения, таймауты, закрытые соединения
	return code === 'P1001' || code === 'P1008' || code === 'P1017';
}

/**
 * Обертка для database операций с автоматическими retry при transient ошибках.
 * Обрабатывает временные проблемы подключения и инициализации:
 * - P1001: Can't reach database server
 * - P1008: Operations timed out
 * - P1017: Server has closed the connection
 * - PrismaClientInitializationError с retryable errorCode
 * 
 * @param operation - Асинхронная операция для выполнения
 * @param maxRetries - Максимальное количество попыток (по умолчанию 3)
 * @param delayMs - Начальная задержка перед retry в миллисекундах (по умолчанию 1000)
 * @returns Promise с результатом операции
 * @throws Последнюю ошибку после исчерпания всех попыток
 * 
 * @example
 * ```typescript
 * const user = await withRetry(() => 
 *   prisma.user.findUnique({ where: { id } })
 * );
 * ```
 * 
 * @future Возможно добавление перегрузки с custom retryable codes или predicate функцией
 * для более гибкой обработки ошибок в других частях приложения.
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
			
			// Используем helper для проверки retryable ошибок
			const retryable = isPrismaRetryable(error);
			
			// Извлекаем код для логирования
			let code: string | undefined;
			if (error instanceof Prisma.PrismaClientKnownRequestError) {
				code = error.code;
			} else if (error instanceof Prisma.PrismaClientInitializationError) {
				code = error.errorCode;
			}

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