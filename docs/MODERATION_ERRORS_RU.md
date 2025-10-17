# 🛡️ Что делать с ошибками модерации контента

## Что это за ошибка?

```
400 Your request was rejected as a result of our safety system.
```

Это **НЕ баг**, это **защита OpenAI** от небезопасного контента.

## ❓ Почему это происходит?

OpenAI анализирует каждый промпт на генерацию изображения и может отклонить запрос, если:
- Промпт содержит насилие, сексуальный контент, hate speech
- Промпт пытается обойти ограничения (prompt injection)
- Промпт содержит имена известных людей (в некоторых случаях)
- Промпт может нарушить авторские права

## ✅ Что делает система СЕЙЧАС (v1.7.2)

### 🤖 Автоматическая санитизация промптов

1. **Обнаруживает модерационную ошибку** → запускает цикл санитизации
2. **Переписывает промпт через OpenAI** → вызов `gpt-4o-mini` для создания безопасной версии
3. **Повторяет генерацию изображения** → пытается с исправленным промптом
4. **Делает до 3 попыток** → каждая попытка: санитизация → повторная генерация
5. **Fallback: пропуск изображения** → только если все 3 попытки неудачны
6. **Создает видео с остальными изображениями** → пользователь получает результат
7. **Логирует детальную статистику** → каждая попытка санитизации документируется

**Минимум:** Если хотя бы **1 из 5** изображений успешно → видео создается ✅

**Улучшение:** Большинство отклонённых промптов теперь **исправляются автоматически** 🎉

## 📊 Пример из логов

### 🆕 Новый сценарий: Успешная санитизация (v1.7.2)

```
[INFO] Attempting to sanitize prompt 
       {"videoId":"xxx","attempt":1,"originalPrompt":"..."}

[INFO] Sanitization successful 
       {"attempt":1,"sanitizedPrompt":"..."}

[INFO] Retry with sanitized prompt succeeded 
       {"videoId":"xxx","attempt":1}

[INFO] Generated image links 
       {"videoId":"xxx","count":5,"total":5,"rejectedCount":0}

[INFO] ✅ Job completed successfully
```

**Результат:** Промпт исправлен автоматически → все 5 изображений сгенерированы ✨

### ✅ Хороший кейс (1 отклонено, 4 успешно)

```
[WARN] Image 2 rejected by safety system, using placeholder 
       {"videoId":"xxx","promptPreview":"...","error":"400 Your request was rejected..."}

[INFO] Generated image links 
       {"videoId":"xxx","count":4,"total":5,"rejectedCount":1}

[INFO] ✅ Job completed successfully
```

**Результат:** Видео создано с 4 изображениями ✨

### ⚠️ Проблемный кейс (3 отклонено, 2 успешно)

```
[WARN] Image 1 rejected by safety system...
[WARN] Image 3 rejected by safety system...
[WARN] Image 5 rejected by safety system...

[INFO] Generated image links 
       {"count":2,"total":5,"rejectedCount":3}
```

**Результат:** Видео создано, но качество может быть ниже (мало изображений)

**Действие:** Проверить промпты, возможно нужно их переформулировать

### 🚨 Критический кейс (все 5 отклонено)

```
[WARN] Image 1 rejected by safety system...
[WARN] Image 2 rejected by safety system...
[WARN] Image 3 rejected by safety system...
[WARN] Image 4 rejected by safety system...
[WARN] Image 5 rejected by safety system...

[ERROR] No images could be generated 
        {"videoId":"xxx","totalPrompts":5}

[ERROR] ❌ Job failed
```

**Результат:** Видео НЕ создано ❌

**Действие:** СРОЧНО проверить промпты и переформулировать их

## 🔍 Как найти проблему

### 1. Найти отклоненные изображения в логах

```bash
grep "rejected by safety system" logs/combined-*.log | tail -20
```

### 2. Посмотреть промпт, который был отклонен

В логе будет поле `promptPreview` - первые 100 символов промпта:

```json
{
  "promptPreview": "Create a dark and violent scene with blood and..."
}
```

### 3. Найти videoId и проверить в базе

```sql
SELECT imagePrompts FROM "Video" WHERE videoId = 'xxx';
```

## 🛠️ Что делать?

### Если 1-2 изображения отклонены (< 40%)

✅ **Ничего** - система сама справилась, видео создано

### Если 3+ изображения отклонены (> 50%)

⚠️ **Проверить промпты:**

1. Посмотрите в БД какие промпты используются
2. Найдите паттерны в отклоненных промптах
3. Переформулируйте генерацию промптов в `app/actions/script.ts`

**Примеры проблемных слов:**
- blood, violence, fight, weapon
- nude, sexy, explicit
- famous people names (в некоторых контекстах)
- political/controversial topics

**Примеры безопасных альтернатив:**
- ❌ "bloody fight scene" → ✅ "action scene with dramatic lighting"
- ❌ "sexy woman" → ✅ "elegant portrait"
- ❌ "violent explosion" → ✅ "dynamic explosion effect"

### Если ВСЕ изображения отклонены (100%)

🚨 **Срочно:**

1. **Проверить тему видео** - возможно пользователь запросил неподходящую тему
2. **Проверить генерацию промптов** - возможно баг в `generateScript`
3. **Временный workaround** - использовать другую модель (Stable Diffusion вместо DALL-E)

## 🎯 Как улучшить промпты

### Принципы безопасных промптов

1. **Описательный, не директивный:**
   - ❌ "Create a fight"
   - ✅ "Two people in an action pose"

2. **Фокус на результате, не процессе:**
   - ❌ "Person being hurt"
   - ✅ "Person with concerned expression"

3. **Художественный контекст:**
   - ❌ "Real photo of violence"
   - ✅ "Cinematic scene in art style"

4. **Абстрактные концепции:**
   - ❌ "Specific celebrity name"
   - ✅ "Professional athlete" или "Famous actor"

### Модификация generateScript

Добавьте в системный промпт для OpenAI:

```typescript
const systemPrompt = `...
ВАЖНО: При создании промптов для изображений:
- Избегайте упоминания насилия, крови, оружия
- Не используйте имена известных людей
- Фокусируйтесь на художественных описаниях
- Используйте позитивные и нейтральные формулировки
...`;
```

## 📊 Мониторинг

### Метрики для отслеживания

Проверяйте каждый день:

```bash
# Сколько отклонений за сегодня
grep "rejected by safety system" logs/combined-$(date +%Y-%m-%d).log | wc -l

# Сколько всего было сгенерировано
grep "Generated image links" logs/combined-$(date +%Y-%m-%d).log | wc -l

# Процент отклонений (должен быть < 5%)
```

**Нормы:**
- 🟢 < 5% отклонений - отлично
- 🟡 5-10% отклонений - следить
- 🟠 10-20% отклонений - нужны изменения
- 🔴 > 20% отклонений - срочно фиксить

## 🚀 Альтернативные решения

### 1. Использовать другую модель

Stable Diffusion XL обычно менее строгая:

```typescript
// В CreateProject.tsx пользователь может выбрать модель
const modelId = 'stable-diffusion-xl'; // вместо 'dall-e-2'
```

### 2. Добавить pre-moderation

Проверить промпт перед отправкой:

```typescript
import { Moderation } from 'openai';

const moderation = await openai.moderations.create({
  input: prompt
});

if (moderation.results[0].flagged) {
  // Модифицировать или пропустить промпт
}
```

### 3. Fallback на generic изображения

Использовать stock photos API как запасной вариант:

```typescript
if (allImagesRejected) {
  imageLinks = await getStockPhotos(theme, count);
}
```

## ❓ FAQ

### Q: Почему промпт был отклонен, хотя он кажется нормальным?

A: OpenAI использует ML-модель для модерации, иногда она может быть излишне осторожной. Попробуйте переформулировать промпт.

### Q: Можно ли отключить модерацию?

A: Нет, это встроенная защита OpenAI. Но можно использовать другие провайдеры (Replicate, Stable Diffusion).

### Q: Будет ли пользователю показано, что изображения заменены?

A: Пока нет, но это в планах (TODO в v1.8.0).

### Q: Теряет ли пользователь кредиты за отклоненные изображения?

A: Нет, кредиты списываются только за успешно созданное видео.

## 📚 Связанные документы

- 📖 [CONTENT_MODERATION_HANDLING.md](./CONTENT_MODERATION_HANDLING.md) - техническая документация
- 🔧 [TROUBLESHOOTING_IMAGE_GENERATION.md](./TROUBLESHOOTING_IMAGE_GENERATION.md) - полное руководство
- 📝 [IMAGE_GENERATION_ERROR_HANDLING_QUICK_REF.md](./IMAGE_GENERATION_ERROR_HANDLING_QUICK_REF.md) - краткая справка

---

**TL;DR:** Если видите "safety system" в логах - это нормально, система сама обработает. Волноваться нужно только если > 20% отклонений.
