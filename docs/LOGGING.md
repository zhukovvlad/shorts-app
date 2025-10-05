# Логирование

## Быстрый старт

### Использование

```typescript
// Серверный код (actions, API routes)
import { logger } from '@/lib/logger';
logger.info('Creating video', { userId, promptLength });

// Воркер (worker/worker.ts)
import { workerLogger as logger } from '@/lib/logger';
logger.info('Job started', { jobId, videoId });
```

### Структура логов

```
logs/
├── server-info-2025-10-05.log      # Серверные события
├── server-error-2025-10-05.log     # Ошибки сервера
├── server-combined-2025-10-05.log  # Критичные события
├── worker-info-2025-10-05.log      # Обработка видео
├── worker-error-2025-10-05.log     # Ошибки воркера
└── worker-combined-2025-10-05.log  # Критичные события
```

## Конфигурация

### Production

```bash
# .env.production
LOG_TO_FILE=true
LOG_DIR=/app/logs
NODE_ENV=production
```

### Docker

```yaml
services:
  server:
    volumes:
      - ./logs:/app/logs
    environment:
      - LOG_TO_FILE=true
      
  worker:
    volumes:
      - ./logs:/app/logs
    environment:
      - LOG_TO_FILE=true
```

## Мониторинг

```bash
# Ошибки воркера
tail -f logs/worker-error-*.log

# События сервера
tail -f logs/server-info-*.log

# Все критичные события
tail -f logs/*-combined-*.log
```

## Ротация логов

```bash
# Запускать через cron: 0 2 * * *
./scripts/rotate-logs-separated.sh
```

**Политики хранения:**
- Воркер: архив через 7 дней, удаление через 30 дней
- Сервер: архив через 30 дней, удаление через 90 дней

**Безопасная архивация:**
- Используется copy-truncate подход для избежания race conditions
- Оригинальный лог-файл очищается, но не удаляется (процесс продолжает писать)
- Копия сжимается в фоновом режиме
- Предотвращает коррупцию данных и потерю логов во время ротации

**Надежность скриптов:**
- Strict mode включен (`set -euo pipefail`) для раннего обнаружения ошибок
- Безопасный IFS для предотвращения проблем с word-splitting
- Использование `-print0` и `read -d ''` для корректной обработки файлов с пробелами/newlines
- Все переменные корректно квотированы
- Валидация LOG_DIR перед выполнением операций
- Временное отключение errexit для толерантности к некритичным ошибкам
- Условное удаление: временные файлы удаляются только после успешного gzip
- Восстановление данных при ошибке сжатия

**Аудит и мониторинг:**
- Все удаления файлов явно логируются с путями
- Ошибки удаления перехватываются и записываются в stderr
- Вывод скрипта можно перенаправить в файл для аудита: `./scripts/rotate-logs-separated.sh >> /var/log/rotation.log 2>&1`
- Каждый файл имеет метку `DELETING:` перед удалением
- Ошибки имеют метку `ERROR deleting` с кодом выхода

## Безопасность

✅ Автоматическая редакция PII: `userId`, `email`, `token` → `user***`  
✅ Секреты не логируются  
✅ Структурированный JSON формат

## Тестирование

Логирование покрыто автоматизированными тестами с использованием Jest:

```bash
# Запустить все тесты
npm test

# Запустить тесты в watch режиме
npm run test:watch

# Запустить тесты с coverage
npm run test:coverage
```

**Покрытие кода: 84.48%** (lib/logger.ts)

**Покрытие тестов:**
- ✅ Создание лог-файлов для всех уровней (info, warn, error)
- ✅ Разделение логов по источникам ([SERVER] и [WORKER])
- ✅ Редакция PII данных (userId, email, token)
- ✅ Формат timestamp (ISO 8601)
- ✅ Структура JSON для контекста
- ✅ Множественные записи в один файл
- ✅ Production/Development режимы

Тесты находятся в `lib/logger.spec.ts` и используют изолированную тестовую директорию для логов.

Подробнее о тестировании см. [TESTING.md](../TESTING.md)

## Формат

```json
[2025-10-05T12:34:56.789Z] [SERVER] INFO: Creating video {"userId":"user***","promptLength":150}
[2025-10-05T12:35:10.456Z] [WORKER] INFO: Job started {"jobId":"123","videoId":"video-abc"}
```
