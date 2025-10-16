import { prisma } from "./db"

/**
 * Атомарно списывает кредиты у пользователя с защитой от отрицательного баланса
 * 
 * @param userId - ID пользователя
 * @param amount - Количество кредитов для списания (по умолчанию 1)
 * @throws {Error} Если userId не указан или содержит только пробелы
 * @throws {Error} Если amount не является конечным числом (NaN, Infinity)
 * @throws {Error} Если недостаточно кредитов или пользователь не найден
 * 
 * @example
 * ```typescript
 * await decreaseCredits('user-123', 5); // Списать 5 кредитов
 * await decreaseCredits('user-123'); // Списать 1 кредит
 * ```
 */
export const decreaseCredits = async (userId: string, amount = 1): Promise<void> => {
	// Валидация userId - trim и проверка на непустоту
	const trimmedUserId = userId?.trim();
	if (!trimmedUserId) {
		throw new Error('userId is required and cannot be whitespace-only');
	}
	
	// Валидация amount - проверка на конечность числа
	const numericAmount = Number(amount);
	if (!Number.isFinite(numericAmount)) {
		throw new Error('amount must be a finite number');
	}
	
	// Санитизация amount - округление до целого числа
	const amt = Math.floor(numericAmount);
	
	// Ранний выход при невалидной сумме
	if (amt <= 0) {
		return;
	}
	
	// Атомарное списание с проверкой достаточности баланса
	// updateMany с условием credits >= amt предотвращает отрицательный баланс
	const result = await prisma.user.updateMany({
		where: { 
			id: trimmedUserId, 
			credits: { gte: amt } // Только если кредитов достаточно
		},
		data: { credits: { decrement: amt } },
	});
	
	// Проверка успешности операции
	if (result.count === 0) {
		// count = 0 означает либо пользователь не найден, либо недостаточно кредитов
		throw new Error('Insufficient credits or user not found');
	}
}