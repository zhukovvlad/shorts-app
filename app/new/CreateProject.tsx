"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useState, useEffect } from "react";
import { Cover } from "@/components/ui/cover";
import { ShineBorder } from "@/components/magicui/shine-border";
import { PlaceholdersAndVanishInput } from "@/components/ui/placeholders-and-vanish-input";
import { LoadingSpinner } from "../components/LoadingSpinner";
import PromptExamples from "../components/PromptExamples";
import VideoCreationProgress from "../components/VideoCreationProgress";
import { logger } from "@/lib/logger";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRouter } from "next/navigation";
import { createVideo } from "../actions/create";
import { ChevronDown, ChevronUp, Lightbulb, Sparkles, Zap, Crown } from "lucide-react";
import { useVideoProgress } from "../hooks/useVideoProgress";
import { IMAGE_MODELS, getDefaultModel } from "@/lib/imageModels";
import { Badge } from "@/components/ui/badge";

const CreateProject = ({
  user,
  credits,
}: {
  user: string | null;
  credits: number;
}) => {
  const router = useRouter();
  const placeholders = [
    "What's the first rule of Fight Club?",
    "Who is Tyler Durden?",
    "Where is Andrew Laeddis Hiding?",
    "Write a Javascript method to reverse a string",
    "How to assemble your own PC?",
    "Explain quantum physics in simple terms",
    "Create a cooking tutorial for pasta",
    "Design a workout routine for beginners",
  ];

  const [prompt, setPrompt] = useState("");
  const [selectedModel, setSelectedModel] = useState(getDefaultModel().id);
  const [showLoginDialog, setShowLoginDialog] = useState(false);
  const [showCreditDialog, setShowCreditDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showExamples, setShowExamples] = useState(false);
  const [videoId, setVideoId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const { progress } = useVideoProgress(videoId);

  // Защита от hydration mismatch для Radix UI компонентов
  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSelectPrompt = (selectedPrompt: string) => {
    setPrompt(selectedPrompt);
    setShowExamples(false);
  };

  // Обрабатываем изменения прогресса
  useEffect(() => {
    if (progress.status === 'completed') {
      router.push("/dashboard");
    } else if (progress.status === 'error' && !progress.retryCount) {
      // Показываем ошибку, но НЕ скрываем компонент прогресса
      // Только если это финальная ошибка без предстоящих ретраев
      setError(progress.error || "An error occurred during video creation");
      // НЕ сбрасываем isLoading и videoId - пусть пользователь видит прогресс
    }
  }, [progress, router]);

  // Получаем информацию о выбранной модели
  const selectedModelInfo = IMAGE_MODELS.find(m => m.id === selectedModel) || getDefaultModel();
  
  // Иконка для качества
  const getQualityIcon = (quality: string) => {
    switch (quality) {
      case 'ultra': return <Crown className="h-4 w-4" />;
      case 'high': return <Sparkles className="h-4 w-4" />;
      default: return <Zap className="h-4 w-4" />;
    }
  };

  return (
    <div className="w-screen min-h-screen flex flex-col">
      <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-semibold max-w-7xl mx-auto text-center mt-2 relative z-20 py-6 bg-clip-text text-transparent bg-gradient-to-b from-neutral-800 via-neutral-700 to-neutral-700 dark:from-neutral-800 dark:via-white dark:to-white px-4">
        Generate Realistic Shorts
        <div className="h-6"></div>
        <Cover>warp speed</Cover>
      </h1>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center px-4 pb-8 md:pb-16">
        {!isLoading ? (
          <>
            {/* Model Selection */}
            <div className="w-full max-w-[500px] mb-4">
              <label className="text-sm font-medium text-gray-300 mb-2 block">
                Модель генерации изображений
              </label>
              {mounted ? (
                <Select value={selectedModel} onValueChange={setSelectedModel}>
                  <SelectTrigger className="w-full bg-black/50 border-gray-700 text-white">
                    <SelectValue placeholder="Выберите модель" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-900 border-gray-700">
                    {IMAGE_MODELS.map((model) => (
                      <SelectItem
                        key={model.id}
                        value={model.id}
                        className="text-white hover:bg-gray-800 cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <span>{model.name}</span>
                          {model.isPro && (
                            <Badge variant="secondary" className="bg-gradient-to-r from-yellow-500 to-orange-500 text-xs">
                              PRO
                            </Badge>
                          )}
                          <span className="text-xs text-gray-400">
                            ({model.speed} • {model.quality})
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="w-full h-10 bg-black/50 border border-gray-700 rounded-md animate-pulse" />
              )}
              <div className="mt-2 flex items-start gap-2 text-xs text-gray-400">
                {getQualityIcon(selectedModelInfo.quality)}
                <span>{selectedModelInfo.description}</span>
              </div>
            </div>

            {/* Input Section */}
            <div className="relative rounded-3xl w-full max-w-[500px] overflow-hidden mb-8">
              <ShineBorder
                className="z-10"
                shineColor={["#3352CC", "#3352CC", "#3352CC", "#3352CC"]}
              />
              <PlaceholdersAndVanishInput
                placeholders={placeholders}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onSubmit={async (e) => {
                  e.preventDefault();
                  setError(null);

                  const trimmedPrompt = prompt.trim();
                  if (!trimmedPrompt) {
                    setError("Please enter a prompt");
                    return;
                  }

                  if (!user) {
                    return setTimeout(() => setShowLoginDialog(true), 700);
                  }

                  if (credits < 1) {
                    return setTimeout(() => setShowCreditDialog(true), 700);
                  }

                  if (isLoading) return; // Prevent multiple submissions

                  setIsLoading(true);
                  
                  try {
                    const result = await createVideo(trimmedPrompt, selectedModel);
                    if (result?.videoId) {
                      setVideoId(result.videoId); // Устанавливаем videoId для начала polling
                    } else {
                      setError("Failed to create video. Please try again.");
                      setIsLoading(false);
                    }
                  } catch (err: any) {
                    logger.error("Video creation error", { error: err instanceof Error ? err.message : String(err) });
                    if (err?.message?.includes('not authenticated')) {
                      setError("Authentication required. Please sign in again.");
                      setShowLoginDialog(true);
                    } else {
                      setError("Failed to create video. Please try again.");
                    }
                    setIsLoading(false);
                  }
                }}
              />
              {error && (
                <div className="absolute -bottom-12 left-0 right-0 text-red-500 text-sm text-center">
                  {error}
                </div>
              )}
            </div>

            {/* Examples Toggle */}
            <div className="mb-6">
              <Button
                variant="outline"
                onClick={() => setShowExamples(!showExamples)}
                className="border-gray-600 text-gray-300 hover:bg-gray-800 rounded-full"
              >
                <Lightbulb className="h-4 w-4 mr-2" />
                {showExamples ? "Скрыть примеры" : "Посмотреть примеры промптов"}
                {showExamples ? (
                  <ChevronUp className="h-4 w-4 ml-2" />
                ) : (
                  <ChevronDown className="h-4 w-4 ml-2" />
                )}
              </Button>
            </div>

            {/* Examples Section */}
            {showExamples && (
              <div className="w-full max-w-6xl">
                <PromptExamples 
                  onSelectPrompt={handleSelectPrompt}
                  className="mb-8"
                />
              </div>
            )}

            {/* Tips Section */}
            <div className="max-w-2xl text-center text-gray-400 text-sm">
              <h3 className="font-medium mb-2 text-gray-300">💡 Советы для лучших результатов:</h3>
              <ul className="space-y-1 text-left">
                <li>• Опишите тему, стиль и целевую аудиторию</li>
                <li>• Укажите желаемую тональность (серьезная, веселая, обучающая)</li>
                <li>• Добавьте ключевые моменты, которые должны быть освещены</li>
                <li>• Используйте конкретные примеры и детали</li>
              </ul>
            </div>
          </>
        ) : (
          /* Progress Section */
          <VideoCreationProgress 
            currentStep={progress.status}
            step={progress.step}
            error={progress.status === 'error' ? progress.error : undefined}
            retryCount={progress.retryCount}
            maxRetries={progress.maxRetries}
            lastError={progress.lastError}
            retryReason={progress.retryReason}
            currentStepId={progress.currentStepId}
            completedSteps={progress.completedSteps}
            onTryAgain={() => {
              // Сбрасываем состояние и возвращаемся к форме
              setIsLoading(false);
              setVideoId(null);
              setError(null);
            }}
            className="mt-8"
          />
        )}
      </div>

      {/* Dialogs */}
      <Dialog open={showLoginDialog} onOpenChange={setShowLoginDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-xl">Hello There!</DialogTitle>
            <DialogDescription className="text-gray-600 dark:text-gray-400">
              Please sign in to start creating amazing videos with AI.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button asChild className="bg-black border border-gray-400 text-white rounded-full hover:bg-gray-900 transition-colors duration-150 cursor-pointer">
              <Link href="/sign-in">Sign In</Link>
            </Button>
            <Button asChild className="bg-gradient-to-br hover:opacity-80 text-white rounded-full from-[#3352CC] to-[#1C2D70] font-medium cursor-pointer">
              <Link href="/sign-up">Sign Up</Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <Dialog open={showCreditDialog} onOpenChange={setShowCreditDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-xl">
              <div className="text-red-500 flex items-center gap-2">
                <span>⚡</span>
                Out of Credits
              </div>
            </DialogTitle>
            <DialogDescription className="text-gray-600 dark:text-gray-400">
              You need credits to create videos. Check out our pricing plans
              to continue creating amazing content.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              className="bg-gradient-to-br hover:opacity-80 text-white rounded-full from-[#3352CC] to-[#1C2D70] font-medium cursor-pointer"
              onClick={() => {
                router.push("/pricing");
                setShowCreditDialog(false);
              }}
            >
              View Pricing
            </Button>
            <Button
              variant="outline"
              className="rounded-full cursor-pointer"
              onClick={() => setShowCreditDialog(false)}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CreateProject;