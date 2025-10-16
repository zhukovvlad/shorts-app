import { prisma } from "./db"

export const decreaseCredits = async (userId: string, amount = 1) => {
	if (amount <= 0) return;
	await prisma.user.update({
		where: { id: userId },
		data: { credits: { decrement: amount } },
	})
}