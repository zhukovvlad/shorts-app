# Content Moderation Handling

## Проблема

OpenAI (и другие провайдеры AI) имеют системы модерации контента, которые могут отклонить запрос на генерацию изображения, если промпт содержит потенциально небезопасный контент.

### Типичная ошибка

```
400 Your request was rejected as a result of our safety system.
```

### Последствия до исправления

- ❌ Одно отклоненное изображение роняло всё видео
- ❌ Пользователь не получал результат, даже если 4 из 5 изображений были успешны
- ❌ Непонятно из логов, что именно вызвало ошибку

## Решение: Prompt Sanitization + Graceful Degradation (v1.7.2)

### Принцип работы

1. **Изолированная обработка**: Каждое изображение обрабатывается независимо
2. **Определение типа ошибки**: Различаем ошибки модерации от технических ошибок
3. **Автоматическая санитизация** (NEW v1.7.2): При ошибке модерации делаем до 3 попыток переписать промпт через OpenAI, чтобы он соответствовал политике безопасности
4. **Повторная генерация**: Пробуем сгенерировать изображение с очищенным промптом
5. **Graceful fallback**: Если все попытки не помогли - пропускаем изображение с предупреждением
6. **Продолжение работы**: Видео создается с успешными изображениями

### Типы ошибок модерации

```typescript
const isSafetyError = errorMessage.includes('safety system') || 
                     errorMessage.includes('content policy') ||
                     errorMessage.includes('rejected as a result');
```

### Поток санитизации (NEW v1.7.2)

```typescript
// При модерационной ошибке
for (let attempt = 1; attempt <= 3; attempt++) {
  // 1. Вызываем OpenAI для переписывания промпта
  const sanitized = await sanitizePromptWithOpenAI(originalPrompt);
  
  // 2. Пытаемся сгенерировать с очищенным промптом
  const result = await processImage(sanitized, modelId);
  
  // 3. Если успех - возвращаем результат
  if (result) return result;
  
  // 4. Если снова модерация - продолжаем цикл
}

// 5. После 3 неудачных попыток - возвращаем null
return null;
```

### Минимальное требование

Видео создается, если хотя бы **одно** изображение было успешно сгенерировано:

```typescript
if (imageLinks.length === 0) {
  throw new Error('All images were rejected by safety system or failed to generate');
}
```

## Логирование

### Ошибка модерации (WARN)

```typescript
logger.warn(`Image ${index + 1} rejected by safety system, using placeholder`, {
  videoId,
  promptPreview: img.substring(0, 100),
  error: errorMessage
});
```

### Техническая ошибка (ERROR)

```typescript
logger.error(`Failed to generate image ${index + 1}`, {
  videoId,
  error: errorMessage
});
```

### Итоговый результат

```typescript
logger.info("Generated image links", {
  videoId,
  count: imageLinks.length,           // Успешные
  total: video.imagePrompts.length,   // Всего
  rejectedCount: video.imagePrompts.length - imageLinks.length // Отклонено
});
```

## Примеры из логов

### До исправления

```
[ERROR] Error processing image from OpenAI {"error":"400 Your request was rejected..."}
[ERROR] Error generating images {"error":"400 Your request was rejected..."}
[ERROR] Error processing video {"videoId":"...", "error":"400 Your request was rejected..."}
[ERROR] ❌ Job failed {"jobId":"17", "error":"400 Your request was rejected..."}
```

### После исправления

```
[WARN] Image 1 rejected by safety system, using placeholder {"videoId":"...", "promptPreview":"...", "error":"400 Your request was rejected..."}
[INFO] Generated image links {"videoId":"...", "count":4, "total":5, "rejectedCount":1}
[INFO] ✅ Job completed successfully
```

## Будущие улучшения

### 1. Placeholder изображения

Вместо `null` можно генерировать нейтральное изображение:

```typescript
if (isSafetyError) {
  return await generatePlaceholderImage(index);
}
```

### 2. Модификация промпта

Попытка автоматически "смягчить" промпт:

```typescript
if (isSafetyError && retryCount < 1) {
  const sanitizedPrompt = sanitizePrompt(img);
  return await processImage(sanitizedPrompt, modelId);
}
```

### 3. Уведомление пользователя

Показывать в UI, что некоторые изображения были заменены:

```typescript
metadata.warningsCount = rejectedCount;
metadata.warnings = ['Some images were moderated'];
```

### 4. Альтернативный провайдер

Fallback на другую модель/провайдер:

```typescript
if (isSafetyError && model.provider === 'openai') {
  logger.info('Trying alternative provider after OpenAI rejection');
  return await processImage(img, 'stable-diffusion-xl');
}
```

## Мониторинг

### Метрики для отслеживания

1. **Процент отклонений**: `rejectedCount / totalPrompts`
2. **Частые паттерны**: Какие типы промптов отклоняются чаще
3. **Провайдеры**: У какого провайдера больше отклонений

### Alerts

Настроить уведомления, если:
- Более 50% изображений в видео отклонено
- Более 10% всех запросов за день отклонено
- Все изображения в видео отклонены

## Безопасность

### Промпт-инъекция

Система модерации также защищает от попыток обойти ограничения через промпт-инъекции.

### Соответствие политикам

Текущая реализация соответствует:
- OpenAI Usage Policies
- Content Policy Guidelines
- Automated Moderator Systems

## Ссылки

- [OpenAI Content Policy](https://platform.openai.com/docs/guides/moderation)
- [OpenAI Safety Best Practices](https://platform.openai.com/docs/guides/safety-best-practices)
- [Error Handling Guide](https://platform.openai.com/docs/guides/error-codes)
