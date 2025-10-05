import { AssemblyAI } from "assemblyai";
import { prisma } from "../lib/db";
import { logger } from "@/lib/logger";

const apiKey = process.env.ASSEMBLYAI_API_KEY;
const FRAME_RATE = 30;

type Caption = {
  text: string;
  startFrame: number;
  endFrame: number;
};

if (!apiKey) {
  throw new Error("ASSEMBLYAI_API_KEY is not defined");
}

const client = new AssemblyAI({
  apiKey: apiKey,
});

export const generateCaptions = async (
  videoId: string
): Promise<Caption[] | undefined> => {
  try {
    const video = await prisma.video.findUnique({
      where: { videoId },
    });

    if (!video?.audio) {
      return undefined;
    }

    const transcript = await client.transcripts.transcribe({
      audio_url: video.audio,
    });

    if (!transcript.words) {
      return [];
    }

    const captions: Caption[] = transcript.words
      .map((word) => {
        const startFrame = Math.max(
          0,
          Math.floor((word.start / 1000) * FRAME_RATE)
        );
        const endFrameRaw = Math.ceil((word.end / 1000) * FRAME_RATE) - 1;
        const endFrame = Math.max(startFrame, endFrameRaw);

        return {
          text: word.text,
          startFrame,
          endFrame,
        };
      })
      .filter((caption) => caption.endFrame >= caption.startFrame);

    await prisma.video.update({
      where: { videoId },
      data: { captions: captions },
    });

    return captions;
  } catch (error) {
    logger.error("Error generating captions", {
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
};
