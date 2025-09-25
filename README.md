# 🎬 Shorts App

**Приложение для автоматической генерации коротких видео с помощью ИИ**

Современное веб-приложение, которое превращает текстовые промпты в увлекательные короткие видео с автоматической генерацией изображений, озвучки и субтитров.

## ✨ Ключевые возможности

### 🤖 ИИ-генерация видео
- **Автоматическое создание сценариев** из текстовых промптов
- **Генерация изображений** с помощью Replicate AI
- **Синтез речи** через ElevenLabs API
- **Автоматические субтитры** с использованием AssemblyAI
- **Рендеринг видео** на базе Remotion

### 💳 Система кредитов и монетизации
- Интеграция с **Stripe** для обработки платежей
- Система кредитов для ограничения использования
- Различные тарифные планы

### 🔐 Аутентификация и безопасность
- Полная интеграция с **Clerk** для управления пользователями
- Защищенные API маршруты
- Безопасная обработка платежей

### 🎨 Современный UI/UX
- **Tailwind CSS** для стилизации
- **Framer Motion** для анимаций
- **shadcn/ui** компоненты
- **MagicUI** эффекты
- Адаптивный дизайн для всех устройств

## 🛠️ Технологический стек

### Frontend
- **Next.js 15** (App Router)
- **React 19**
- **TypeScript**
- **Tailwind CSS**
- **Framer Motion**
- **shadcn/ui**

### Backend
- **Next.js API Routes**
- **Prisma ORM**
- **PostgreSQL**
- **Redis** (для очередей)
- **BullMQ** (обработка задач)

### ИИ и медиа
- **OpenAI API** (генерация сценариев)
- **Replicate** (генерация изображений)
- **ElevenLabs** (синтез речи)
- **AssemblyAI** (транскрипция)
- **Remotion** (рендеринг видео)

### Инфраструктура
- **AWS S3** (хранение файлов)
- **Stripe** (платежи)
- **Clerk** (аутентификация)

## 🚀 Быстрый старт

### Предварительные требования

```bash
node >= 18.0.0
npm >= 9.0.0
```

### 1. Клонирование и установка

```bash
git clone https://github.com/zhukovvlad/shorts-app.git
cd shorts-app
npm install
```

### 2. Настройка переменных окружения

Создайте файл `.env.local`:

```bash
# База данных
DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..."

# Redis (Upstash)
UPSTASH_REDIS_HOST="..."
UPSTASH_REDIS_PORT="..."
UPSTASH_REDIS_TOKEN="..."

# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="..."
CLERK_SECRET_KEY="..."
NEXT_PUBLIC_CLERK_SIGN_IN_URL="/sign-in"
NEXT_PUBLIC_CLERK_SIGN_UP_URL="/sign-up"

# OpenAI
OPENAI_API_KEY="..."

# Replicate
REPLICATE_API_TOKEN="..."

# ElevenLabs
ELEVENLABS_API_KEY="..."

# AssemblyAI
ASSEMBLYAI_API_KEY="..."

# AWS S3
AWS_ACCESS_KEY_ID="..."
AWS_SECRET_ACCESS_KEY="..."
AWS_REGION="..."
AWS_BUCKET_NAME="..."

# Stripe
STRIPE_SECRET_KEY="..."
STRIPE_WEBHOOK_SECRET="..."
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="..."

# Remotion
REMOTION_AWS_ACCESS_KEY_ID="..."
REMOTION_AWS_SECRET_ACCESS_KEY="..."
REMOTION_AWS_REGION="..."
```

### 3. Настройка базы данных

```bash
npx prisma generate
npx prisma db push
```

### 4. Запуск приложения

```bash
# Запуск веб-приложения
npm run dev

# В отдельном терминале - запуск воркера для обработки видео
npm run worker:dev
```

Откройте [http://localhost:3000](http://localhost:3000) в браузере.

## 📖 Архитектура проекта

### 🗂️ Структура проекта

```
shorts-app/
├── app/                    # Next.js App Router
│   ├── (auth)/            # Аутентификация
│   ├── actions/           # Server Actions
│   ├── api/               # API Routes
│   ├── components/        # React компоненты
│   ├── hooks/             # Custom hooks
│   ├── lib/               # Утилиты и конфигурация
│   ├── remotion/          # Компоненты Remotion
│   └── ...                # Страницы приложения
├── components/            # Переиспользуемые UI компоненты
├── lib/                   # Общие утилиты
├── prisma/                # Схема базы данных
├── public/                # Статические файлы
└── worker/                # Воркер для обработки задач
```

### 🔄 Процесс создания видео

1. **Ввод промпта** пользователем
2. **Генерация сценария** через OpenAI
3. **Создание изображений** с помощью Replicate
4. **Синтез речи** через ElevenLabs
5. **Генерация субтитров** с AssemblyAI
6. **Рендеринг видео** через Remotion
7. **Сохранение в S3** и обновление базы данных

### 📊 Модель данных

```prisma
model User {
  userId    String   @id
  name      String?
  email     String   @unique
  videos    Video[]
  credits   Int      @default(1)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Video {
  videoId      String   @id
  prompt       String
  processing   Boolean
  failed       Boolean? @default(false)
  content      String?
  imagePrompts String[]
  imageLinks   String[]
  audio        String?
  videoUrl     String?
  captions     Json?
  duration     Int?
  thumbnail    String?
  userId       String
  user         User     @relation(fields: [userId], references: [userId])
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}
```

## 🎯 Основные страницы

### 🏠 Главная (`/`)
- Перенаправляет на страницу создания нового видео

### ✨ Создание видео (`/new`)
- Интерфейс ввода промпта
- Показ количества кредитов
- Валидация и создание видео

### 📹 Дашборд (`/dashboard`)
- Список созданных видео
- Статус обработки
- Действия с видео (скачивание, удаление, копирование ссылки)

### 💰 Тарифы (`/pricing`)
- Различные планы подписки
- Интеграция со Stripe

### 🔐 Аутентификация (`/sign-in`, `/sign-up`)
- Формы входа и регистрации через Clerk

## 🔧 Скрипты

```bash
# Разработка
npm run dev              # Запуск в режиме разработки
npm run worker:dev       # Запуск воркера в режиме разработки

# Продакшен
npm run build           # Сборка приложения
npm start              # Запуск продакшен сервера
npm run worker         # Запуск воркера

# Утилиты
npm run lint           # Проверка кода
npm run postinstall    # Генерация Prisma клиента
```

## 🚀 Деплой

### Vercel (рекомендуется)

1. Подключите репозиторий к Vercel
2. Настройте переменные окружения
3. Деплойте приложение

### Воркер

Для обработки видео в продакшене необходимо запустить отдельный сервис:

```bash
npm run worker
```

## 📈 Мониторинг и логи

- Все операции логируются в консоль
- Отслеживание статуса обработки видео
- Система уведомлений об ошибках

## 🤝 Вклад в проект

1. Fork репозитория
2. Создайте ветку для новой функции (`git checkout -b feature/amazing-feature`)
3. Зафиксируйте изменения (`git commit -m 'Add amazing feature'`)
4. Push в ветку (`git push origin feature/amazing-feature`)
5. Откройте Pull Request

## 📄 Лицензия

Этот проект является частным и не имеет открытой лицензии.

## 🔗 Полезные ссылки

- [Next.js Documentation](https://nextjs.org/docs)
- [Remotion Documentation](https://www.remotion.dev/)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Tailwind CSS](https://tailwindcss.com/)

## 📞 Поддержка

При возникновении проблем:
1. Проверьте логи воркера и приложения
2. Убедитесь в правильности всех API ключей
3. Проверьте статус внешних сервисов (OpenAI, Replicate и т.д.)

---

**Сделано с ❤️ для создания удивительных коротких видео**

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
