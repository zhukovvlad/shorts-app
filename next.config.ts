import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Экспериментальные настройки для производительности
  experimental: {
    // Улучшенная производительность
    optimizeCss: true,
    scrollRestoration: true,
  },
  // Оптимизация webpack
  webpack: (config, { isServer }) => {
    // Исключаем большие зависимости из клиентского bundle'а
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
      };
    }
    
    return config;
  },
  // Image configuration for external domains
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: process.env.REMOTION_LAMBDA_S3_HOSTNAME || 'remotionlambda-eunorth1-835ln9mr0e.s3.eu-north-1.amazonaws.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: process.env.SHORTS_S3_HOSTNAME || 'shorts-zhukovvlad.s3.eu-north-1.amazonaws.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'cdn.openai.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'www.w3.org',
        port: '',
        pathname: '/**',
      },
    ],
    // Оптимизированные настройки для S3 изображений
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    // Убираем WebP конвертацию - оставляем исходные форматы
    // formats: ['image/webp'],
    minimumCacheTTL: 3600, // Уменьшаем до 1 часа для лучшей производительности
    // Оставляем оптимизацию, но с более мягкими настройками
    loader: 'default',
  },
};

export default nextConfig;
