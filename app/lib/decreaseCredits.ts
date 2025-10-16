import { prisma } from "./db"

/**
 * Атомарно списывает кредиты у пользователя с защитой от отрицательного баланса
 * 
 * @param userId - ID пользователя
 * @param amount - Количество кредитов для списания (по умолчанию 1)
 * @throws {Error} Если userId не указан
 * @throws {Error} Если недостаточно кредитов или пользователь не найден
 * 
 * @example
 * ```typescript
 * await decreaseCredits('user-123', 5); // Списать 5 кредитов
 * await decreaseCredits('user-123'); // Списать 1 кредит
 * ```
 */
export const decreaseCredits = async (userId: string, amount = 1): Promise<void> => {
	// Санитизация amount - округление до целого числа
	const amt = Math.floor(amount);
	
	// Валидация входных параметров
	if (!userId) {
		throw new Error('userId is required');
	}
	
	// Ранний выход при невалидной сумме
	if (amt <= 0) {
		return;
	}
	
	// Атомарное списание с проверкой достаточности баланса
	// updateMany с условием credits >= amt предотвращает отрицательный баланс
	const result = await prisma.user.updateMany({
		where: { 
			id: userId, 
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