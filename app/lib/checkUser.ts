import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "./db";

/**
 * Ensures a user exists in the database and returns their Clerk user ID.
 * Uses an atomic upsert to avoid race conditions on first sign-in.
 */
const checkUser = async (): Promise<string | null> => {
  try {
    const user = await currentUser();
    if (!user) return null;

    const userId = user.id;
  // Clerk обычно предоставляет email; если нет, используем уникальный плейсхолдер,
  // чтобы не нарушить ограничение уникальности на поле email в схеме Prisma.
  const email = user.primaryEmailAddress?.emailAddress ?? `${user.id}@placeholder.invalid`;

    // Atomic upsert to avoid race conditions (create on first visit).
    await prisma.user.upsert({
      where: { userId },
      update: {},
      create: {
        userId,
        email, // schema requires unique email; Clerk normally provides it
      },
    });

    return userId;
  } catch (err) {
    console.error("checkUser() failed:", err);
    return null;
  }
};

export default checkUser;
