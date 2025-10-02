import { prisma } from "../lib/db";
import { videoDuration } from "../lib/duration";
import { findPromptInternal } from "../lib/findPrompt";
import { generateAudio } from "./audio";
import { generateCaptions } from "./captions";
import { generateImages } from "./image";
import { renderVideo } from "./render";
import { generateScript } from "./script";
import { setVideoProgress } from "@/lib/redis";

export const processVideo = async (videoId: string, userId: string) => {
  try {
    // Шаг 1: Генерация сценария
    await setVideoProgress(videoId, {
      status: 'script',
      step: 'Генерация сценария...',
      timestamp: Date.now(),
      userId
    }).catch(err => console.warn('Redis progress update failed:', err));

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

    // Шаг 2: Создание изображений
    await setVideoProgress(videoId, {
      status: 'images',
      step: 'Создание изображений...',
      timestamp: Date.now(),
      userId
    }).catch(err => console.warn('Redis progress update failed:', err));

    const imagesPromise = generateImages(videoId);
    
    // Шаг 3: Синтез речи
    await setVideoProgress(videoId, {
      status: 'audio',
      step: 'Синтез речи...',
      timestamp: Date.now(),
      userId
    }).catch(err => console.warn('Redis progress update failed:', err));
    
    await generateAudio(videoId);
    
    // Шаг 4: Генерация субтитров
    await setVideoProgress(videoId, {
      status: 'captions',
      step: 'Генерация субтитров...',
      timestamp: Date.now(),
      userId
    }).catch(err => console.warn('Redis progress update failed:', err));
    
    await generateCaptions(videoId);
    await imagesPromise;
    await videoDuration(videoId);

    // Шаг 5: Рендеринг видео
    await setVideoProgress(videoId, {
      status: 'render',
      step: 'Рендеринг видео...',
      timestamp: Date.now(),
      userId
    }).catch(err => console.warn('Redis progress update failed:', err));

    await renderVideo(videoId);

  } catch (error) {
    console.error("Error processing video:", error);
    
    // Устанавливаем ошибку в прогрессе (но не блокируем если Redis недоступен)
    await setVideoProgress(videoId, {
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: Date.now(),
      userId
    }).catch(err => console.warn('Redis error update failed:', err));
    
    throw error;
  }
};
