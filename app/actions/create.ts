"use server";

import { currentUser } from "@clerk/nextjs/server";
import { randomUUID } from "crypto";
import { prisma } from "../lib/db";
import { processVideo } from "./processes";

export const createVideo = async (prompt: string) => {
  const trimmed = (prompt ?? "").trim();
  if (trimmed.length < 5) {
    throw new Error("INVALID_PROMPT");
  }
  if (trimmed.length > 500) {
    throw new Error("PROMPT_TOO_LONG");
  }

  const user = await currentUser();
  const userId = user?.id;
  if (!userId) {
    throw new Error("UNAUTHORIZED");
  }

  const videoId = randomUUID();

  // Atomically check and decrement credits, then create a video record
  const result = await prisma.$transaction(async (tx) => {
    // Try to decrement only if credits >= 1
    const updateRes = await tx.user.updateMany({
      where: { userId, credits: { gte: 1 } },
      data: { credits: { decrement: 1 } },
    });

    if (updateRes.count === 0) {
      throw new Error("NO_CREDITS");
    }

    await tx.video.create({
      data: {
        videoId,
        userId,
        prompt: trimmed,
        processing: true,
      },
    });

    return { videoId };
  });

  // image generation, audio, caption, final rendering
  await processVideo(result.videoId);
};
