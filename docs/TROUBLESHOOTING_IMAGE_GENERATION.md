# Troubleshooting Guide: Image Generation Errors

Краткое руководство по диагностике и решению проблем с генерацией изображений.

## 🚨 Частые ошибки

### 1. Content Moderation / Safety System

**Ошибка:**
```text
400 Your request was rejected as a result of our safety system.
```

**Причина:** OpenAI (или другой провайдер) отклонил промпт из-за политики безопасности

**Решение (NEW v1.7.2 - Автоматическая санитизация):**
- 🤖 **Автоматически**: Система пытается переписать промпт через OpenAI (до 3 попыток)
- ♻️ **Retry loop**: Каждая попытка санитизации → повторная генерация изображения
- ✅ **Fallback**: Если все 3 попытки неудачны, изображение пропускается
- ⚠️ Проверьте логи: Найдите `Attempting to sanitize prompt` для деталей
- 📊 Метрики: Смотрите `sanitization attempt` в логах

**Процесс обработки:**
```text
1. Ошибка модерации
   ↓
2. Санитизация промпта (gpt-4o-mini)
   ↓
3. Повторная генерация изображения
   ↓
4. Успех? → Готово | Ошибка? → Повтор (макс 3 раза)
   ↓
5. После 3 неудач → Пропуск изображения
```

**Лог-индикаторы:**
```text
[INFO] Attempting to sanitize prompt {"attempt":1, "originalPrompt":"..."}
[INFO] Sanitization successful {"attempt":1, "sanitizedPrompt":"..."}
[INFO] Retry with sanitized prompt succeeded {"attempt":1}
[WARN] All 3 sanitization attempts failed, skipping image
[INFO] Generated image links {"count":4, "total":5, "rejectedCount":1}
```

---

### 2. OpenAI API Key Missing

**Ошибка:**
```text
OPENAI_API_KEY is not configured
```

**Причина:** Отсутствует переменная окружения `OPENAI_API_KEY`

**Решение:**
```bash
# .env.local
OPENAI_API_KEY=sk-...
```

**Как получить ключ:**
1. Перейти на <https://platform.openai.com/api-keys>
2. Создать новый API ключ
3. Добавить в `.env.local`

---

### 3. Rate Limit Exceeded

**Ошибка:**
```text
429 Rate limit exceeded
```

**Причина:** Превышен лимит запросов к API провайдера

**Решение:**
- ⏳ Система автоматически повторит попытку (retry)
- 💳 Проверьте квоты в личном кабинете провайдера
- ⚙️ Настройте rate limiting в коде

**Проверка квот:**
- OpenAI: <https://platform.openai.com/usage>
- Replicate: <https://replicate.com/account/billing>

---

### 4. Network / Timeout Errors

**Ошибка:**
```text
fetch failed
ETIMEDOUT
ECONNRESET
```

**Причина:** Проблемы с сетью или таймаут запроса

**Решение:**
- ✅ Автоматически: Worker повторит попытку (до 3 раз)
- 🔍 Проверьте интернет-соединение
- ⚙️ Увеличьте таймауты если проблема постоянная

**Лог-индикаторы:**
```text
[INFO] Retry attempt {"attemptsMade":1, "maxAttempts":3}
```

---

### 5. S3 Upload Failed

**Ошибка:**
```text
Failed to upload to S3
```

**Причина:** Ошибка при загрузке в S3 bucket

**Решение:**
1. Проверьте AWS credentials:
   ```bash
   # .env.local
   AWS_ACCESS_KEY_ID=...
   AWS_SECRET_ACCESS_KEY=...
   AWS_REGION=us-east-1
   AWS_S3_BUCKET_NAME=your-bucket
   ```

2. Проверьте права доступа к bucket:
   - `PutObject` permission
   - Bucket CORS настройки

---

### 6. Invalid Model ID

**Ошибка:**
```text
Invalid OpenAI model: unknown-model
Model unknown-model not found, using default model
```

**Причина:** Указана несуществующая модель

**Решение:**
- ✅ Автоматически: Система использует модель по умолчанию
- 📋 Проверьте доступные модели в `lib/imageModels.ts`
- 🔧 Обновите UI для показа только валидных моделей

**Доступные модели:**
```typescript
const models = IMAGE_MODELS.map(m => m.id);
// ['dall-e-2', 'dall-e-3', 'dall-e-3-hd', 'flux-schnell', ...]
```

---

### 7. All Images Failed

**Ошибка:**
```text
All images were rejected by safety system or failed to generate
```

**Причина:** Ни одно изображение не было успешно сгенерировано

**Решение:**
1. 🔍 Проверьте промпты в базе данных
2. 📊 Проверьте логи для каждого изображения
3. 🔄 Попробуйте другую модель
4. ✏️ Измените промпты (если все отклонены модерацией)

**Диагностика:**
```sql
SELECT imagePrompts FROM "Video" WHERE videoId = 'xxx';
```

---

## 🔍 Диагностические команды

### Проверка статуса видео

```sql
SELECT 
  videoId, 
  status, 
  imageLinks, 
  array_length(imagePrompts, 1) as total_prompts,
  array_length(imageLinks, 1) as generated_images
FROM "Video" 
WHERE videoId = 'xxx';
```

### Поиск ошибок в логах

```bash
# Ошибки модерации за последний час
grep "safety system" logs/combined-$(date +%Y-%m-%d).log | tail -20

# Все ошибки генерации изображений
grep "Error generating images" logs/error-$(date +%Y-%m-%d).log

# Статистика успешности
grep "Generated image links" logs/combined-$(date +%Y-%m-%d).log | \
  jq -r '.count,.total,.rejectedCount'
```

### Redis метаданные

```bash
redis-cli
> GET video:metadata:xxx
> GET video:checkpoint:xxx
```

---

## 📊 Метрики для мониторинга

### 1. Success Rate
```
success_rate = generated_images / total_prompts
```

**Норма:** > 90%
**Warning:** < 80%
**Critical:** < 50%

### 2. Moderation Rejection Rate
```
rejection_rate = rejectedCount / total_prompts
```

**Норма:** < 5%
**Warning:** > 10%
**Critical:** > 20%

### 3. API Errors
```text
api_error_rate = api_errors / total_requests
```

**Норма:** < 1%
**Warning:** > 5%
**Critical:** > 10%

---

## 🛠️ Быстрые фиксы

### Перезапуск неудачного видео

```typescript
// В browser console или API
await fetch('/api/video/retry', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ videoId: 'xxx' })
});
```

### Ручное добавление изображения

```sql
UPDATE "Video" 
SET 
  imageLinks = array_append(imageLinks, 'https://...'),
  thumbnail = COALESCE(thumbnail, 'https://...')
WHERE videoId = 'xxx';
```

### Очистка застрявших задач

```text
# В Redis
redis-cli
> DEL bull:video-processing:xxx
> DEL video:checkpoint:xxx
```

---

## 📚 Дополнительные ресурсы

- [Content Moderation Handling](./CONTENT_MODERATION_HANDLING.md)
- [OpenAI Integration](./OPENAI_INTEGRATION_SUMMARY.md)
- [Logging Policy](./LOGGING_POLICY.md)
- [Worker DB Connection](./WORKER_DB_CONNECTION_FIX.md)

---

## 🆘 Когда обращаться в поддержку

Обращайтесь если:
1. ❌ Все изображения постоянно отклоняются модерацией
2. ❌ Success rate < 50% более 1 часа
3. ❌ API постоянно возвращает 500 ошибки
4. ❌ S3 загрузка не работает для всех запросов
5. ❌ Worker перестал обрабатывать задачи

**Подготовьте:**
- VideoId проблемного видео
- Логи (последние 50 строк)
- Время возникновения проблемы
- Шаги для воспроизведения
