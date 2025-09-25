import { prisma } from "../lib/db";
import { videoDuration } from "../lib/duration";
import { findPromptInternal } from "../lib/findPrompt";
import { generateAudio } from "./audio";
import { generateCaptions } from "./captions";
import { generateImages } from "./image";
import { renderVideo } from "./render";
import { generateScript } from "./script";

export const processVideo = async (videoId: string, userId: string) => {
  try {
    const prompt = await findPromptInternal(videoId, userId);
    const script = await generateScript(prompt || "");
    const scriptData = JSON.parse(script || "");
    const contentTexts = scriptData.content.map(
      (item: { contentText: string }) => item.contentText
    );
    const fullContent = contentTexts.join(" ");
    const imagePrompts = scriptData.content.map(
      (item: { imagePrompt: string }) => item.imagePrompt
    );

    console.log("Generated Script Content Texts:", fullContent);
    console.log("Generated Image Prompts:", imagePrompts);

    await prisma.video.update({
      where: {
        videoId,
      },
      data: {
        content: fullContent,
        imagePrompts: imagePrompts,
      },
    });

    const imagesPromise = generateImages(videoId);
    await generateAudio(videoId);
    await generateCaptions(videoId);
    await imagesPromise;
    await videoDuration(videoId);

    await renderVideo(videoId);

  } catch (error) {
    console.error("Error processing video:", error);
    throw error;
  }
};
