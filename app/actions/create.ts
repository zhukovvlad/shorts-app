"use server";

import { currentUser } from "@clerk/nextjs/server";
import { randomUUID } from "crypto";
import { prisma } from "../lib/db";
import { decreaseCredits } from "../lib/decreaseCredits";
import { processVideo } from "./processes";

export const createVideo = async (prompt: string) => {
  console.log(prompt);
  const videoId = randomUUID();
  const user = await currentUser();
  const userId = user?.id;

  if (!userId) {
    return null;
  }

  await prisma.video.create({
    data: {
      videoId,
      userId,
      prompt,
      processing: true,
    },
  });

  await decreaseCredits(userId);

  // image generation, audio, caption, final rendering
  await processVideo(videoId);
};
