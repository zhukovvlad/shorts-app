import { prisma } from "../lib/db";
import { videoDuration } from "../lib/duration";
import { findPromptInternal } from "../lib/findPrompt";
import { generateAudio } from "./audio";
import { generateCaptions } from "./captions";
import { generateImages } from "./image";
import { renderVideo } from "./render";
import { generateScript } from "./script";
import { setVideoProgress, getVideoCheckpoint, markStepCompleted, markStepFailed, getNextStep, deleteVideoCheckpoint } from "@/lib/redis";

export const processVideo = async (videoId: string, userId: string) => {
  try {
    // Получаем checkpoint для определения с какого шага начинать
    const checkpoint = await getVideoCheckpoint(videoId);
    const nextStep = getNextStep(checkpoint);
    
    console.log(`🔄 Processing video ${videoId}, starting from step: ${nextStep}`);
    if (checkpoint?.lastFailedStep) {
      console.log(`⚠️ Previous failure at step: ${checkpoint.lastFailedStep}`);
    }

    // Шаг 1: Генерация сценария (пропускаем если уже выполнен)
    if (nextStep === 'script') {
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
        where: { videoId },
        data: {
          content: fullContent,
          imagePrompts: imagePrompts,
        },
      });

      await markStepCompleted(videoId, userId, 'script');
      console.log("✅ Script generation completed");
    } else {
      console.log("⏭️ Skipping script generation (already completed)");
    }

    // Шаг 2: Создание изображений (пропускаем если уже выполнен)
    if (getNextStep(await getVideoCheckpoint(videoId)) === 'images') {
      await setVideoProgress(videoId, {
        status: 'images',
        step: 'Создание изображений...',
        timestamp: Date.now(),
        userId
      }).catch(err => console.warn('Redis progress update failed:', err));

      await generateImages(videoId);
      await markStepCompleted(videoId, userId, 'images');
      console.log("✅ Images generation completed");
    } else {
      console.log("⏭️ Skipping images generation (already completed)");
    }
    
    // Шаг 3: Синтез речи (пропускаем если уже выполнен)
    if (getNextStep(await getVideoCheckpoint(videoId)) === 'audio') {
      await setVideoProgress(videoId, {
        status: 'audio',
        step: 'Синтез речи...',
        timestamp: Date.now(),
        userId
      }).catch(err => console.warn('Redis progress update failed:', err));
      
      await generateAudio(videoId);
      await markStepCompleted(videoId, userId, 'audio');
      console.log("✅ Audio generation completed");
    } else {
      console.log("⏭️ Skipping audio generation (already completed)");
    }
    
    // Шаг 4: Генерация субтитров (пропускаем если уже выполнен)
    if (getNextStep(await getVideoCheckpoint(videoId)) === 'captions') {
      await setVideoProgress(videoId, {
        status: 'captions',
        step: 'Генерация субтитров...',
        timestamp: Date.now(),
        userId
      }).catch(err => console.warn('Redis progress update failed:', err));
      
      await generateCaptions(videoId);
      await markStepCompleted(videoId, userId, 'captions');
      console.log("✅ Captions generation completed");
    } else {
      console.log("⏭️ Skipping captions generation (already completed)");
    }

    await videoDuration(videoId);

    // Шаг 5: Рендеринг видео (пропускаем если уже выполнен)
    if (getNextStep(await getVideoCheckpoint(videoId)) === 'render') {
      await setVideoProgress(videoId, {
        status: 'render',
        step: 'Рендеринг видео...',
        timestamp: Date.now(),
        userId
      }).catch(err => console.warn('Redis progress update failed:', err));

      await renderVideo(videoId);
      await markStepCompleted(videoId, userId, 'render');
      console.log("✅ Video rendering completed");
    } else {
      console.log("⏭️ Skipping video rendering (already completed)");
    }

    // Все шаги завершены - очищаем checkpoint
    await deleteVideoCheckpoint(videoId);
    console.log("🎉 All steps completed, checkpoint cleared");

  } catch (error) {
    console.error("Error processing video:", error);
    
    // Определяем на каком шаге произошла ошибка
    const checkpoint = await getVideoCheckpoint(videoId);
    const currentStep = getNextStep(checkpoint);
    await markStepFailed(videoId, userId, currentStep);
    
    // Определяем причину ошибки для более понятного сообщения
    let errorReason = 'Неизвестная ошибка';
    if (error instanceof Error) {
      if (error.message.includes('fetch failed') || error.message.includes('Connect Timeout')) {
        errorReason = 'Проблема с подключением к внешним сервисам';
      } else if (error.message.includes('API') || error.message.includes('assemblyai')) {
        errorReason = 'Временная недоступность сервиса субтитров';
      } else if (error.message.includes('S3') || error.message.includes('upload')) {
        errorReason = 'Проблема с загрузкой файлов';
      } else {
        errorReason = error.message;
      }
    }
    
    // Устанавливаем ошибку в прогрессе (но не блокируем если Redis недоступен)
    await setVideoProgress(videoId, {
      status: 'error',
      error: errorReason,
      lastError: error instanceof Error ? error.message : 'Unknown error',
      timestamp: Date.now(),
      userId
    }).catch(err => console.warn('Redis error update failed:', err));
    
    throw error;
  }
};
