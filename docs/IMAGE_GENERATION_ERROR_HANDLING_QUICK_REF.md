# Image Generation Error Handling - Quick Reference

## 🎯 Что изменилось

### ❌ Раньше (v1.7.0 и ранее)
```text
[OpenAI отклоняет 1 из 5 изображений]
      ↓
[Весь процесс падает]
      ↓
[Пользователь НЕ получает видео]
      ↓
[Потрачены кредиты, результата нет]
```

### ⚠️ v1.7.1 (Graceful Degradation)
```text
[OpenAI отклоняет 1 из 5 изображений]
      ↓
[Пропускаем это изображение с WARN]
      ↓
[Продолжаем с 4 успешными изображениями]
      ↓
[Создаем видео с 4 изображениями]
      ↓
[Пользователь ПОЛУЧАЕТ видео]
```

### ✅ Сейчас (v1.7.2 - Автоматическая санитизация)
```text
[OpenAI отклоняет 1 из 5 изображений]
      ↓
[🤖 Санитизируем промпт через OpenAI (gpt-4o-mini)]
      ↓
[Повторяем генерацию с исправленным промптом]
      ↓
[Успех? → Используем изображение ✅]
      ↓
[Неудача? → Повторяем до 3 раз]
      ↓
[Все 3 попытки неудачны? → Пропускаем]
      ↓
[Создаем видео с успешными изображениями]
      ↓
[Пользователь ПОЛУЧАЕТ видео с БОЛЬШИМ количеством изображений]
```

---

## 🔍 Как определить тип ошибки

### 1️⃣ Content Moderation (Безопасная)

**Лог уровня:** `WARN`

**Сигнатура:**
```json
{
  "level": "WARN",
  "message": "Image 1 rejected by safety system - attempting sanitization",
  "videoId": "...",
  "promptPreview": "...",
  "error": "400 Your request was rejected as a result of our safety system."
}
```

**Действие:** ✅ Ничего. Система сама обработает.

---

### 2️⃣ Technical Error (Требует внимания)

**Лог уровня:** `ERROR`

**Сигнатура:**
```json
{
  "level": "ERROR",
  "message": "Failed to generate image 1",
  "videoId": "...",
  "error": "Failed to fetch image: 500 Internal Server Error"
}
```

**Действие:** 🔧 Проверить логи, API ключи, сеть

---

### 3️⃣ Complete Failure (Критическая)

**Лог уровня:** `ERROR`

**Сигнатура:**
```json
{
  "level": "ERROR",
  "message": "No images could be generated",
  "videoId": "...",
  "totalPrompts": 5
}
```

**Действие:** 🚨 Срочная проверка промптов и API

---

## 📊 Метрики успешности

### Формула
```typescript
const successRate = (count / total) * 100;
const rejectionRate = (rejectedCount / total) * 100;
```

### Интерпретация

| Success Rate | Статус | Действие |
|--------------|--------|----------|
| 100% | 🟢 Идеально | - |
| 90-99% | 🟢 Отлично | Мониторить |
| 80-89% | 🟡 Приемлемо | Проверить промпты |
| 50-79% | 🟠 Плохо | Изменить промпты/модель |
| <50% | 🔴 Критично | Срочное вмешательство |

---

## 🛠️ Примеры обработки

### Код: Обработка одного изображения (v1.7.2 с санитизацией)

```typescript
const imagePromises = video.imagePrompts.map(async (img, index) => {
  try {
    return await processImage(img, modelId);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // 🛡️ Проверка: ошибка модерации (case-insensitive)
    const lower = errorMessage.toLowerCase();
    const isSafetyError = 
      lower.includes('safety system') || 
      lower.includes('content policy') ||
      lower.includes('rejected as a result');
    
    // 💥 Техническая ошибка - прокидываем сразу
    if (!isSafetyError) {
      throw error;
    }
    
    // 🤖 Модерационная ошибка - пытаемся санитизировать и повторить
    logger.warn(`Image ${index + 1} rejected by safety system - attempting sanitization`, {
      videoId,
      promptPreview: img.substring(0, 120),
      error: errorMessage
    });
    
    const maxRetries = 3;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      // 1. Санитизируем промпт через OpenAI
      const sanitized = await sanitizePromptWithOpenAI(img, 1);
      if (!sanitized) {
        logger.warn('Sanitization returned empty', { attempt, videoId, index });
        continue;
      }
      
      try {
        // 2. Пытаемся сгенерировать с санитизированным промптом
        const result = await processImage(sanitized, modelId);
        logger.info(`Sanitization succeeded on attempt ${attempt}`, { videoId, index });
        return result; // ✅ Успех!
      } catch (retryErr) {
        const retryMsg = retryErr instanceof Error ? retryErr.message : String(retryErr);
        const retryLower = retryMsg.toLowerCase();
        const retryIsSafety = 
          retryLower.includes('safety system') || 
          retryLower.includes('content policy') || 
          retryLower.includes('rejected as a result');
        
        logger.warn(`Sanitized prompt attempt ${attempt} failed`, { 
          videoId, 
          attempt, 
          retryError: retryMsg 
        });
        
        // Если техническая ошибка - прокидываем
        if (!retryIsSafety) {
          throw retryErr;
        }
        // Если снова модерация - продолжаем цикл
      }
    }
    
    // ⚠️ Все попытки санитизации не помогли - пропускаем
    logger.warn(`All sanitization retries failed for image ${index + 1}, skipping image`, { 
      videoId, 
      index 
    });
    return null; // ← Пропускаем только после 3 неудачных попыток
  }
});
```

### 🤖 Функция санитизации (v1.7.2)

```typescript
/**
 * Переписывает промпт для соответствия политикам безопасности OpenAI
 * @param originalPrompt - Оригинальный промпт, отклонённый модерацией
 * @param maxRetries - Максимум попыток переписывания (обычно 1, т.к. внешний цикл делает 3 попытки)
 * @returns Санитизированный промпт или null при неудаче
 */
async function sanitizePromptWithOpenAI(
  originalPrompt: string, 
  maxRetries = 1
): Promise<string | null> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const chat = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { 
          role: 'system', 
          content: 'Rewrite image prompts to conform with content safety policies while preserving intent.' 
        },
        { role: 'user', content: originalPrompt }
      ],
      temperature: 0.2,
      max_tokens: 200
    });
    
    const sanitized = chat.choices[0]?.message?.content?.trim();
    if (sanitized) {
      logger.info('Sanitization successful', { attempt, sanitizedPrompt: sanitized });
      return sanitized;
    }
  }
  
  return null;
}
```

### Код: Проверка минимума

```typescript
const imageLinks = imageResults.filter((link): link is string => link !== null);

// ⚠️ Требуем хотя бы 1 успешное изображение
if (imageLinks.length === 0) {
  throw new Error('All images were rejected or failed');
}

// ✅ Сохраняем что получилось
await prisma.video.update({
  where: { videoId },
  data: { 
    imageLinks: imageLinks, 
    thumbnail: imageLinks[0] 
  }
});
```

---

## 📝 Логирование по уровням

### WARN - Ожидаемые проблемы
```typescript
logger.warn(`Image ${index + 1} rejected by safety system - attempting sanitization`, {
  videoId,
  promptPreview: img.substring(0, 100),
  error: errorMessage
});
```

**Когда:** Модерация контента, fallback на default модель

---

### ERROR - Неожиданные проблемы
```typescript
logger.error(`Failed to generate image ${index + 1}`, {
  videoId,
  error: errorMessage
});
```

**Когда:** Технические ошибки, сетевые проблемы

---

### INFO - Результаты
```typescript
logger.info("Generated image links", {
  videoId,
  count: imageLinks.length,           // Успешных
  total: video.imagePrompts.length,   // Всего
  rejectedCount: rejectedCount        // Отклонено
});
```

**Когда:** Итоговая статистика операции

---

## 🔎 Поиск в логах

### Все модерационные отклонения за день
```bash
grep "rejected by safety system" logs/combined-$(date +%Y-%m-%d).log
```

### Статистика генерации изображений
```bash
grep "Generated image links" logs/combined-$(date +%Y-%m-%d).log | \
  jq '{count:.count, total:.total, rejected:.rejectedCount}'
```

### Критические ошибки (все отклонено)
```bash
grep "No images could be generated" logs/error-$(date +%Y-%m-%d).log
```

---

## 🎨 UI Индикация (TODO)

### Будущее улучшение
```typescript
// В метаданных видео
interface VideoMetadata {
  imageStats: {
    total: number;        // 5
    generated: number;    // 4
    rejected: number;     // 1
    warnings: string[];   // ["Image 1 was moderated"]
  }
}
```

### Отображение для пользователя
```tsx
{metadata.imageStats.rejected > 0 && (
  <Alert variant="warning">
    ⚠️ {metadata.imageStats.rejected} из {metadata.imageStats.total} 
    изображений были заменены из-за политики безопасности
  </Alert>
)}
```

---

## 📚 Связанные документы

- 📖 [CONTENT_MODERATION_HANDLING.md](./CONTENT_MODERATION_HANDLING.md) - Подробная документация (v1.7.2)
- 🔧 [TROUBLESHOOTING_IMAGE_GENERATION.md](./TROUBLESHOOTING_IMAGE_GENERATION.md) - Руководство по troubleshooting (v1.7.2)
- 📝 [LOGGING.md](./LOGGING.md) - Политика логирования
- 🔄 [CHANGELOG.md](../CHANGELOG.md) - История изменений (v1.7.2)

---

## ✅ Checklist при возникновении ошибок (v1.7.2)

- [ ] Проверить лог-файлы за последний час
- [ ] Определить тип ошибки (moderation vs technical)
- [ ] Проверить success rate (должен быть > 80%)
- [ ] Если moderation: проверить логи санитизации (`"attempting sanitization"`)
- [ ] Проверить количество успешных санитизаций vs пропущенных изображений
- [ ] Если technical: проверить API ключи и network
- [ ] Если критично (0%): уведомить команду
- [ ] Документировать паттерн если повторяется

---

*Обновлено: 2025-10-17*  
*Версия: 1.7.2 (Автоматическая санитизация промптов)*
