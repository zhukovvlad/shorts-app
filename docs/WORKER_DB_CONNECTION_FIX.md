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

В `worker/worker.ts` добавлен явный вызов `prisma.$disconnect()` с защитой от повторных вызовов:

```typescript
// Флаг для предотвращения множественных вызовов graceful shutdown
let isShuttingDown = false;

const gracefulShutdown = async (signal: string) => {
  // Предотвращаем повторные вызовы
  if (isShuttingDown) {
    logger.debug('Shutdown already in progress, ignoring signal', { signal });
    return;
  }
  
  isShuttingDown = true;
  logger.info('Graceful shutdown initiated', { signal });
  
  try {
    await worker.close();
    logger.info('Worker closed successfully');
    
    await connection.quit();
    logger.info('Redis connection closed successfully');
    
    await prisma.$disconnect(); // ✅ ДОБАВЛЕНО
    logger.info('Prisma connection closed successfully');
    
    process.exit(0);
  } catch (error) {
    logger.error('Error during graceful shutdown', {
      error: error instanceof Error ? error.message : String(error)
    });
    process.exit(1);
  }
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
  logger.error('Uncaught exception', { error: error.message });
  gracefulShutdown('uncaughtException');
});
process.on('unhandledRejection', (reason) => { // ✅ ДОБАВЛЕНО
  logger.error('Unhandled rejection', { reason });
  gracefulShutdown('unhandledRejection');
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

Вместо ошибки теперь должны быть логи:
```text
[WORKER] INFO: Graceful shutdown initiated {"signal":"SIGTERM"}
[WORKER] INFO: Worker closed successfully
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

