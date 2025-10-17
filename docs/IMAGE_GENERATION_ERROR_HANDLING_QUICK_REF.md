# Image Generation Error Handling - Quick Reference

## 🎯 Что изменилось

### ❌ Раньше (v1.7.0 и ранее)
```
[OpenAI отклоняет 1 из 5 изображений]
      ↓
[Весь процесс падает]
      ↓
[Пользователь НЕ получает видео]
      ↓
[Потрачены кредиты, результата нет]
```

### ✅ Сейчас (v1.7.1+)
```
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

---

## 🔍 Как определить тип ошибки

### 1️⃣ Content Moderation (Безопасная)

**Лог уровня:** `WARN`

**Сигнатура:**
```json
{
  "level": "WARN",
  "message": "Image 1 rejected by safety system, using placeholder",
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

### Код: Обработка одного изображения

```typescript
const imagePromises = video.imagePrompts.map(async (img, index) => {
  try {
    return await processImage(img, modelId);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // 🛡️ Ошибка модерации
    const isSafetyError = 
      errorMessage.includes('safety system') || 
      errorMessage.includes('content policy') ||
      errorMessage.includes('rejected as a result');
    
    if (isSafetyError) {
      logger.warn(`Image ${index + 1} rejected by safety system`);
      return null; // ← Пропускаем
    }
    
    // 💥 Техническая ошибка
    throw error; // ← Прокидываем дальше
  }
});
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
logger.warn(`Image ${index + 1} rejected by safety system, using placeholder`, {
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

- 📖 [CONTENT_MODERATION_HANDLING.md](./CONTENT_MODERATION_HANDLING.md) - Подробная документация
- 🔧 [TROUBLESHOOTING_IMAGE_GENERATION.md](./TROUBLESHOOTING_IMAGE_GENERATION.md) - Руководство по troubleshooting
- 📝 [LOGGING.md](./LOGGING.md) - Политика логирования
- 🔄 [CHANGELOG.md](../CHANGELOG.md) - История изменений (v1.7.1)

---

## ✅ Checklist при возникновении ошибок

- [ ] Проверить лог-файлы за последний час
- [ ] Определить тип ошибки (moderation vs technical)
- [ ] Проверить success rate (должен быть > 80%)
- [ ] Если moderation: проверить промпты на inappropriate content
- [ ] Если technical: проверить API ключи и network
- [ ] Если критично (0%): уведомить команду
- [ ] Документировать паттерн если повторяется

---

*Обновлено: 2025-10-16*  
*Версия: 1.7.1*
