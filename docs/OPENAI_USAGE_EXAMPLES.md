# Примеры использования OpenAI моделей для генерации изображений

## Быстрый старт

### 1. Настройка окружения

```bash
# Добавьте в .env файл
OPENAI_API_KEY=sk-your-api-key-here
```

### 2. Выбор модели в UI

При создании нового видео на странице `/new`:

1. Найдите выпадающий список "Модель генерации изображений"
2. Выберите одну из OpenAI моделей:
   - **DALL-E 3** - баланс качества и скорости
   - **DALL-E 3 HD** ⭐ PRO - максимальное качество
   - **DALL-E 2** - быстрая генерация

### 3. Создание видео

```
1. Введите промпт: "A futuristic city at sunset"
2. Выберите модель: DALL-E 3
3. Нажмите Enter или кнопку создания
4. Дождитесь генерации видео
```

## Примеры промптов

### Для DALL-E 3 (лучшее понимание текста)

```
✅ ХОРОШО:
"A photorealistic image of a modern smartphone on a wooden desk, 
with soft natural lighting from a window, showing app icons clearly"

"An illustration of quantum computing explained through colorful 
abstract shapes and flowing data streams, professional tech style"

"A cooking scene showing fresh pasta being made, hands kneading dough, 
flour on the marble counter, warm kitchen lighting"
```

```
❌ ИЗБЕГАЙТЕ:
"phone" (слишком простой промпт)
"coding" (недостаточно деталей)
"food" (слишком общий)
```

### Для DALL-E 3 HD (максимальная детализация)

Используйте для:
- Портретов людей
- Архитектурных деталей
- Продуктовой фотографии
- Текстур и материалов

```
✅ Пример:
"A high-resolution portrait of a professional chef in a modern kitchen, 
showing intricate details of the chef's uniform, kitchen equipment in 
the background, warm ambient lighting, cinematic composition"
```

### Для DALL-E 2 (быстрая генерация)

Подходит для:
- Прототипирования
- Простых концептов
- Абстрактных изображений

```
✅ Пример:
"Abstract geometric patterns in blue and purple"
"Simple icon of a lightbulb"
"Minimalist workspace illustration"
```

## Программное использование

### Получение информации о модели

```typescript
import { getModelById, IMAGE_MODELS } from '@/lib/imageModels';

// Получить все OpenAI модели
const openaiModels = IMAGE_MODELS.filter(m => m.provider === 'openai');
console.log(openaiModels);
// [
//   { id: 'dall-e-3', name: 'DALL-E 3', ... },
//   { id: 'dall-e-3-hd', name: 'DALL-E 3 HD', ... },
//   { id: 'dall-e-2', name: 'DALL-E 2', ... }
// ]

// Получить конкретную модель
const dallE3 = getModelById('dall-e-3');
console.log(dallE3?.defaultParams);
// { size: '1024x1792', quality: 'standard', style: 'vivid' }
```

### Создание видео с определенной моделью

```typescript
import { createVideo } from '@/app/actions/create';

// В вашем компоненте
const handleCreate = async () => {
  const videoId = await createVideo({
    prompt: "Your prompt here",
    imageModel: "dall-e-3", // Указываем OpenAI модель
  });
};
```

## Сравнение моделей

### По качеству (от лучшего к худшему)

1. 🥇 **DALL-E 3 HD** - максимальная детализация
2. 🥈 **DALL-E 3** - отличное качество
3. 🥉 **FLUX Pro** - высокое качество (Replicate)
4. **FLUX Dev** - хорошее качество
5. **DALL-E 2** - стандартное качество
6. **FLUX Schnell** - базовое качество

### По скорости (от быстрого к медленному)

1. ⚡ **DALL-E 2** - ~5-10 секунд
2. ⚡ **FLUX Schnell** - ~5-10 секунд
3. 🔄 **DALL-E 3** - ~10-20 секунд
4. 🔄 **FLUX Dev** - ~15-25 секунд
5. 🐌 **DALL-E 3 HD** - ~20-30 секунд
6. 🐌 **FLUX Pro** - ~30-40 секунд

### По стоимости (за изображение)

1. 💰 **FLUX Schnell** - ~$0.003
2. 💰 **DALL-E 2** - ~$0.020
3. 💰💰 **DALL-E 3** - ~$0.080
4. 💰💰💰 **DALL-E 3 HD** - ~$0.120
5. 💰💰💰 **FLUX Pro** - ~$0.055

## Оптимизация промптов для DALL-E

### Структура идеального промпта

```
[Главный объект] + [Стиль] + [Детали] + [Освещение] + [Композиция]
```

**Пример:**
```
A modern smartphone [главный объект]
in photorealistic style [стиль]
with visible app icons and screen details [детали]
with soft natural lighting from the side [освещение]
centered composition on a clean desk [композиция]
```

### Ключевые слова для стиля

- `photorealistic` - реалистичная фотография
- `illustration` - иллюстрация
- `3D render` - 3D визуализация
- `minimalist` - минималистичный стиль
- `cinematic` - кинематографический стиль
- `professional` - профессиональный вид

### Ключевые слова для освещения

- `natural lighting` - естественное освещение
- `soft light` - мягкий свет
- `dramatic lighting` - драматическое освещение
- `golden hour` - золотой час
- `studio lighting` - студийное освещение

## Troubleshooting

### Изображение не соответствует ожиданиям

**Решение:**
1. Сделайте промпт более детальным
2. Добавьте описание стиля и освещения
3. Попробуйте DALL-E 3 HD для лучшего качества

### Генерация слишком медленная

**Решение:**
1. Используйте DALL-E 2 вместо DALL-E 3 HD
2. Или переключитесь на FLUX Schnell
3. Проверьте нагрузку на OpenAI API

### Content Policy Warning

**Причина:** OpenAI блокирует контент, нарушающий их политику

**Решение:**
1. Перефразируйте промпт более нейтрально
2. Избегайте упоминаний известных людей/брендов
3. Используйте общие описания вместо конкретных имён

### Rate Limit Exceeded

**Решение:**
1. Подождите 1 минуту между запросами
2. Проверьте ваш tier на OpenAI platform
3. Рассмотрите upgrade вашего аккаунта

## Best Practices

### DO ✅

- Используйте детальные описания
- Указывайте стиль изображения
- Описывайте освещение и композицию
- Тестируйте промпты с DALL-E 2 сначала (дешевле)
- Используйте DALL-E 3 для финальных версий

### DON'T ❌

- Не используйте слишком короткие промпты
- Не упоминайте конкретных людей по имени
- Не генерируйте контент, нарушающий политику
- Не используйте DALL-E 3 HD для простых тестов
- Не забывайте про rate limits

## Мониторинг использования

### Проверка логов

```bash
# Посмотреть все OpenAI запросы
grep "OpenAI" logs/server-*.log | tail -20

# Найти ошибки
grep "Error processing image from OpenAI" logs/server-error-*.log
```

### Dashboard OpenAI

1. Откройте https://platform.openai.com/usage
2. Выберите период (Today, Week, Month)
3. Проверьте:
   - Количество запросов к Images API
   - Общую стоимость
   - Rate limit usage

## Дополнительные ресурсы

- [OpenAI Image Generation Guide](https://platform.openai.com/docs/guides/images)
- [DALL-E 3 Best Practices](https://help.openai.com/en/articles/8555510-dall-e-3-prompting-guide)
- [Content Policy](https://openai.com/policies/usage-policies)
- [Rate Limits Documentation](https://platform.openai.com/docs/guides/rate-limits)

## Поддержка

Если у вас возникли проблемы:

1. Проверьте документацию в `docs/OPENAI_IMAGE_GENERATION.md`
2. Просмотрите чеклист в `docs/OPENAI_DEPLOYMENT_CHECKLIST.md`
3. Проверьте логи приложения
4. Свяжитесь с поддержкой OpenAI
