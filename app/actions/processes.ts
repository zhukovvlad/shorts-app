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
    // Получаем checkpoint ОДИН РАЗ в начале и создаем локальное состояние
    let checkpoint = await getVideoCheckpoint(videoId);
    let localNextStep = getNextStep(checkpoint);
    
    console.log(`🔄 Processing video ${videoId}, starting from step: ${localNextStep}`);
    if (checkpoint?.lastFailedStep) {
      console.log(`⚠️ Previous failure at step: ${checkpoint.lastFailedStep}`);
    } else if (!checkpoint) {
      console.log(`📝 No checkpoint found, running full pipeline from beginning`);
    }

    // Определяем последовательность шагов
    const allSteps = ['script', 'images', 'audio', 'captions', 'render'];
    const startIndex = allSteps.indexOf(localNextStep);
    const stepsToExecute = allSteps.slice(startIndex);

    console.log(`📋 Steps to execute: ${stepsToExecute.join(' → ')}`);

    // Выполняем шаги последовательно
    for (const step of stepsToExecute) {
      // Проверяем актуальный checkpoint только если первоначальное чтение было успешным
      if (checkpoint !== null) {
        try {
          const currentCheckpoint = await getVideoCheckpoint(videoId);
          if (currentCheckpoint && getNextStep(currentCheckpoint) !== step) {
            console.log(`⏭️ Skipping ${step} - already completed according to checkpoint`);
            continue;
          }
        } catch (error) {
          console.warn(`⚠️ Failed to read checkpoint, continuing with local state:`, error);
          // Продолжаем с локальным состоянием
        }
      }

      console.log(`🔧 Executing step: ${step}`);

      switch (step) {
        case 'script':
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

          await markStepCompleted(videoId, userId, 'script').catch(err => 
            console.warn('Failed to mark script step as completed:', err)
          );
          console.log("✅ Script generation completed");
          break;

        case 'images':
          await setVideoProgress(videoId, {
            status: 'images',
            step: 'Создание изображений...',
            timestamp: Date.now(),
            userId
          }).catch(err => console.warn('Redis progress update failed:', err));

          await generateImages(videoId);
          await markStepCompleted(videoId, userId, 'images').catch(err => 
            console.warn('Failed to mark images step as completed:', err)
          );
          console.log("✅ Images generation completed");
          break;

        case 'audio':
          await setVideoProgress(videoId, {
            status: 'audio',
            step: 'Синтез речи...',
            timestamp: Date.now(),
            userId
          }).catch(err => console.warn('Redis progress update failed:', err));
          
          await generateAudio(videoId);
          await markStepCompleted(videoId, userId, 'audio').catch(err => 
            console.warn('Failed to mark audio step as completed:', err)
          );
          console.log("✅ Audio generation completed");
          break;

        case 'captions':
          await setVideoProgress(videoId, {
            status: 'captions',
            step: 'Генерация субтитров...',
            timestamp: Date.now(),
            userId
          }).catch(err => console.warn('Redis progress update failed:', err));
          
          await generateCaptions(videoId);
          await markStepCompleted(videoId, userId, 'captions').catch(err => 
            console.warn('Failed to mark captions step as completed:', err)
          );
          console.log("✅ Captions generation completed");
          break;

        case 'render':
          // videoDuration должен быть вызван перед рендерингом
          await videoDuration(videoId);

          await setVideoProgress(videoId, {
            status: 'render',
            step: 'Рендеринг видео...',
            timestamp: Date.now(),
            userId
          }).catch(err => console.warn('Redis progress update failed:', err));

          await renderVideo(videoId);
          await markStepCompleted(videoId, userId, 'render').catch(err => 
            console.warn('Failed to mark render step as completed:', err)
          );
          console.log("✅ Video rendering completed");
          break;
      }
    }

    // Все шаги завершены - очищаем checkpoint
    await deleteVideoCheckpoint(videoId).catch(err => 
      console.warn('Failed to clear checkpoint:', err)
    );
    console.log("🎉 All steps completed, checkpoint cleared");

  } catch (error) {
    console.error("Error processing video:", error);
    
    // При ошибке пытаемся определить на каком шаге произошла ошибка
    // Используем локальную логику если checkpoint недоступен
    let failedStep = 'unknown';
    try {
      const checkpoint = await getVideoCheckpoint(videoId);
      failedStep = getNextStep(checkpoint);
    } catch (checkpointError) {
      console.warn('Failed to read checkpoint for error handling, using fallback logic');
      // Определяем шаг по тексту ошибки как fallback
      const errorMessage = error instanceof Error ? error.message : '';
      if (errorMessage.includes('script') || errorMessage.includes('openai')) {
        failedStep = 'script';
      } else if (errorMessage.includes('image') || errorMessage.includes('generate')) {
        failedStep = 'images';
      } else if (errorMessage.includes('audio') || errorMessage.includes('speech')) {
        failedStep = 'audio';
      } else if (errorMessage.includes('caption') || errorMessage.includes('assemblyai')) {
        failedStep = 'captions';
      } else if (errorMessage.includes('render') || errorMessage.includes('remotion')) {
        failedStep = 'render';
      }
    }
    
    await markStepFailed(videoId, userId, failedStep).catch(err => 
      console.warn('Failed to mark step as failed:', err)
    );
    
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
