"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Copy, Play, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { logger } from "@/lib/logger";

interface PromptExample {
  id: string;
  category: string;
  title: string;
  prompt: string;
  description: string;
  tags: string[];
  estimatedDuration: string;
}

const promptExamples: PromptExample[] = [
  {
    id: "1",
    category: "Образование",
    title: "Объяснение квантовой физики",
    prompt: "Explain quantum physics in simple terms that a 10-year-old could understand, using everyday analogies and examples",
    description: "Простое объяснение сложной темы с аналогиями",
    tags: ["наука", "образование", "простой язык"],
    estimatedDuration: "30-45 сек"
  },
  {
    id: "2", 
    category: "Кулинария",
    title: "Быстрый рецепт пасты",
    prompt: "Show how to make delicious carbonara pasta in under 10 minutes, with step-by-step instructions and cooking tips",
    description: "Пошаговый кулинарный рецепт",
    tags: ["кулинария", "быстро", "инструкция"],
    estimatedDuration: "45-60 сек"
  },
  {
    id: "3",
    category: "Мотивация",
    title: "Утренняя мотивация",
    prompt: "Create an inspiring morning motivation video about achieving your goals and starting the day with positive energy",
    description: "Вдохновляющий контент для начала дня",
    tags: ["мотивация", "утро", "цели"],
    estimatedDuration: "30-40 сек"
  },
  {
    id: "4",
    category: "Технологии",
    title: "Объяснение ИИ",
    prompt: "Explain how artificial intelligence works in everyday life, showing examples of AI in smartphones, apps, and daily tasks",
    description: "Доступное объяснение ИИ в повседневности",
    tags: ["технологии", "ИИ", "примеры"],
    estimatedDuration: "40-50 сек"
  },
  {
    id: "5",
    category: "Фитнес",
    title: "Домашняя тренировка",
    prompt: "Demonstrate a 5-minute full-body workout that can be done at home without any equipment, perfect for beginners",
    description: "Быстрая домашняя тренировка",
    tags: ["фитнес", "дом", "без оборудования"],
    estimatedDuration: "35-45 сек"
  },
  {
    id: "6",
    category: "Бизнес",
    title: "Советы по продуктивности", 
    prompt: "Share 3 proven productivity hacks that successful entrepreneurs use to get more done in less time",
    description: "Практические советы для повышения эффективности",
    tags: ["бизнес", "продуктивность", "советы"],
    estimatedDuration: "30-40 сек"
  }
];

const categories = ["Все", ...Array.from(new Set(promptExamples.map(p => p.category)))];

interface PromptExamplesProps {
  onSelectPrompt?: (prompt: string) => void;
  className?: string;
}

export const PromptExamples = ({ onSelectPrompt, className }: PromptExamplesProps) => {
  const [selectedCategory, setSelectedCategory] = useState("Все");

  const filteredExamples = selectedCategory === "Все" 
    ? promptExamples 
    : promptExamples.filter(example => example.category === selectedCategory);

  const copyToClipboardFallback = (text: string): boolean => {
    let textarea: HTMLTextAreaElement | null = null;
    try {
      // Create a temporary textarea element
      textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.readOnly = true;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      textarea.style.pointerEvents = 'none';
      
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      textarea.setSelectionRange(0, text.length);
      
      const success = document.execCommand('copy');
      return success;
    } catch (error) {
      logger.error("Fallback copy method failed", { error: error instanceof Error ? error.message : String(error) });
      return false;
    } finally {
      // Ensure textarea is always removed from DOM
      if (textarea && textarea.parentNode) {
        textarea.parentNode.removeChild(textarea);
      }
    }
  };

  const handleCopyPrompt = async (prompt: string) => {
    try {
      // Check if Clipboard API is available
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(prompt);
        toast.success("Промпт скопирован в буфер обмена!");
      } else {
        // Fallback method using document.execCommand
        const success = copyToClipboardFallback(prompt);
        if (success) {
          toast.success("Промпт скопирован в буфер обмена!");
        } else {
          toast.error("Не удалось скопировать промпт. Попробуйте выделить и скопировать текст вручную.");
        }
      }
    } catch (error) {
      logger.error("Failed to copy prompt", { error: error instanceof Error ? error.message : String(error) });
      // Fallback to legacy method
      const fallbackSuccess = copyToClipboardFallback(prompt);
      if (fallbackSuccess) {
        toast.success("Промпт скопирован в буфер обмена!");
      } else {
        toast.error("Не удалось скопировать промпт. Попробуйте выделить и скопировать текст вручную.");
      }
    }
  };

  const handleUsePrompt = (prompt: string) => {
    if (onSelectPrompt) {
      onSelectPrompt(prompt);
      toast.success("Промпт добавлен в поле ввода!");
    }
  };

  return (
    <div className={className}>
      {/* Header */}
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-2 mb-4">
          <Sparkles className="h-6 w-6 text-yellow-400" />
          <h2 className="text-2xl font-bold text-white">Примеры промптов</h2>
        </div>
        <p className="text-gray-300 max-w-2xl mx-auto">
          Вдохновитесь готовыми идеями или используйте их как основу для создания собственного контента
        </p>
      </div>

      {/* Category Filter */}
      <div className="flex flex-wrap justify-center gap-2 mb-8">
        {categories.map(category => (
          <Button
            key={category}
            variant={selectedCategory === category ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedCategory(category)}
            className={`rounded-full ${
              selectedCategory === category 
                ? "bg-gradient-to-r from-[#3352CC] to-[#1C2D70] text-white" 
                : "border-gray-600 text-gray-300 hover:bg-gray-800"
            }`}
          >
            {category}
          </Button>
        ))}
      </div>

      {/* Examples Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredExamples.map(example => (
          <Card key={example.id} className="bg-gray-800/50 border-gray-700 hover:bg-gray-800/70 transition-colors duration-200">
            <CardContent className="p-6">
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div>
                  <Badge variant="secondary" className="bg-blue-500/20 text-blue-300 mb-2">
                    {example.category}
                  </Badge>
                  <h3 className="font-semibold text-white mb-1">
                    {example.title}
                  </h3>
                  <p className="text-sm text-gray-400">
                    {example.description}
                  </p>
                </div>
              </div>

              {/* Prompt */}
              <div className="bg-gray-900/50 p-3 rounded-lg mb-4">
                <p className="text-sm text-gray-300 line-clamp-3">
                  &ldquo;{example.prompt}&rdquo;
                </p>
              </div>

              {/* Tags */}
              <div className="flex flex-wrap gap-1 mb-4">
                {example.tags.map(tag => (
                  <Badge key={tag} variant="outline" className="text-xs border-gray-600 text-gray-400">
                    {tag}
                  </Badge>
                ))}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">
                  ~{example.estimatedDuration}
                </span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleCopyPrompt(example.prompt)}
                    className="h-8 w-8 p-0 hover:bg-gray-700 cursor-pointer"
                    aria-label="Copy prompt"
                    title="Copy prompt to clipboard"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  {onSelectPrompt && (
                    <Button
                      size="sm"
                      onClick={() => handleUsePrompt(example.prompt)}
                      className="bg-gradient-to-r from-[#3352CC] to-[#1C2D70] hover:opacity-90 text-white cursor-pointer"
                    >
                      <Play className="h-4 w-4 mr-1" />
                      Использовать
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Footer Note */}
      <div className="text-center mt-8 p-4 bg-gray-800/30 rounded-lg">
        <p className="text-sm text-gray-400">
          💡 <strong>Совет:</strong> Более детальные промпты дают лучшие результаты. 
          Указывайте стиль, тон, целевую аудиторию и ключевые моменты.
        </p>
      </div>
    </div>
  );
};

export default PromptExamples;