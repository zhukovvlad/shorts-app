/**
 * @fileoverview Тесты для функции decreaseCredits
 * 
 * Проверяет атомарное списание кредитов с защитой от отрицательного баланса
 */

import { decreaseCredits } from './decreaseCredits';
import { prisma } from './db';

// Mock prisma
jest.mock('./db', () => ({
  prisma: {
    user: {
      updateMany: jest.fn(),
    },
  },
}));

describe('decreaseCredits', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Успешное списание', () => {
    it('должно списать 1 кредит по умолчанию', async () => {
      (prisma.user.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

      await decreaseCredits('user-123');

      expect(prisma.user.updateMany).toHaveBeenCalledWith({
        where: { id: 'user-123', credits: { gte: 1 } },
        data: { credits: { decrement: 1 } },
      });
    });

    it('должно списать указанное количество кредитов', async () => {
      (prisma.user.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

      await decreaseCredits('user-456', 5);

      expect(prisma.user.updateMany).toHaveBeenCalledWith({
        where: { id: 'user-456', credits: { gte: 5 } },
        data: { credits: { decrement: 5 } },
      });
    });

    it('должно округлять дробное количество кредитов вниз', async () => {
      (prisma.user.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

      await decreaseCredits('user-789', 3.7);

      expect(prisma.user.updateMany).toHaveBeenCalledWith({
        where: { id: 'user-789', credits: { gte: 3 } },
        data: { credits: { decrement: 3 } },
      });
    });

    it('должно округлять дробное количество с .5 вниз', async () => {
      (prisma.user.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

      await decreaseCredits('user-999', 2.5);

      expect(prisma.user.updateMany).toHaveBeenCalledWith({
        where: { id: 'user-999', credits: { gte: 2 } },
        data: { credits: { decrement: 2 } },
      });
    });
  });

  describe('Валидация входных параметров', () => {
    it('должно выбросить ошибку если userId пустой', async () => {
      await expect(decreaseCredits('', 5)).rejects.toThrow('userId is required');
      expect(prisma.user.updateMany).not.toHaveBeenCalled();
    });

    it('должно ничего не делать при amount = 0', async () => {
      await decreaseCredits('user-123', 0);
      expect(prisma.user.updateMany).not.toHaveBeenCalled();
    });

    it('должно ничего не делать при отрицательном amount', async () => {
      await decreaseCredits('user-123', -5);
      expect(prisma.user.updateMany).not.toHaveBeenCalled();
    });

    it('должно ничего не делать при amount близком к нулю после округления', async () => {
      await decreaseCredits('user-123', 0.3);
      expect(prisma.user.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('Защита от отрицательного баланса', () => {
    it('должно выбросить ошибку при недостаточном балансе', async () => {
      (prisma.user.updateMany as jest.Mock).mockResolvedValue({ count: 0 });

      await expect(decreaseCredits('user-123', 10)).rejects.toThrow(
        'Insufficient credits or user not found'
      );

      expect(prisma.user.updateMany).toHaveBeenCalledWith({
        where: { id: 'user-123', credits: { gte: 10 } },
        data: { credits: { decrement: 10 } },
      });
    });

    it('должно выбросить ошибку если пользователь не найден', async () => {
      (prisma.user.updateMany as jest.Mock).mockResolvedValue({ count: 0 });

      await expect(decreaseCredits('non-existent-user', 1)).rejects.toThrow(
        'Insufficient credits or user not found'
      );
    });
  });

  describe('Атомарность операции', () => {
    it('должно использовать updateMany с условием credits >= amount', async () => {
      (prisma.user.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

      await decreaseCredits('user-123', 7);

      const call = (prisma.user.updateMany as jest.Mock).mock.calls[0][0];
      expect(call.where).toEqual({
        id: 'user-123',
        credits: { gte: 7 },
      });
    });

    it('должно проверить результат операции (count)', async () => {
      (prisma.user.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

      await expect(decreaseCredits('user-123', 2)).resolves.toBeUndefined();
    });

    it('должно НЕ использовать update (который не проверяет баланс)', async () => {
      (prisma.user.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

      await decreaseCredits('user-123', 3);

      // Проверяем что вызван именно updateMany, а не update
      expect(prisma.user.updateMany).toHaveBeenCalled();
      expect(prisma.user).not.toHaveProperty('update');
    });
  });

  describe('Санитизация amount', () => {
    it('должно округлять большие дробные числа', async () => {
      (prisma.user.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

      await decreaseCredits('user-123', 99.999);

      expect(prisma.user.updateMany).toHaveBeenCalledWith({
        where: { id: 'user-123', credits: { gte: 99 } },
        data: { credits: { decrement: 99 } },
      });
    });

    it('должно обработать очень маленькое положительное число', async () => {
      await decreaseCredits('user-123', 0.001);
      // 0.001 округляется до 0, операция не выполняется
      expect(prisma.user.updateMany).not.toHaveBeenCalled();
    });

    it('должно обработать 0.9 как 0 (не выполнять операцию)', async () => {
      await decreaseCredits('user-123', 0.9);
      expect(prisma.user.updateMany).not.toHaveBeenCalled();
    });

    it('должно обработать 1.1 как 1', async () => {
      (prisma.user.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

      await decreaseCredits('user-123', 1.1);

      expect(prisma.user.updateMany).toHaveBeenCalledWith({
        where: { id: 'user-123', credits: { gte: 1 } },
        data: { credits: { decrement: 1 } },
      });
    });
  });

  describe('Возвращаемое значение', () => {
    it('должно возвращать Promise<void>', async () => {
      (prisma.user.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

      const result = await decreaseCredits('user-123', 5);

      expect(result).toBeUndefined();
    });

    it('должно возвращать undefined при amount <= 0', async () => {
      const result = await decreaseCredits('user-123', 0);
      expect(result).toBeUndefined();
    });
  });
});
