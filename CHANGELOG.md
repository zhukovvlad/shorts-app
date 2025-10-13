# Changelog

Все значительные изменения в этом проекте будут документированы в этом файле.

Формат основан на [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
и проект придерживается [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.6.2] - 2025-10-13

### Исправлено
- **Code Review: CreditTransaction schema improvements**
  - Добавлена foreign key связь с User model (onDelete: Cascade)
  - Заменен String тип поля `type` на enum `CreditTransactionType` (CREDIT | DEBIT)
  - Улучшена целостность данных и типизация транзакций
  - Обновлены webhook и add-credits endpoints для использования enum значений
  - Схема: `prisma/schema.prisma`, использование: `app/api/stripe/webhook/route.ts`, `app/api/stripe/add-credits/route.ts`

- **Code Review: DashboardEmptyState props**
  - Удален неиспользуемый параметр `totalVideos` из интерфейса `EmptyStateProps`
  - Убран проброс `totalVideos` при вызове компонента в dashboard
  - Улучшена читаемость кода

- **Code Review: Webhook idempotency и credit mapping**
  - Исправлена идемпотентность webhook handler для предотвращения двойного начисления при retry от Stripe
  - Добавлена проверка существующей `CreditTransaction` перед обработкой webhook
  - Реализована атомарная транзакция: increment credits + create CreditTransaction (оба действия или ни одного)
  - Webhook записывает `CreditTransaction` с уникальным `stripeSessionId` для координации с manual add-credits
  - Webhook теперь безопасен при повторных вызовах от Stripe и не конфликтует с manual API

- **Code Review: Race condition в concurrent requests**
  - Добавлена обработка Prisma P2002 ошибки (unique constraint violation) в `add-credits` и `webhook`
  - При конкурентных запросах второй запрос не возвращает 500, а успешно завершается с актуальным балансом
  - Гарантия идемпотентности даже между моментом проверки `existingTransaction` и созданием транзакции
  - Кредиты начисляются строго один раз, даже при race condition

- **Code Review: Success page sessionId tracking и messaging**
  - Изменен guard с простого boolean на Map по sessionId
  - Теперь разные sessionId могут обрабатываться в одной вкладке браузера
  - Улучшен UI messaging при fallback на webhook (честное сообщение вместо вводящего в заблуждение)
  - Добавлен state `isPendingWebhook` для отображения корректного статуса
  - Различные toast уведомления для успеха, idempotency и fallback на webhook

- **Code Review: Prisma version mismatch**
  - Синхронизированы версии `@prisma/client` (^6.16.1) и `prisma` CLI (^6.16.1)
  - Ранее prisma CLI была версии ^6.15.0, что могло привести к несовместимости
  - Перегенерирован Prisma Client с правильной версией

- **Code Review: Логирование ошибок checkpoint**
  - Добавлено логирование деталей ошибки при чтении checkpoint в error handling
  - Теперь при fallback логике сохраняются детали ошибки для debugging
  - Улучшена отладка проблем с Redis/checkpoint системой

- **Code Review: Семантические кавычки в JSX**
  - Заменены HTML entities `&quot;` на семантический тег `<q>` в terms и privacy pages
  - Улучшена семантика HTML для locale-aware отображения кавычек
  - Файлы: `app/terms/page.tsx`, `app/privacy/page.tsx`

- **Code Review: Stripe checkout URL нормализация и валидация**
  - Добавлена нормализация trailing slashes в `getBaseUrl()` для предотвращения двойных слешей
  - Добавлена валидация `priceId` перед созданием Stripe session (type check + allow-list)
  - Защита от неверных price IDs, SQL injection и XSS попыток
  - Fail-fast подход: ошибки валидации возвращаются до вызова Stripe API
  - 23 unit теста для URL нормализации, валидации и security

### Добавлено
- **Общий credit mapping helper** (`lib/creditMapping.ts`)
  - Централизованная конфигурация для всех операций с кредитами
  - Поддержка переопределения через environment variables (`CREDITS_STARTER`, `CREDITS_PRO`, `CREDITS_ENTERPRISE`)
  - Функции `getCreditsForPriceId()` и `getCreditMap()` для единообразной работы с кредитами
  - Полное покрытие unit тестами (8/8 passing)

- **Unit тесты для extractUrlFromValue** (`app/actions/image.spec.ts`)
  - 31 comprehensive тест для критической функции извлечения URL из Replicate outputs
  - Покрытие всех форматов: string, object with url, href, output, nested structures
  - Тесты приоритетов, edge cases, и реальных форматов от моделей (flux-schnell, stable-diffusion, DALL-E, Midjourney)
  - Защита от регрессий при изменении форматов output от моделей

- **Документация Stripe Payment Flow** (`docs/STRIPE_PAYMENT_FLOW.md`)
  - Подробное описание координации между webhook и manual API
  - Диаграммы всех сценариев (webhook first, manual first, race condition)
  - Объяснение механизмов безопасности (idempotency, atomicity, P2002 handling)
  - Troubleshooting guide для отладки проблем с платежами

- **Unit тесты для Stripe checkout** (`app/api/stripe/checkout/route.spec.ts`)
  - 23 теста для getBaseUrl URL нормализации (trailing slashes, env vars, fallbacks)
  - Тесты priceId валидации (type checking, allow-list, SQL injection, XSS защита)
  - Security considerations и error response тесты
  - Документация валидации и security практик через тесты

### Изменено
- **Webhook Handler** (`app/api/stripe/webhook/route.ts`)
  - Использует общий credit mapping вместо hardcoded значений
  - Добавлена проверка идемпотентности через `CreditTransaction.stripeSessionId` (предотвращает двойное начисление)
  - Атомарная транзакция: `user.credits` increment + `CreditTransaction` create в одной транзакции
  - Валидация `userId`, `sessionId` и `creditsToAdd` перед обработкой
  - Возвращает 200 OK для невалидных запросов (предотвращает retry loops)
  - Try-catch для обработки P2002 при concurrent webhook processing
  - **Полная идемпотентность**: webhook и add-credits используют одну таблицу `CreditTransaction` для координации

- **Manual Credit Handler** (`app/api/stripe/add-credits/route.ts`)
  - Теперь использует общий credit mapping helper
  - Синхронизировано с webhook handler
  - Предотвращает расхождения в суммах кредитов между handlers
  - Try-catch для обработки P2002 при concurrent API calls
  - При P2002 возвращает актуальный баланс пользователя вместо ошибки

- **Success Page** (`app/success/page.tsx`)
  - Guard теперь использует Map<sessionId, boolean> вместо простого boolean
  - Разные payment sessions могут обрабатываться в одной вкладке
  - Честные сообщения пользователю о статусе обработки кредитов
  - Отдельный UI state для webhook fallback сценария

- **Stripe Checkout** (`app/api/stripe/checkout/route.ts`)
  - Нормализация URL: trim trailing slashes для предотвращения двойных слешей
  - Валидация priceId: type check + allow-list проверка перед Stripe API
  - Использует CREDIT_PLANS для allow-list валидации (single source of truth)
  - Улучшенные error responses с деталями для debugging

## [1.6.1] - 2025-10-13

### Исправлено
- **Критическая уязвимость в Stripe payments (Race Condition)**
  - Устранена возможность двойного начисления кредитов за один платеж
  - Добавлена модель `CreditTransaction` для отслеживания обработанных платежей
  - Реализована идемпотентность через проверку `stripeSessionId` с уникальным constraint
  - Атомарные транзакции: кредиты и запись транзакции создаются вместе или не создаются вовсе
  - Добавлен audit trail для всех операций начисления кредитов

- **Stripe checkout URL (Production Bug)**
  - Исправлены захардкоженные URL в `/api/stripe/checkout`
  - Теперь используется динамический `NEXT_PUBLIC_APP_URL` из переменных окружения
  - Добавлен fallback на `VERCEL_URL` для Vercel deployments
  - Добавлен `NEXT_PUBLIC_APP_URL` в `.env.local` для разработки

- **Duplicate API calls в React StrictMode**
  - Добавлен `useRef` флаг в `/success` странице для предотвращения повторных вызовов API
  - Защита от двойных вызовов в development mode (StrictMode)
  - Дополнительная защита на клиенте в дополнение к серверной идемпотентности

- **TypeScript и Lint ошибки**
  - Исправлены все compile errors
  - Добавлен `Suspense` для `useSearchParams` в `/success` странице
  - Исправлены экранированные кавычки в JSX (`&quot;`)
  - Устранены предупреждения о неиспользуемых переменных

### Добавлено
- **База данных**
  - Новая модель `CreditTransaction` с индексом по `userId` и уникальным constraint на `stripeSessionId`
  
- **Конфигурация**
  - `NEXT_PUBLIC_APP_URL` переменная окружения для динамических URL

### Изменено
- **API `/api/stripe/add-credits`**
  - Добавлена проверка на существующие транзакции перед начислением кредитов
  - Использование `prisma.$transaction()` для атомарности операций
  - Улучшенные сообщения об ошибках с указанием причины

- **API `/api/stripe/checkout`**
  - Динамические `success_url` и `cancel_url` вместо захардкоженных
  - Функция `getBaseUrl()` с fallback логикой

## [1.6.0] - 2025-10-05

### Добавлено
- **Автоматизированное тестирование**
  - Установлен Jest с TypeScript поддержкой
  - Создан test suite для logger с 10 автоматизированными тестами
  - 84.48% покрытие кода для модуля logger
  - Документация по тестированию в `TESTING.md`
  - Тестовые скрипты в package.json: `test`, `test:watch`, `test:coverage`

- **Bash скрипты ротации логов**
  - Strict mode (`set -euo pipefail`) для раннего обнаружения ошибок
  - Валидация LOG_DIR перед выполнением операций
  - Аудит логирование всех операций удаления файлов
  - Null-delimited обработка имен файлов (поддержка пробелов и newlines)

### Исправлено
- **Логирование**
  - Завершена миграция на централизованный logger (заменен последний `console.error`)
  - Все файлы теперь используют единообразное логирование

- **Code Quality**
  - Исправлена lint ошибка `noSwitchDeclarations` в `app/actions/processes.ts`
  - Case блоки обернуты в фигурные скобки для изоляции переменных

- **Docker**
  - Исправлена проблема "Cannot find package.json" в worker контейнере
  - Добавлены package.json и production dependencies в runner stage
  - Скопированы необходимые директории (worker/, app/, lib/)

- **Скрипты ротации логов**
  - Исправлены race conditions через copy-truncate подход
  - Условное удаление: временные файлы удаляются только после успешного gzip
  - Восстановление данных при ошибке сжатия
  - Корректная обработка файлов с пробелами в именах

### Изменено
- **Docker Compose**
  - Worker команда изменена с `npm run worker` на `npx tsx worker/worker.ts`

- **Скрипты ротации логов**
  - Все операции удаления теперь логируются с метками `DELETING:` и `ERROR deleting`
  - Ошибки записываются в stderr для правильной обработки

### Удалено
- Старые ручные тестовые файлы:
  - `test-logger.ts`
  - `test-separated-loggers.ts`
  - `test-retry-notifications.js`
  - `test-checkpoint-system.js`

### Безопасность
- Добавлена валидация прав доступа к LOG_DIR
- Безопасная обработка любых имен файлов в bash скриптах
- Предотвращение потери данных при ротации логов

---

## [1.5.0] - 2025-10-05

### Добавлено
- **Redis оптимизация и безопасность**
  - Адаптивный polling с замедлением с 1s до 3-8s
  - Батчинг Redis операций через Pipeline
  - Санитизация ошибок (удаление путей, токенов, IP)
  - Документация безопасности в `REDIS_OPTIMIZATION_AND_SECURITY.md`

### Изменено
- Polling интервал увеличен с 1s до 3s (-66% запросов)
- Убрано явное удаление прогресса (полагаемся на TTL)

### Результат
- **-70% экономия Redis запросов** (500K → 150K в месяц)
- Запас до 350K запросов = 2.3× больше видео

---

## [1.4.0] - 2025-10-05

### Добавлено
- **Система уведомлений о ретраях**
  - Toast уведомления для всех критических событий
  - Детальные сообщения об ошибках
  - Информация о номере попытки и оставшихся ретраях

- **Redis Checkpoint система**
  - Сохранение прогресса каждого шага
  - Продолжение с места ошибки при ретрае
  - Экономия ~75% времени при повторных попытках
  - Fallback логика при недоступности Redis

### Исправлено
- Off-by-one ошибка в retry gate
- Исчезновение компонента прогресса при ошибке
- Прогресс теперь корректно начинается с 10%

---

## [1.3.0] - 2025-09

### Добавлено
- **Централизованная навигация**
  - Единый компонент Navigation.tsx
  - Контекстно-зависимые кнопки
  - Адаптивный дизайн

---

## [1.2.0] - 2025-09

### Добавлено
- **useVideoActions Hook**
  - Валидация URL протоколов
  - Улучшенная типизация TypeScript
  - Документация на русском

---

## Формат записей

### Добавлено (Added)
Новые функции и возможности.

### Изменено (Changed)
Изменения существующей функциональности.

### Устарело (Deprecated)
Функции, которые будут удалены в будущих версиях.

### Удалено (Removed)
Удаленные функции.

### Исправлено (Fixed)
Исправленные баги.

### Безопасность (Security)
Улучшения безопасности.

---

**Легенда версий:**
- **Major (X.0.0):** Несовместимые изменения API
- **Minor (0.X.0):** Новая функциональность, обратно совместимая
- **Patch (0.0.X):** Исправления багов, обратно совместимые
