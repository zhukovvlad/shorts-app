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

```text
Error: Invariant: static generation store missing in revalidateTag videos
```

**Решение:** API endpoint для инвалидации кэша

#### Шаг 1: API Route Handler

Создан endpoint `app/api/revalidate/route.ts`:

```typescript
import { revalidateTag } from 'next/cache';

// Разрешенные теги для инвалидации кэша
const ALLOWED_TAGS = ['videos'] as const;
type AllowedTag = typeof ALLOWED_TAGS[number];

// Type guard для проверки тега в allowlist
const isAllowedTag = (t: string): t is AllowedTag =>
  (ALLOWED_TAGS as readonly string[]).includes(t);

export async function POST(request: NextRequest) {
  // Безопасный парсинг JSON
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  
  let { tag, secret } = body;
  
  const REVALIDATE_SECRET = process.env.REVALIDATE_SECRET;
  
  // Fail-closed: отклоняем запросы если secret не установлен в production
  if (process.env.NODE_ENV === 'production' && !REVALIDATE_SECRET) {
    logger.error('REVALIDATE_SECRET not set in production - endpoint is unprotected!');
    return NextResponse.json(
      { error: 'Endpoint disabled: missing REVALIDATE_SECRET' },
      { status: 503 }
    );
  }
  
  // Опциональная защита
  if (REVALIDATE_SECRET && secret !== REVALIDATE_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  // Проверка типа
  if (!tag || typeof tag !== 'string') {
    return NextResponse.json(
      { error: 'Tag is required and must be a string' },
      { status: 400 }
    );
  }
  
  // Нормализуем тег (убираем пробелы)
  tag = tag.trim();
  
  if (!tag) {
    return NextResponse.json({ error: 'Tag cannot be empty' }, { status: 400 });
  }
  
  // Проверка allowlist (type-safe)
  if (!isAllowedTag(tag)) {
    return NextResponse.json({ error: 'Invalid tag' }, { status: 400 });
  }
  
  revalidateTag(tag);
  return NextResponse.json({ revalidated: true });
}
```

**Защита:**
- Безопасный парсинг JSON (возвращает 400 вместо 500 при ошибке)
- Type-safe проверка allowlist (без `as any`)
- Нормализация тега (trim) перед проверкой
- Fail-closed: endpoint отключен в production если secret не установлен (возвращает 503)
- Опциональная проверка secret в development
- Валидация типа тега
- Allowlist разрешенных тегов (предотвращает злоупотребление)
- Rate limiting должен быть настроен на уровне nginx/load balancer

#### Шаг 2: Утилита для воркера

Создана функция `lib/revalidate.ts`:

```typescript
export async function revalidateCacheFromWorker(
  tag: string,
  maxAttempts: number = 2
): Promise<boolean> {
  // Используем NEXTAUTH_URL с fallback на NEXT_PUBLIC_APP_URL
  const base = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const endpointUrl = new URL('/api/revalidate', base).toString();
  const secret = process.env.REVALIDATE_SECRET;

  const attemptsAllowed = Math.max(1, maxAttempts);

  for (let attempt = 1; attempt <= attemptsAllowed; attempt++) {
    // ... fetch с timeout и retry логикой
    // Jitter добавляется к задержке для предотвращения thundering herd
    // Все задержки проходят через clamp [0, 60000] после добавления jitter
  }
}
```

**Надежность:**
- Timeout 5 секунд (предотвращает зависание)
- Автоматический retry при транзиентных ошибках (до 2 попыток)
- Гарантируется минимум 1 попытка даже если maxAttempts=0
- Корректное построение URL через `new URL()` (избегает проблем с //)
- Экспоненциальная задержка между попытками (1s, 2s) + jitter (до 250ms)
- Jitter предотвращает thundering herd эффект
- **Helper функция `clampDelay()`** гарантирует диапазон [0, 60000]ms во всех путях
- Поддержка заголовка `Retry-After` для 429 Too Many Requests
- Ретраит при серверных ошибках (5xx), rate limiting (429) и Request Timeout (408)
- Не ретраит при клиентских ошибках (400, 401, 403, 404, 405, 410, 422)
- Расширенная проверка сетевых ошибок (ECONNREFUSED, ECONNRESET, EAI_AGAIN, ENOTFOUND, ETIMEDOUT)
- Безопасное построение URL с fallback при ошибке
- Trim secret из env и запроса для предотвращения mismatch

**Retry стратегия по HTTP статусам:**

| Статус | Действие | Причина |
|--------|----------|---------|
| 200-299 | ✅ Успех | Операция выполнена успешно |
| 400 | ❌ Не ретраит | Bad Request - ошибка в запросе |
| 401 | ❌ Не ретраит | Unauthorized - неправильный secret |
| 403 | ❌ Не ретраит | Forbidden - доступ запрещен |
| 404 | ❌ Не ретраит | Not Found - endpoint не существует |
| 405 | ❌ Не ретраит | Method Not Allowed - неправильный HTTP метод |
| 408 | 🔄 Ретрай | Request Timeout - таймаут запроса на сервере |
| 410 | ❌ Не ретраит | Gone - endpoint перманентно удален |
| 422 | ❌ Не ретраит | Unprocessable Entity - невалидные данные |
| 429 | 🔄 Ретрай | Too Many Requests - используем `Retry-After` если есть |
| 500-599 | 🔄 Ретрай | Server Error - транзиентная ошибка сервера |
| Network/Timeout | 🔄 Ретрай | Сетевая ошибка или timeout |

**Логика задержки:**
- **429 с `Retry-After`:** Используем указанное время (максимум 60 секунд)
  - Формат секунд: `Retry-After: 120` → 120 секунд
  - Формат даты: `Retry-After: Wed, 21 Oct 2015 07:28:00 GMT` → вычисляем разницу
  - **Защита от NaN:** Если дата невалидная → fallback на экспоненциальную задержку
  - Clamp [0, 60000]ms до добавления jitter
- **429 без `Retry-After`:** Экспоненциальная задержка (1s, 2s)
- **5xx ошибки:** Экспоненциальная задержка (1s, 2s)
- **Network/Timeout:** Экспоненциальная задержка (1s, 2s)
- **Jitter:** Добавляется 0-250ms к каждой задержке для предотвращения thundering herd
- **Финальный clamp:** Все задержки (включая jitter) проходят через `Math.min(Math.max(0, delay), 60000)` перед использованием

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

```text
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

### ⚠️ ВАЖНО: Production требует REVALIDATE_SECRET

**В production endpoint работает только с установленным `REVALIDATE_SECRET`:**
- ✅ **С secret:** Endpoint доступен и защищен от несанкционированных запросов
- ❌ **Без secret:** Endpoint возвращает 503 Service Unavailable (fail-closed)

**Для development/local среды:**
Можно работать без secret для удобства разработки. Endpoint будет доступен без авторизации.

### Почему fail-closed в production?

1. **Безопасность по умолчанию:** Предотвращает случайное открытие endpoint без защиты
2. **Явная конфигурация:** Оператор должен сознательно установить secret
3. **Защита от злоупотребления:** Без secret любой может инвалидировать кэш приложения

### Дополнительная защита (рекомендуется)

1. **Rate limiting:** Настройте на уровне nginx/load balancer
2. **Network isolation:** Воркер и Next.js app на одном сервере/сети
3. **Trim secret:** Endpoint автоматически убирает пробелы из secret для предотвращения ошибок конфигурации

## Переменные окружения

```bash
# Базовый URL приложения (для воркера)
# Приоритет: NEXTAUTH_URL > NEXT_PUBLIC_APP_URL > localhost
NEXTAUTH_URL=https://your-domain.com
# или
NEXT_PUBLIC_APP_URL=https://your-domain.com

# Опциональный secret для защиты endpoint
# ⚠️ ОБЯЗАТЕЛЕН в production! Endpoint возвращает 503 без него.
# В development можно опустить для удобства разработки
REVALIDATE_SECRET=your-random-secret
```

**Примечание о переменных окружения:**
- `NEXTAUTH_URL` - основная переменная для server-side URL
- `NEXT_PUBLIC_APP_URL` - fallback если NEXTAUTH_URL не установлен
- Воркер использует обе с приоритетом NEXTAUTH_URL

## Преимущества решения

1. ✅ **Немедленное обновление:** Видео появляются в дашборде сразу после создания
2. ✅ **Работает из воркера:** Обход ограничения Next.js static generation store
3. ✅ **Отказоустойчивость:** 
   - Ошибка инвалидации кэша не прерывает основной процесс
   - Автоматические retry при транзиентных ошибках
   - Timeout предотвращает зависание
4. ✅ **Безопасность:**
   - Allowlist разрешенных тегов
   - Опциональная защита через secret
   - Не ретраит при клиентских ошибках
5. ✅ **Масштабируемость:** Можно использовать для других тегов кэша
6. ✅ **Простота:** Минимальный код, используем стандартные механизмы Next.js

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

```text
[WORKER] DEBUG: Cache revalidated successfully {"tag":"videos"}
[WORKER] WARN: Cache revalidation failed (non-critical) {"error":"..."}
```

Ошибки инвалидации не критичны и не прерывают процесс - в худшем случае пользователь увидит видео через 30 секунд или при ручном обновлении.
