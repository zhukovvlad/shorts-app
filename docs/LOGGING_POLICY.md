# Политика логирования в проекте

## Обзор

В проекте используется централизованная система логирования через модуль `lib/logger.ts`. Прямое использование `console.*` **не допускается** за исключением специальных случаев.

## Правила использования

### ✅ Backend (Server-side code)

**ВСЕГДА используйте `logger`:**

```typescript
import { logger } from '@/lib/logger';

// ✅ Правильно
logger.info('User created', { userId });
logger.error('Failed to process', { error });
logger.warn('Rate limit approaching', { count });
logger.debug('Debug info', { data });

// ❌ Неправильно
console.log('User created', userId);
console.error('Failed to process', error);
```

**Где применять:**
- API routes (`app/api/**/route.ts`)
- Server actions (`app/actions/*.ts`)
- Server libraries (`app/lib/*.ts`, `lib/*.ts`)
- Worker processes (`worker/*.ts`)

### ✅ Frontend (Client-side code)

**Для production НЕ используйте логирование в консоль.** Если необходимо для отладки в development, оборачивайте в проверку окружения:

```typescript
// ✅ Правильно - только в development
if (process.env.NODE_ENV === 'development') {
  // eslint-disable-next-line no-console
  console.log('Debug info:', data);
}

// ❌ Неправильно - будет работать в production
console.log('Debug info:', data);
```

**Где применять:**
- React компоненты (`app/components/*.tsx`)
- Client hooks (`app/hooks/*.ts`)
- Client utilities

**Вместо логирования используйте:**
- Toast уведомления для пользователя (`toast.error`, `toast.success`)
- Отправку ошибок в систему мониторинга (если настроена)

### ✅ Исключения

**Допустимо использование `console` без оберток:**

1. **Сам логгер** (`lib/logger.ts`) - использует `console` для вывода
2. **Скрипты** (`scripts/*.js`) - утилиты для разработки/деплоя
3. **Тесты** (`*.spec.ts`, `*.test.ts`) - отладка тестов

## Преимущества централизованного логирования

### 🎯 Logger vs Console

| Возможность | `logger` | `console` |
|------------|----------|-----------|
| Форматирование | ✅ Структурированное | ❌ Сырой текст |
| Метаданные | ✅ Timestamp, context | ❌ Нет |
| Запись в файлы | ✅ Автоматически | ❌ Нет |
| Уровни логирования | ✅ DEBUG/INFO/WARN/ERROR | ⚠️ Ограниченно |
| Production ready | ✅ Да | ❌ Нет |
| Фильтрация | ✅ По уровням | ❌ Нет |

### 📦 Структурированное логирование

Logger поддерживает структурированные данные:

```typescript
// ✅ Отлично - структурированные данные с контекстом
logger.error('Video processing failed', {
  videoId: '123',
  step: 'render',
  error: error.message,
  retryCount: 3
});

logger.warn('IMAGE_MODELS is empty, using fallback default model', {
  fallbackModel: 'ideogram-v3-turbo',
  fallbackModelName: 'Ideogram V3 Turbo'
});

// ❌ Плохо - неструктурированная строка
console.error(`Video processing failed for ${videoId} at ${step}: ${error}`);
```

### 📝 Ротация логов

Логи автоматически ротируются и сохраняются в `logs/`:
- `server-info-YYYY-MM-DD.log` - серверные логи
- `worker-info-YYYY-MM-DD.log` - worker логи

Старые логи автоматически архивируются скриптами в `scripts/rotate-logs*.sh`.

## Миграция существующего кода

### Шаблоны замены

```typescript
// До
console.error('Error occurred:', error);

// После
import { logger } from '@/lib/logger';
logger.error('Error occurred', { error });
```

```typescript
// До (клиент)
console.log('User action:', data);

// После
if (process.env.NODE_ENV === 'development') {
  // eslint-disable-next-line no-console
  console.log('User action:', data);
}
// Или используйте toast для пользователя
toast.info('Action completed');
```

## ESLint правило

В проекте настроено правило `no-console`, которое предупреждает о прямом использовании `console`. Для обхода в исключительных случаях используйте:

```typescript
// eslint-disable-next-line no-console
console.log('Development debug');
```

## Проверка соответствия

Для поиска всех `console` в проекте:

```bash
# Найти все console вызовы
grep -r "console\." --include="*.ts" --include="*.tsx" app/ lib/ worker/

# Исключая допустимые файлы
grep -r "console\." --include="*.ts" --include="*.tsx" app/ lib/ worker/ \
  --exclude-dir="node_modules" | grep -v "eslint-disable"
```

## История изменений

- **2025-10-05**: Завершена полная миграция на централизованное логирование
  - ✅ Заменены все `console` в backend коде на `logger`
  - ✅ Обернуты все `console` в frontend коде проверкой `NODE_ENV`
  - ✅ Добавлены `eslint-disable-next-line` комментарии
  - ✅ Создана данная документация

## Связанные документы

- [LOGGING.md](./LOGGING.md) - Техническая документация logger
- [CHANGELOG.md](../CHANGELOG.md) - История изменений проекта
