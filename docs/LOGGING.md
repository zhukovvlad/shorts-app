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

## Безопасность

✅ Автоматическая редакция PII: `userId`, `email`, `token` → `user***`  
✅ Секреты не логируются  
✅ Структурированный JSON формат

## Формат

```json
[2025-10-05T12:34:56.789Z] [SERVER] INFO: Creating video {"userId":"user***","promptLength":150}
[2025-10-05T12:35:10.456Z] [WORKER] INFO: Job started {"jobId":"123","videoId":"video-abc"}
```
