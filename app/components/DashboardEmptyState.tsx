"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Video, Clock, CheckCircle, AlertCircle, PlayCircle } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

interface EmptyStateProps {
  variant: 'no-videos' | 'all-processing' | 'mixed';
  totalVideos?: number;
  processingCount?: number;
}

export const DashboardEmptyState = ({ variant, totalVideos = 0, processingCount = 0 }: EmptyStateProps) => {
  if (variant === 'no-videos') {
    return (
      <div className="text-center py-16 bg-gradient-to-br from-gray-800/50 to-gray-900/50 rounded-xl border border-gray-700 mx-auto max-w-2xl">
        <div className="mb-6">
          <div className="w-20 h-20 mx-auto bg-gradient-to-br from-[#3352CC] to-[#1C2D70] rounded-full flex items-center justify-center mb-4">
            <Video className="h-10 w-10 text-white" />
          </div>
        </div>
        
        <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">
          Время создать первое видео!
        </h2>
        
        <p className="text-lg text-gray-300 mb-6 max-w-md mx-auto">
          Превратите любую идею в увлекательное короткое видео с помощью ИИ
        </p>
        
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8 text-sm">
          <div className="text-center">
            <div className="w-12 h-12 mx-auto bg-blue-500/20 rounded-full flex items-center justify-center mb-2">
              <span className="text-blue-400">✍️</span>
            </div>
            <p className="text-gray-400">Опишите идею</p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 mx-auto bg-purple-500/20 rounded-full flex items-center justify-center mb-2">
              <span className="text-purple-400">🎨</span>
            </div>
            <p className="text-gray-400">ИИ создает контент</p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 mx-auto bg-green-500/20 rounded-full flex items-center justify-center mb-2">
              <span className="text-green-400">📱</span>
            </div>
            <p className="text-gray-400">Скачайте и делитесь</p>
          </div>
        </div>

        <Button
          asChild
          className="bg-gradient-to-br hover:opacity-90 text-white rounded-full from-[#3352CC] to-[#1C2D70] font-medium cursor-pointer text-base px-8 py-6 h-auto"
        >
          <Link href="/new" className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Создать первое видео
          </Link>
        </Button>
        
        <p className="text-xs text-gray-500 mt-4">
          Создание обычно занимает 2-3 минуты
        </p>
      </div>
    );
  }

  if (variant === 'all-processing') {
    return (
      <div className="text-center py-16">
        <div className="mb-6">
          <div className="w-20 h-20 mx-auto bg-orange-500/20 rounded-full flex items-center justify-center mb-4">
            <Clock className="h-10 w-10 text-orange-400 animate-pulse" />
          </div>
        </div>
        
        <h2 className="text-2xl font-bold text-white mb-4">
          Ваши видео создаются
        </h2>
        
        <p className="text-gray-300 mb-6">
          {processingCount} {processingCount === 1 ? 'видео обрабатывается' : 'видео обрабатываются'}.
          Обычно это занимает 2-3 минуты.
        </p>
        
        <div className="flex justify-center gap-4">
          <Button
            asChild
            variant="outline"
            className="border-gray-600 text-gray-300 hover:bg-gray-800 rounded-full"
          >
            <Link href="/new">
              <Plus className="h-4 w-4 mr-2" />
              Создать еще
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  // Mixed state - some videos exist, some processing
  return (
    <Card className="bg-blue-500/10 border-blue-500/20 mb-6">
      <CardContent className="p-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center">
            <Clock className="h-6 w-6 text-blue-400 animate-pulse" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-white mb-1">
              {processingCount} {processingCount === 1 ? 'видео создается' : 'видео создаются'}
            </h3>
            <p className="text-sm text-gray-400">
              Обычно занимает 2-3 минуты. Мы уведомим вас, когда будет готово.
            </p>
          </div>
          <Button
            asChild
            size="sm"
            className="bg-gradient-to-r from-[#3352CC] to-[#1C2D70] hover:opacity-90 text-white rounded-full"
          >
            <Link href="/new">
              <Plus className="h-4 w-4 mr-1" />
              Создать еще
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

interface VideoStatusBadgeProps {
  status: 'completed' | 'processing' | 'error';
  className?: string;
}

export const VideoStatusBadge = ({ status, className }: VideoStatusBadgeProps) => {
  const configs = {
    completed: {
      icon: CheckCircle,
      text: 'Готово',
      className: 'bg-green-500/20 text-green-400 border-green-500/30'
    },
    processing: {
      icon: Clock,
      text: 'Обработка',
      className: 'bg-orange-500/20 text-orange-400 border-orange-500/30'
    },
    error: {
      icon: AlertCircle,
      text: 'Ошибка',
      className: 'bg-red-500/20 text-red-400 border-red-500/30'
    }
  };

  const config = configs[status];
  const Icon = config.icon;

  return (
    <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full border text-xs font-medium ${config.className} ${className}`}>
      <Icon className={`h-3 w-3 ${status === 'processing' ? 'animate-pulse' : ''}`} />
      {config.text}
    </div>
  );
};

export const VideoGridPlaceholder = () => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
      {[...Array(8)].map((_, index) => (
        <Card key={index} className="bg-gray-800/30 border-gray-700 animate-pulse">
          <div className="aspect-video bg-gray-700 rounded-t-lg"></div>
          <CardContent className="p-4">
            <div className="h-4 bg-gray-700 rounded mb-2"></div>
            <div className="h-3 bg-gray-700 rounded w-2/3"></div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default DashboardEmptyState;