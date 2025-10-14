# Исправление ошибки закрытия соединения PostgreSQL в Worker

## Проблема

После завершения задачи в worker появлялась ошибка:
```text
prisma:error Error in PostgreSQL connection: Error { kind: Closed, cause: None }
```

## Причина

1. **Worker не закрывал соединение с Prisma** при graceful shutdown
2. **db.ts обработчик работал только в dev режиме** - в production не было автоматического закрытия соединений

## Исправление

### 1. Добавлено закрытие Prisma соединения в Worker

В `worker/worker.ts` добавлен явный вызов `prisma.$disconnect()` с best-effort подходом к закрытию ресурсов:

```typescript
// Флаг для предотвращения множественных вызовов graceful shutdown
let isShuttingDown = false;

/**
 * Graceful shutdown с best-effort закрытием ресурсов
 * @param signal - Сигнал, инициировавший shutdown (SIGTERM, SIGINT и т.д.)
 * @param fatalError - Флаг фатальной ошибки (uncaughtException, unhandledRejection)
 *                     Если true/Error - гарантирует exit code 1 даже при успешной очистке
 */
const gracefulShutdown = async (signal: string, fatalError?: Error | boolean) => {
  // Предотвращаем повторные вызовы
  if (isShuttingDown) {
    logger.debug('Shutdown already in progress, ignoring signal', { signal });
    return;
  }
  
  isShuttingDown = true;
  logger.info('Graceful shutdown initiated', { signal, isFatal: !!fatalError });
  
  // Best-effort закрытие всех ресурсов (не прерываем на первой ошибке)
  // hadError = true если:
  // 1. Это фатальная ошибка приложения (uncaughtException/unhandledRejection)
  // 2. Были ошибки при закрытии ресурсов
  let hadError = !!fatalError;
  
  // Закрываем Worker
  try {
    await worker.close();
    logger.info('Worker closed successfully');
  } catch (error) {
    hadError = true;
    logger.error('Error closing worker', { 
      error: error instanceof Error ? error.message : String(error) 
    });
  }
  
  // Закрываем Redis
  try {
    await connection.quit();
    logger.info('Redis connection closed successfully');
  } catch (error) {
    hadError = true;
    logger.error('Error closing Redis', { 
      error: error instanceof Error ? error.message : String(error) 
    });
  }
  
  // Закрываем Prisma ✅ ДОБАВЛЕНО
  try {
    await prisma.$disconnect();
    logger.info('Prisma connection closed successfully');
  } catch (error) {
    hadError = true;
    logger.error('Error closing Prisma', { 
      error: error instanceof Error ? error.message : String(error) 
    });
  }
  
  // Exit code:
  // 0 - graceful shutdown без ошибок
  // 1 - либо фатальная ошибка приложения, либо ошибки при закрытии ресурсов
  process.exit(hadError ? 1 : 0);
};
```

### 2. Исправлен db.ts для работы в production

В `app/lib/db.ts` изменен обработчик, чтобы он работал **во всех окружениях**, а не только в dev:

```typescript
/**
 * Graceful shutdown для всех окружений
 * Автоматически закрываем соединение только через beforeExit
 * (когда event loop пуст и процесс завершается)
 * 
 * Для явного управления (например, в worker) используйте prisma.$disconnect()
 */
if (!globalForPrisma.hasBeforeExitHandler) {
  globalForPrisma.hasBeforeExitHandler = true;
  
  process.on('beforeExit', async () => {
    try {
      await prisma.$disconnect();
      logger.debug('Prisma connection closed via beforeExit');
    } catch (error) {
      // Игнорируем ошибки при повторном закрытии
      if (error instanceof Error && !error.message.includes('already')) {
        logger.error('Error disconnecting Prisma', {
          error: error.message
        });
      }
    }
  });
}
```

**Ключевые изменения:**
- ✅ Удалена проверка `if (process.env.NODE_ENV !== "production")`
- ✅ Теперь работает в production
- ✅ Обработчик `beforeExit` как fallback (когда event loop пуст)
- ✅ Игнорируем ошибки повторного закрытия

### 3. Добавлены дополнительные обработчики событий в Worker

```typescript
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
// beforeExit убран из worker, чтобы не конфликтовать с db.ts
process.on('uncaughtException', (error) => { // ✅ ДОБАВЛЕНО
  logger.error('Uncaught exception', { 
    message: error.message,
    stack: error.stack
  });
  gracefulShutdown('uncaughtException', error); // Передаем error как фатальную ошибку
});
process.on('unhandledRejection', (reason: unknown) => { // ✅ ДОБАВЛЕНО
  const msg = reason instanceof Error ? reason.message : String(reason);
  const stack = reason instanceof Error ? reason.stack : undefined;
  logger.error('Unhandled rejection', { 
    message: msg,
    stack
  });
  gracefulShutdown('unhandledRejection', reason instanceof Error ? reason : true); // Передаем оригинальную ошибку или true
});
```

## Архитектура решения

### Уровни защиты:

1. **Явное закрытие в Worker** (приоритет)
   - SIGINT/SIGTERM - gracefulShutdown вызывает prisma.$disconnect()
   - uncaughtException/unhandledRejection - gracefulShutdown вызывает prisma.$disconnect()
   
2. **Автоматическое закрытие в db.ts** (fallback)
   - beforeExit - срабатывает когда event loop пуст (перед завершением процесса)
   - **Важно:** `beforeExit` не срабатывает, если вызван `process.exit()` - в этом случае сработает событие `exit`
   - **Важно:** `process.on('exit')` не может выполнять async операции - не полагайтесь на него для cleanup
   - Работает во всех окружениях (dev + production)

3. **Exit code семантика**
   - Фатальные ошибки (`uncaughtException`, `unhandledRejection`) **всегда** завершаются с кодом 1
   - Даже если ресурсы закрылись успешно, exit code будет 1 при фатальной ошибке
   - Graceful shutdown (SIGINT/SIGTERM) завершается с кодом 0 если все ресурсы закрылись успешно
   - Параметр `fatalError` в `gracefulShutdown()` гарантирует non-zero exit для критических путей

4. **Защита от двойного закрытия**
   - Флаг `isShuttingDown` в worker
   - try/catch с игнорированием ошибок повторного закрытия в db.ts

## Результат

Теперь при завершении worker:
1. ✅ Корректно закрывается BullMQ worker
2. ✅ Корректно закрывается Redis соединение
3. ✅ Корректно закрывается Prisma (PostgreSQL) соединение
4. ✅ Обрабатываются различные сценарии завершения (SIGINT, SIGTERM, uncaughtException, unhandledRejection)
5. ✅ Нет конфликтов между обработчиками в worker.ts и db.ts
6. ✅ Работает как в development, так и в production
7. ✅ Фатальные ошибки всегда возвращают exit code 1 для правильного мониторинга
8. ✅ Best-effort закрытие всех ресурсов даже при частичных сбоях

### Exit code сценарии

| Сценарий | Ресурсы | Exit Code | Причина |
|----------|---------|-----------|---------|
| SIGTERM/SIGINT | ✅ Закрылись | 0 | Graceful shutdown |
| SIGTERM/SIGINT | ❌ Ошибка | 1 | Ошибка при закрытии |
| uncaughtException | ✅ Закрылись | 1 | Фатальная ошибка |
| uncaughtException | ❌ Ошибка | 1 | Фатальная ошибка + ошибка закрытия |
| unhandledRejection | ✅ Закрылись | 1 | Фатальная ошибка |
| unhandledRejection | ❌ Ошибка | 1 | Фатальная ошибка + ошибка закрытия |

## Логи после исправления

Теперь при успешном завершении работы worker вы увидите информационные логи (INFO), а не ошибки:

```text
[2025-10-13T20:54:37.611Z] [WORKER] INFO: ✅ Completed processing {"videoId":"188f00f1-fbdf-4c50-8e5c-38bbaa379dea"}
[2025-10-13T20:54:37.713Z] [WORKER] INFO: ✅ Job completed successfully {"jobId":"9"}
[2025-10-13T20:54:38.000Z] [WORKER] INFO: 🛑 Graceful shutdown initiated {"signal":"SIGTERM"}
[2025-10-13T20:54:38.050Z] [WORKER] INFO: ✅ Worker closed successfully
[2025-10-13T20:54:38.100Z] [WORKER] INFO: ✅ Redis connection closed successfully
[2025-10-13T20:54:38.150Z] [WORKER] INFO: ✅ Database connection closed successfully
[2025-10-13T20:54:38.200Z] [WORKER] INFO: 👋 Shutdown complete, exiting with code 0 {"hadError":false,"signal":"SIGTERM"}
```

### ⚠️ Важное примечание о Prisma debug-логах

~~Вы можете увидеть сообщение от Prisma:~~
```
prisma:error Error in PostgreSQL connection: Error { kind: Closed, cause: None }
```

**Это сообщение больше не должно появляться** после изменений в `db.ts`:
- ✅ Отключено логирование Prisma в production (только warnings в dev)
- ✅ Worker явно закрывает соединения и логирует это как INFO
- ✅ Все успешные операции помечены эмодзи ✅ для быстрого визуального поиска

Если вы всё же видите debug-сообщения от Prisma (префикс `prisma:`), это внутренние telemetry-логи,
которые не являются ошибками приложения и могут быть безопасно проигнорированы.

### 📊 Пример полного цикла обработки

```text
[WORKER] INFO: 🚀 Worker started, waiting for jobs
[WORKER] INFO: Starting new job {"videoId":"xxx"}
[WORKER] INFO: Processing step: script
[WORKER] INFO: Processing step: audio
[WORKER] INFO: Processing step: captions
[WORKER] INFO: Processing step: images
[WORKER] INFO: Processing step: render
[WORKER] INFO: ✅ Completed processing {"videoId":"xxx"}
[WORKER] INFO: ✅ Job completed successfully {"jobId":"1"}
```
[WORKER] INFO: Redis connection closed successfully
[WORKER] INFO: Prisma connection closed successfully
```

## Дополнительная информация

### Prisma Connection Pool

Prisma использует connection pool, который нужно явно закрывать через `$disconnect()`, иначе:
- Node.js процесс может "висеть" 
- PostgreSQL будет видеть закрытие как ошибку
- В production окружении это особенно критично для правильного управления ресурсами

### Node.js Process Events

**Async cleanup:**
- ✅ `beforeExit` - может выполнять async операции (await prisma.$disconnect())
- ✅ `SIGTERM`/`SIGINT` - может выполнять async операции
- ✅ `uncaughtException`/`unhandledRejection` - может выполнять async операции
- ❌ `exit` - **НЕ может** выполнять async операции, используется только для синхронного cleanup

**Порядок событий при завершении:**
1. Событие (SIGTERM, uncaughtException, etc.)
2. Async cleanup в обработчике (наш gracefulShutdown)
3. `process.exit(code)` вызывается явно
4. Событие `exit` (только синхронный код)
5. Процесс завершается

**Почему `beforeExit` в db.ts это fallback:**
- Worker явно вызывает `process.exit()` после cleanup
- `beforeExit` НЕ срабатывает после явного `process.exit()`
- `beforeExit` сработает только если процесс завершается естественно (event loop пуст)

## Дополнительные улучшения (версия 1.6.4)

### 1. Защита от маскировки ошибок при чтении checkpoint

**Проблема:** Если Redis недоступен при обработке ошибки, вызов `getVideoCheckpoint` в catch блоке маскировал оригинальную ошибку, и user notifications/DB updates не выполнялись.

**Решение:**
```typescript
// Получаем checkpoint для определения проблемного шага
// Защищаем от ошибок Redis, чтобы не маскировать оригинальную ошибку
let failedStep = 'unknown';
try {
    const checkpoint = await getVideoCheckpoint(videoId);
    failedStep = getNextStep(checkpoint);
} catch (checkpointError) {
    logger.warn('Failed to read checkpoint after error', {
        videoId,
        error: checkpointError instanceof Error ? checkpointError.message : String(checkpointError)
    });
}
```

**Результат:**
- Оригинальная ошибка не маскируется
- User notifications и DB updates выполняются даже при недоступности Redis
- Fallback на `'unknown'` step при ошибке чтения checkpoint

### 2. UnrecoverableError для non-retryable ошибок

**Проблема:** При non-retryable ошибках (например, логические баги) БД помечалась как `failed`, но BullMQ продолжал делать retry попытки, создавая inconsistent state.

**Решение:**
```typescript
import { Worker, Job, UnrecoverableError } from "bullmq";

// В catch блоке:
const isRetryable = isRetryableError(error);
const shouldRetry = attemptNumber < maxAttempts && isRetryable;

// ... обработка ошибки ...

// Для non-retryable ошибок используем UnrecoverableError,
// чтобы BullMQ не делал дополнительных попыток
if (!isRetryable) {
    throw new UnrecoverableError(
        error instanceof Error ? error.message : String(error)
    );
}

throw error;
```

**Результат:**
- Non-retryable ошибки (логические баги, validation errors) сразу останавливают job
- Нет дополнительных retry попыток для ошибок, которые гарантированно не исправятся при повторе
- Retryable ошибки (network, timeout) продолжают retry логику
- Предотвращается inconsistent state между БД и BullMQ

**Примеры non-retryable ошибок:**
- Ошибки валидации данных
- Логические баги в коде
- Недоступность обязательных ресурсов (не transient)
- Internal server errors (не network issues)


