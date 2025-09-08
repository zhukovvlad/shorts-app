import { prisma } from "../lib/db";
import { findPrompt } from "../lib/findPrompt";
import { generateImages } from "./image";
import { generateScript } from "./script";

export const processVideo = async (videoId: string) => {
  try {
    // const prompt = await findPrompt(videoId);
    // const script = await generateScript(prompt || "");
    // const scriptData = JSON.parse(script || "");
    // const contentTexts = scriptData.content.map(
    //   (item: { contentText: string }) => item.contentText
    // );
    // const fullContent = contentTexts.join(" ");
    // const imagePrompts = scriptData.content.map(
    //   (item: { imagePrompt: string }) => item.imagePrompt
    // );

    // console.log("Generated Script Content Texts:", fullContent);
    // console.log("Generated Image Prompts:", imagePrompts);

    // await prisma.video.update({
    //   where: {
    //     videoId,
    //   },
    //   data: {
    //     content: fullContent,
    //     imagePrompts: imagePrompts,
    //   },
    // });

    await generateImages(videoId);
  
  } catch (error) {
    console.error("Error processing video:", error);
    throw error;
  }
};
