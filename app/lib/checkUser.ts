import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "./db";

const checkUser = async (): Promise<string | null> => {
  const user = await currentUser();

  if (!user) {
    return null;
  }

  const userId = user.id;
  const email = user.primaryEmailAddress?.emailAddress;
  const existingUser = await prisma.user.findUnique({
    where: { userId: userId },
  });

  if (!existingUser) {
    await prisma.user.create({
      data: {
        userId: userId,
        email: email ?? "",
      },
    });
  }
  
  return user.id;
};

export default checkUser;
