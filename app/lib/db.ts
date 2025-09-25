/**
 * @fileoverview Конфигурация базы данных Prisma с механизмом retry и управлением соединениями
 * 
 * Этот модуль обеспечивает:
 * - Единый экземпляр Prisma Client с глобальным кэшированием
 * - Автоматический выбор URL подключения в зависимости от окружения
 * - Graceful shutdown в режиме разработки без утечек memory
 * - Механизм автоматических повторных попыток для сетевых ошибок
 * 
 * @author shorts-app team
 * @since 1.0.0
 */

import { PrismaClient } from "@prisma/client";

/**
 * Глобальный объект для кэширования экземпляра Prisma Client и состояния обработчиков событий.
 * Используется для предотвращения создания множественных подключений в режиме разработки
 * при Hot Module Reload (HMR) в Next.js.
 * 
 * @property prisma - Кэшированный экземпляр Prisma Client
 * @property hasBeforeExitHandler - Флаг для предотвращения регистрации множественных обработчиков beforeExit
 */
const globalForPrisma = global as unknown as { 
	prisma: PrismaClient;
	hasBeforeExitHandler?: boolean;
};

/**
 * Конфигурация подключения к базе данных
 * 
 * Стратегия выбора URL подключения:
 * - Development: Приоритет DATABASE_URL (pooled connection для стабильности)
 * - Production: Приоритет DATABASE_URL (обычно pooled на 6543 порту)
 * - Fallback: DIRECT_URL если основной URL недоступен
 * 
 * Эта логика обеспечивает оптимальную производительность в разных окружениях.
 */
const isDev = process.env.NODE_ENV !== "production";
const primaryUrl = isDev ? process.env.DATABASE_URL : process.env.DATABASE_URL;
const secondaryUrl = isDev ? process.env.DIRECT_URL : process.env.DIRECT_URL;
const resolvedDbUrl = primaryUrl || secondaryUrl;

if (!resolvedDbUrl) {
	// Fail fast with a clearer message if both env vars are missing
	throw new Error(
		"Database connection URL is not set. Please define DATABASE_URL or DIRECT_URL in your .env",
	);
}

/**
 * Экземпляр Prisma Client для взаимодействия с базой данных.
 * 
 * Особенности реализации:
 * - Singleton pattern: повторное использование одного экземпляра в production
 * - Global caching: в development кэшируется глобально для HMR совместимости
 * - Auto-configuration: автоматический выбор оптимального URL подключения
 * - Environment-specific logging: расширенное логирование в development
 * 
 * @example
 * ```typescript
 * import { prisma } from './db';
 * 
 * const users = await prisma.user.findMany();
 * ```
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
 * Development-режим конфигурация
 * 
 * В режиме разработки выполняется:
 * 1. Глобальное кэширование экземпляра для предотвращения множественных подключений при HMR
 * 2. Регистрация обработчика graceful shutdown для корректного закрытия соединений
 * 3. Защита от утечек memory через предотвращение дублирования event listeners
 * 
 * Обработчик beforeExit обеспечивает корректное закрытие подключения к БД
 * при завершении процесса разработки.
 */
if (process.env.NODE_ENV !== "production") {
	globalForPrisma.prisma = prisma;
	
	// Обеспечиваем graceful отключение в development режиме
	// Регистрируем обработчик beforeExit только один раз для предотвращения утечек слушателей
	if (!globalForPrisma.hasBeforeExitHandler) {
		globalForPrisma.hasBeforeExitHandler = true;
		process.on('beforeExit', async () => {
			await prisma.$disconnect();
		});
	}
}

/**
 * Обертка для операций с базой данных с механизмом автоматических повторных попыток.
 * 
 * Автоматически повторяет операции при временных сбоях сетевого соединения,
 * но не вмешивается в обработку логических ошибок (например, нарушения ограничений).
 * 
 * @template T - Тип возвращаемого значения операции
 * @param operation - Асинхронная функция для выполнения операции с базой данных
 * @param maxRetries - Максимальное количество попыток (по умолчанию 3)
 * @param delayMs - Задержка между попытками в миллисекундах (по умолчанию 1000мс)
 * 
 * @returns Promise<T> - Результат успешно выполненной операции
 * @throws Error - Исходную ошибку после исчерпания всех попыток
 * 
 * @example
 * ```typescript
 * import { prisma, withRetry } from './db';
 * 
 * // Автоматический retry для операций поиска
 * const user = await withRetry(async () => {
 *   return await prisma.user.findUnique({ where: { id: '123' } });
 * });
 * 
 * // Автоматический retry для операций создания
 * const newVideo = await withRetry(async () => {
 *   return await prisma.video.create({ data: videoData });
 * }, 5, 2000); // 5 попыток с задержкой 2 секунды
 * ```
 * 
 * @remarks
 * Функция повторяет операции только при следующих ошибках Prisma:
 * - P1001: Can't reach database server
 * - P1017: Server has closed the connection
 * 
 * Все остальные ошибки (например, P2002 - Unique constraint violation) 
 * не вызывают повторных попыток и возвращаются немедленно.
 * 
 * @since 1.0.0
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
			// Если это последняя попытка, пробрасываем ошибку без обработки
			if (attempt === maxRetries) {
				throw error;
			}
			
			// Повторяем операцию только при ошибках соединения с базой данных
			// P1001: Can't reach database server at `host`:`port`
			// P1017: Server has closed the connection
			if (error.code === 'P1001' || error.code === 'P1017') {
				console.warn(`Database connection failed (attempt ${attempt}/${maxRetries}), retrying in ${delayMs}ms...`);
				await new Promise(resolve => setTimeout(resolve, delayMs));
				continue;
			}
			
			// Все остальные ошибки (логические, нарушения ограничений и т.д.) 
			// не требуют повторных попыток - возвращаем их немедленно
			throw error;
		}
	}
	
	// Эта строка не должна быть достигнута, но добавлена для безопасности типов
	throw new Error('Maximum retries exceeded');
}
