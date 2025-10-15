# Интеграция OpenAI DALL-E для генерации изображений

## Обзор

В систему добавлена поддержка генерации изображений через OpenAI DALL-E, которая работает параллельно с существующими моделями Replicate.

## Доступные модели OpenAI

### 1. DALL-E 3
- **ID модели**: `dall-e-3`
- **Описание**: Передовая модель OpenAI с отличным пониманием текста
- **Параметры**:
  - Размер: 1024x1792 (9:16 aspect ratio)
  - Качество: standard
  - Стиль: vivid
- **Характеристики**:
  - Скорость: medium
  - Качество: ultra
  - Pro модель: ✅

### 2. DALL-E 3 HD
- **ID модели**: `dall-e-3-hd`
- **Описание**: DALL-E 3 с максимальным качеством детализации
- **Параметры**:
  - Размер: 1024x1792 (9:16 aspect ratio)
  - Качество: hd
  - Стиль: vivid
- **Характеристики**:
  - Скорость: slow
  - Качество: ultra
  - Pro модель: ✅

### 3. DALL-E 2
- **ID модели**: `dall-e-2`
- **Описание**: Более быстрая и экономичная модель OpenAI
- **Параметры**:
  - Размер: 512x512 (квадратное изображение)
  - **Автоматическая конвертация**: Изображение автоматически преобразуется в 9:16 с помощью Sharp
- **Характеристики**:
  - Скорость: fast
  - Качество: standard
  - Pro модель: ❌

**Примечание о конвертации:** DALL-E 2 генерирует квадратные изображения 512x512. Система автоматически применяет обработку с помощью Sharp для преобразования в формат 9:16 (1008x1792) с использованием `fit: 'cover'` для сохранения важного контента по центру.

## Конфигурация

### Переменные окружения

Убедитесь, что в вашем `.env` файле установлена переменная:

```env
OPENAI_API_KEY=sk-...
```

**Важно:** API ключ OpenAI требуется **только** при использовании DALL-E моделей. Если вы используете только Replicate модели, ключ не нужен.

### Обработка ошибок

Если `OPENAI_API_KEY` не установлен, а пользователь выбирает OpenAI модель, система выдаст понятную ошибку:

```
OPENAI_API_KEY is not configured. Please add your OpenAI API key to environment variables to use DALL-E models. You can obtain an API key at https://platform.openai.com/api-keys
```

### Архитектура

#### 1. Конфигурация моделей (`lib/imageModels.ts`)
Добавлен новый тип провайдера:
```typescript
export type ImageProvider = 'replicate' | 'openai';
```

Интерфейс `ImageModel` расширен:
```typescript
export interface ImageModel {
  id: string;
  name: string;
  description: string;
  provider: ImageProvider;
  replicateModel?: string; // Для Replicate моделей
  openaiModel?: string;    // Для OpenAI моделей
  defaultParams: Record<string, any>;
  isPro?: boolean;
  speed: 'fast' | 'medium' | 'slow';
  quality: 'standard' | 'high' | 'ultra';
}
```

#### 2. Обработка изображений (`app/actions/image.ts`)

Добавлена новая функция для генерации через OpenAI с **ленивой инициализацией**:
```typescript
const processImageWithOpenAI = async (prompt: string, modelId: string) => {
  // Проверка наличия API ключа перед использованием
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not configured...');
  }
  
  // Ленивая инициализация - клиент создается только при необходимости
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
  
  // Генерация через OpenAI API
  // Загрузка в S3
  // Возвращает URL изображения
}
```

**Преимущества ленивой инициализации:**
- OpenAI клиент создается только когда используется DALL-E модель
- API ключ не требуется для работы с Replicate моделями
- Четкое сообщение об ошибке при отсутствии ключа
- Нет runtime ошибок при запуске без OPENAI_API_KEY

Функция `processImage` теперь маршрутизирует запросы:
```typescript
const processImage = async (img: string, modelId?: string) => {
  const model = modelConfig || getDefaultModel();
  
  // Маршрутизация в зависимости от провайдера
  if (model.provider === 'openai') {
    return await processImageWithOpenAI(img, model.id);
  }
  
  // Для Replicate моделей используем существующую логику
  // ...
}
```

## Использование

### В UI

Модели OpenAI автоматически появляются в выборе моделей на странице создания проекта. Они помечены бейджем "PRO" для DALL-E 3 версий.

### Программно

```typescript
import { getModelById } from '@/lib/imageModels';

// Получить конфигурацию модели
const dallE3 = getModelById('dall-e-3');

// Проверить провайдера
if (dallE3?.provider === 'openai') {
  console.log('Это OpenAI модель');
}
```

## Преимущества DALL-E

1. **Отличное понимание текста**: DALL-E 3 лучше понимает сложные текстовые промпты
2. **Высокое качество**: Генерирует детализированные и реалистичные изображения
3. **Встроенная фильтрация**: OpenAI автоматически фильтрует неприемлемый контент
4. **Разнообразие**: DALL-E 2 предоставляет быстрый и экономичный вариант

## Ограничения

1. ~~**DALL-E 2**: Не поддерживает соотношение сторон 9:16, генерирует только квадратные изображения (512x512)~~ **ИСПРАВЛЕНО**: Автоматическая конвертация в 9:16
2. **Стоимость**: DALL-E 3 HD является самой дорогой опцией
3. **Скорость**: DALL-E 3 HD работает медленнее других моделей

## Автоматическая конвертация в 9:16

### Обработка DALL-E 2

Система автоматически обрабатывает квадратные изображения от DALL-E 2:

1. **Детекция**: Определяет что изображение квадратное (512x512)
2. **Конвертация**: Использует Sharp для изменения размера
3. **Метод**: `fit: 'cover'` - обрезает изображение для заполнения 9:16
4. **Позиционирование**: `position: 'center'` - сохраняет центральный контент
5. **Результат**: 1008x1792 (9:16 aspect ratio)

### Технические детали

```typescript
// Автоматическая конвертация
if (modelConfig.id === 'dall-e-2') {
  buffer = await convertTo9x16(buffer, modelConfig.id);
}

// Функция конвертации
const convertTo9x16 = async (inputBuffer: Buffer, modelId: string) => {
  const targetHeight = 1792;
  const targetWidth = Math.round(targetHeight * (9 / 16)); // 1008px
  
  return await sharp(inputBuffer)
    .resize(targetWidth, targetHeight, {
      fit: 'cover',      // Обрезка для заполнения
      position: 'center', // Центрирование контента
    })
    .png()
    .toBuffer();
};
```

### Логирование конвертации

Все операции конвертации логируются:
```
[INFO] Detected square image output, converting to 9:16
[INFO] Converting image to 9:16 format {
  originalSize: "512x512",
  originalRatio: "1.00",
  targetRatio: "0.56"
}
[INFO] Image successfully converted to 9:16 {
  outputSize: "1008x1792"
}
```

## Тестирование

Запустите тесты для проверки интеграции:

```bash
npm test -- app/actions/image-openai.spec.ts
```

Тесты проверяют:
- Наличие всех OpenAI моделей
- Правильность конфигурации параметров
- Корректность маркировки провайдеров
- Установку флагов качества и скорости

## Миграция

Существующие проекты продолжат использовать модели Replicate по умолчанию. Новые модели OpenAI доступны для выбора в интерфейсе создания проекта.

## Рекомендации

- **Для максимального качества**: используйте DALL-E 3 HD
- **Для баланса скорости/качества**: используйте DALL-E 3
- **Для быстрого прототипирования**: используйте DALL-E 2 (с автоматической конвертацией в 9:16)
- **Для вертикальных видео (9:16)**: все модели теперь поддерживают 9:16 благодаря автоматической конвертации

## Мониторинг

Все операции логируются через `@/lib/logger`:
- Выбор модели
- Статус генерации
- Ошибки API
- Загрузка в S3

Пример логов:
```
[INFO] Generating image with OpenAI: DALL-E 3 (dall-e-3)
[INFO] OpenAI generated image URL: https://...
[INFO] OpenAI image uploaded to S3: {fileName: "...", contentType: "image/png"}
```
