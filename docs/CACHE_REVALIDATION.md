# Cache Revalidation Architecture

## Проблема

При создании нового видео оно не отображалось в дашборде до ручного обновления страницы из-за кэширования в Next.js.

### Техническая причина

В дашборде используется `unstable_cache` с тегом `'videos'` и временем кэширования 30 секунд:

```typescript
const getCachedVideos = unstable_cache(
  async (userId: string) => {
    return await prisma.video.findMany({...});
  },
  ['user-videos'],
  {
    revalidate: 30,
    tags: ['videos'],
  }
);
```

После создания видео и редиректа на дашборд, старый кэш все еще актуален.

## Решение

### 1. Инвалидация кэша в Server Actions

В контексте Server Actions можно напрямую использовать `revalidateTag`:

**Места применения:**
- `app/actions/create.ts` - после создания видео
- `app/lib/deleteVideo.ts` - после удаления видео

```typescript
import { revalidateTag } from 'next/cache';

// После изменения данных
await prisma.video.create({...});
revalidateTag('videos');
```

### 2. Инвалидация кэша из воркера

**Проблема:** `revalidateTag` не работает в воркере

Воркер работает как отдельный Node.js процесс, вне контекста Next.js Server Actions. При попытке вызвать `revalidateTag` возникает ошибка:

```
Error: Invariant: static generation store missing in revalidateTag videos
```

**Решение:** API endpoint для инвалидации кэша

#### Шаг 1: API Route Handler

Создан endpoint `app/api/revalidate/route.ts`:

```typescript
import { revalidateTag } from 'next/cache';

export async function POST(request: NextRequest) {
  const { tag, secret } = await request.json();
  
  // Опциональная защита
  if (REVALIDATE_SECRET && secret !== REVALIDATE_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  revalidateTag(tag);
  return NextResponse.json({ revalidated: true });
}
```

#### Шаг 2: Утилита для воркера

Создана функция `lib/revalidate.ts`:

```typescript
export async function revalidateCacheFromWorker(tag: string): Promise<boolean> {
  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
  const secret = process.env.REVALIDATE_SECRET;

  const response = await fetch(`${baseUrl}/api/revalidate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tag, secret }),
  });

  return response.ok;
}
```

#### Шаг 3: Использование в воркере

В `worker/worker.ts`:

```typescript
import { revalidateCacheFromWorker } from '@/lib/revalidate';

// После успешного завершения
await processVideo(videoId, video.userId);
await revalidateCacheFromWorker('videos').catch(err => 
  logger.warn('Cache revalidation failed (non-critical)', { error: err })
);

// После финальной ошибки
if (!shouldRetry) {
  await prisma.video.update({
    where: { videoId },
    data: { processing: false, failed: true }
  });
  await revalidateCacheFromWorker('videos');
}
```

## Архитектура

```
┌─────────────────────────────────────────────────────────────┐
│                     Client Browser                          │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                  Next.js Application                        │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Server Actions (app/actions/create.ts)              │  │
│  │  ✓ Прямой доступ к revalidateTag                     │  │
│  │  revalidateTag('videos') ──────────────────┐         │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                 │           │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  API Route (/api/revalidate)                ◄────────┤  │
│  │  export async function POST(request) {      │        │  │
│  │    revalidateTag(tag);                      │        │  │
│  │  }                                          │        │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                 ▲           │
└─────────────────────────────────────────────────┼───────────┘
                                                  │
                                         HTTP POST request
                                                  │
┌─────────────────────────────────────────────────┼───────────┐
│                  Worker Process (worker.ts)     │           │
│                                                             │
│  await processVideo();                                      │
│  await revalidateCacheFromWorker('videos'); ────────────────┘
│    ↑                                                        │
│    └─ lib/revalidate.ts: HTTP fetch к /api/revalidate      │
└─────────────────────────────────────────────────────────────┘
```

## Безопасность

### Опциональная защита через secret

Добавьте в `.env`:

```bash
REVALIDATE_SECRET=your-random-secret-string
```

API endpoint будет проверять secret перед инвалидацией кэша.

### Почему это безопасно без secret?

1. **Локальный вызов:** В production воркер и Next.js app находятся на одном сервере
2. **Ограниченная функциональность:** Endpoint только инвалидирует кэш, не изменяет данные
3. **Rate limiting:** В production рекомендуется добавить rate limiting на уровне nginx/load balancer

## Переменные окружения

```bash
# Базовый URL приложения (для воркера)
NEXTAUTH_URL=https://your-domain.com

# Опциональный secret для защиты endpoint
REVALIDATE_SECRET=your-random-secret
```

## Преимущества решения

1. ✅ **Немедленное обновление:** Видео появляются в дашборде сразу после создания
2. ✅ **Работает из воркера:** Обход ограничения Next.js static generation store
3. ✅ **Отказоустойчивость:** Ошибка инвалидации кэша не прерывает основной процесс
4. ✅ **Масштабируемость:** Можно использовать для других тегов кэша
5. ✅ **Простота:** Минимальный код, используем стандартные механизмы Next.js

## Альтернативные решения (не использованы)

### 1. Удаление кэширования
❌ Плохо для производительности

### 2. On-demand ISR через webhook
❌ Сложнее, требует внешних сервисов

### 3. WebSocket/Server-Sent Events
❌ Избыточно для данной задачи

### 4. Уменьшение времени кэширования
❌ Не решает проблему полностью, увеличивает нагрузку на БД

## Тестирование

1. Создайте новое видео
2. Сразу после редиректа проверьте дашборд
3. Видео должно отображаться немедленно (в статусе processing)
4. После завершения обработки статус должен обновиться автоматически

## Логирование

Воркер логирует результат инвалидации:

```
[WORKER] DEBUG: Cache revalidated successfully {"tag":"videos"}
[WORKER] WARN: Cache revalidation failed (non-critical) {"error":"..."}
```

Ошибки инвалидации не критичны и не прерывают процесс - в худшем случае пользователь увидит видео через 30 секунд или при ручном обновлении.
