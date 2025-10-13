# Changelog

Все значительные изменения в этом проекте будут документированы в этом файле.

Формат основан на [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
и проект придерживается [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.6.4] - 2025-10-13

### Добавлено
- **Database: Утилита `withRetry` для автоматических повторов Prisma операций**
  - Экспортируется из `app/lib/db.ts` для переиспользования в приложении
  - Автоматически повторяет операции при сетевых ошибках (P1001, P1017)
  - Использует экспоненциальный backoff с jitter для предотвращения перегрузки
  - Настраиваемые параметры: `maxRetries` (по умолчанию 3) и `delayMs` (по умолчанию 1000ms)
  - Type-safe реализация с proper error narrowing через `Prisma.PrismaClientKnownRequestError`
  - Файл: `app/lib/db.ts`, функция `withRetry()`

### Исправлено
- **Worker: Корректное закрытие соединения с PostgreSQL**
  - Добавлено явное закрытие `prisma.$disconnect()` в функции `gracefulShutdown`
  - Добавлен флаг `isShuttingDown` для предотвращения множественных вызовов shutdown
  - Добавлены обработчики `uncaughtException` и `unhandledRejection` для корректного завершения
  - Убран обработчик `beforeExit` из worker, чтобы не конфликтовать с `db.ts`
  - Исправлена ошибка: `prisma:error Error in PostgreSQL connection: Error { kind: Closed, cause: None }`
  - Файл: `worker/worker.ts`

- **Worker: Best-effort закрытие ресурсов при shutdown**
  - Изменена логика `gracefulShutdown` для закрытия всех ресурсов независимо от ошибок
  - Теперь не прерываем shutdown на первой ошибке, а пытаемся закрыть все ресурсы
  - Каждый ресурс (Worker, Redis, Prisma) закрывается в отдельном try-catch
  - Exit code зависит от наличия ошибок: 0 если все успешно, 1 если были ошибки
  - Улучшена диагностика с отдельными сообщениями об ошибках для каждого ресурса
  - Файл: `worker/worker.ts`, функция `gracefulShutdown()`

- **Worker: Улучшено логирование критических ошибок**
  - Добавлен stack trace в логи для `uncaughtException` (message + stack)
  - Добавлен stack trace в логи для `unhandledRejection` с type-safe обработкой
  - Использован `unknown` тип вместо `any` для `unhandledRejection`
  - Улучшена диагностика критических ошибок для быстрого поиска проблем
  - Файл: `worker/worker.ts`, обработчики `uncaughtException` и `unhandledRejection`

- **Worker: Добавлен retry механизм для DB операций**
  - Импортирован `withRetry` из `@/app/lib/db` для обработки transient DB ошибок
  - Обернут `prisma.video.findUnique` в `withRetry` для защиты от P1001/P1017 ошибок
  - Обернут `prisma.video.update` (final failure) в `withRetry`
  - Автоматические повторные попытки при временных проблемах с БД
  - Экспоненциальный backoff предотвращает перегрузку БД
  - Файл: `worker/worker.ts`, DB операции в job handler

- **Database: Graceful shutdown для всех окружений**
  - Убрана проверка `if (process.env.NODE_ENV !== "production")` для обработчика `beforeExit`
  - Теперь `beforeExit` обработчик работает во всех окружениях (dev + production)
  - Добавлена защита от ошибок повторного закрытия соединения
  - `beforeExit` работает как fallback на случай, если явный shutdown не сработал
  - Обработчик игнорирует ошибки повторного закрытия для идемпотентности
  - Добавлен комментарий о том, что `beforeExit` не срабатывает при `process.exit()`
  - Файл: `app/lib/db.ts`, обработчик `beforeExit`

- **Database: Упрощена логика выбора URL подключения**
  - Упрощена цепочка выбора DB URL до простого fallback: `DATABASE_URL || DIRECT_URL`
  - Убрана избыточная логика с разделением на dev/prod (использовались одинаковые переменные)
  - Улучшена читаемость кода без изменения функциональности
  - Файл: `app/lib/db.ts`, константа `resolvedDbUrl`

- **Database: Улучшен механизм retry с type-safety**
  - Добавлен импорт `Prisma` для типобезопасной проверки ошибок
  - Заменен `any` на `unknown` с proper type narrowing через `instanceof`
  - Добавлен экспоненциальный backoff с jitter для предотвращения thundering herd
  - Backoff ограничен максимумом в 30 секунд
  - Добавлен случайный jitter до 250ms для распределения нагрузки
  - В логах теперь указывается конкретный код ошибки Prisma (P1001, P1017)
  - Улучшена обработка `lastError` с fallback на generic error message
  - Файл: `app/lib/db.ts`, функция `withRetry()`

- **Архитектура: Двухуровневая система закрытия соединений**
  - Приоритет 1: Явное закрытие в Worker через `gracefulShutdown` (SIGINT/SIGTERM/uncaught)
  - Приоритет 2: Автоматическое закрытие через `beforeExit` в `db.ts` (fallback)
  - Предотвращены конфликты между обработчиками в worker.ts и db.ts
  - Гарантировано корректное закрытие БД соединений в любом сценарии завершения
  - Документация: `docs/WORKER_DB_CONNECTION_FIX.md`

## [1.6.3] - 2025-10-13

### Исправлено
- **Code Review: Stripe line_items expansion**
  - Обновлен `stripe.checkout.sessions.retrieve` для полного раскрытия line_items
  - Параметр `expand` теперь включает `['line_items', 'line_items.data.price']`
  - Гарантирует получение полного списка элементов с раскрытой информацией о ценах
  - Файл: `app/api/stripe/add-credits/route.ts` (строка 39)

- **Code Review: PrismaClientKnownRequestError constructor**
  - Добавлена helper-функция `createPrismaError()` для DRY принципа
  - Заменены все 8 вхождений конструктора на вызовы helper-функции
  - Версия клиента теперь импортируется динамически из `@prisma/client/package.json`
  - Автоматически синхронизируется с установленной версией Prisma
  - Предотвращает несоответствие версий при обновлении Prisma
  - Упрощена поддержка при обновлении Prisma
  - Файл: `lib/creditSystem.race.spec.ts` (строки 8-10, 13-25, и 8 использований)

- **Code Review: Улучшенная обработка JSON в add-credits endpoint**
  - Добавлен try-catch для обработки невалидного JSON body
  - Невалидный JSON теперь возвращает 400 вместо 500
  - Добавлена проверка типа `sessionId` (должен быть непустой string)
  - Улучшена валидация с проверкой `trim()` для whitespace
  - `sessionId` теперь trim'ится после валидации перед использованием
  - Предотвращены проблемы с whitespace-padded session IDs в downstream операциях
  - Файл: `app/api/stripe/add-credits/route.ts` (строки 25-35, 78, 107)

- **Code Review: Устранение variable shadowing**
  - Переименована внутренняя переменная `user` в `updatedUser` внутри транзакции
  - Устранено затенение переменной (shadowing) для улучшения читаемости
  - Нет путаницы между внешней переменной `user` и результатом транзакции
  - Файл: `app/api/stripe/add-credits/route.ts` (строки 86-108)

- **Code Review: Исправлена пунктуация в error message**
  - Убрано лишнее двоеточие в сообщении об ошибке протокола
  - Было: `Invalid protocol: ${protocol}:. Only http...`
  - Стало: `Invalid protocol: ${protocol}. Only http...`
  - Улучшена читаемость и ясность сообщения об ошибке
  - Файл: `app/api/stripe/checkout/route.ts` (строка 37)

- **Code Review: Markdownlint MD040 compliance**
  - Добавлен язык `text` к fenced code block без языковой аннотации
  - Теперь соответствует правилу markdownlint MD040
  - Улучшена правильность markdown разметки
  - Файл: `CHANGELOG.md` (строка 322)

- **Code Review: Изоляция env мутаций в тестах**
  - Добавлено сохранение и восстановление `process.env` в тестах checkout
  - `ORIGINAL_ENV` сохраняется перед всеми тестами
  - `beforeEach` создает чистую копию env для каждого теста
  - `afterEach` восстанавливает оригинальный env
  - Добавлен `jest.resetModules()` для полной изоляции
  - Предотвращается "утечка" env мутаций между тестами
  - Удалено избыточное локальное сохранение env в тесте production mode
  - Упрощен код благодаря глобальным хукам beforeEach/afterEach
  - Все 33 теста проходят успешно
  - Файл: `app/api/stripe/checkout/route.spec.ts` (строки 31-50, 284-302)

## [1.6.2] - 2025-10-13

### Исправлено
- **Code Review: Type-safe Prisma error narrowing**
  - Заменен duck-typing `error.code` на type-safe `instanceof Prisma.PrismaClientKnownRequestError`
  - Добавлен import `Prisma` из `@prisma/client` в webhook и add-credits routes
  - Изменен тип catch параметра с `any` на `unknown` для лучшей type safety
  - Добавлена переменная `isKnownError` для cleaner error checking
  - Улучшена поддержка TypeScript и IDE autocomplete
  - Файлы: `app/api/stripe/webhook/route.ts`, `app/api/stripe/add-credits/route.ts`

- **Code Review: Markdown code blocks language annotations (MD040)**
  - Добавлены языковые аннотации ко всем fenced code blocks в документации
  - ASCII flow диаграммы помечены как ` ```text` для корректного syntax highlighting
  - Удовлетворяет требованиям markdownlint MD040 rule
  - Улучшена standards-compliance и поддержка IDE/редакторов
  - Файл: `docs/STRIPE_PAYMENT_FLOW.md` (5 flow диаграмм)

- **Code Review: Security hardening - verify price from line_items**
  - Добавлена проверка `priceId` из server-trusted `line_items` вместо только metadata
  - Stripe checkout session теперь получается с `expand: ['line_items.data.price']`
  - `priceId` берется из `line_items[0].price.id` с fallback на metadata
  - Защита от потенциального tampering metadata
  - Defense-in-depth подход для production security
  - Файл: `app/api/stripe/add-credits/route.ts` (строки 31-52)

- **Code Review: Real concurrency tests для race conditions**
  - Заменены "documentation tests" (8 placeholder тестов с `expect(true).toBe(true)`) на real executable tests
  - Реализованы proper Prisma mocks для симуляции concurrent requests
  - Тесты симулируют race conditions: Request 1 succeeds, Request 2 gets P2002
  - Добавлены тесты для concurrent webhook processing и idempotency window
  - Проверяется корректная обработка P2002, P2025 и re-throwing других ошибок
  - Используются real `Prisma.PrismaClientKnownRequestError` instances
  - Все 8 тестов теперь реально проверяют race condition handling logic
  - Файл: `lib/creditSystem.race.spec.ts` (полная переработка)

- **Code Review: Credit mapping validation documentation**
  - Добавлена comprehensive JSDoc документация для `getCreditsForPriceId`
  - Добавлены `@example` и `@remarks` секции с детальным описанием validation
  - Явно документировано поведение для edge cases: "0", negative, invalid, whitespace
  - Разъяснено: значения "0", "-5", "invalid", "  " fall back to defaultCredits
  - Добавлено объяснение: prevents accidental plan disabling via misconfiguration
  - Добавлен inline комментарий: список всех rejected values
  - Рекомендация: to disable plan, remove from CREDIT_PLANS array
  - Добавлен dedicated test "should reject zero and negative values to prevent misconfiguration"
  - Файлы: `lib/creditMapping.ts` (строки 32-64), `lib/creditMapping.spec.ts` (+1 тест)

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

- **Code Review: Webhook P2025 error handling**
  - Добавлена обработка Prisma P2025 (record not found) в Stripe webhook
  - Предотвращает бесконечные retry от Stripe когда пользователь удален между checkout и webhook
  - Возвращает 200 OK для P2025 ошибок (no-op), логирует событие для мониторинга
  - Сохранена существующая логика для P2002 (duplicate) и других ошибок
  - Файл: `app/api/stripe/webhook/route.ts` (строки 66-76)

- **Code Review: Success page state management**
  - Разделены состояния `alreadyProcessed` и `isPendingWebhook` (были conflated)
  - `alreadyProcessed`: кредиты уже были добавлены ранее (idempotency case)
  - `isPendingWebhook`: кредиты будут добавлены через webhook (fallback case)
  - Состояния взаимоисключающие для корректного отображения UI
  - UI показывает "Credits already added" для `alreadyProcessed`
  - UI показывает "will be added via webhook" для `isPendingWebhook`
  - Файл: `app/success/page.tsx` (строки 47-54, 91-98)

- **Code Review: Success page nitpicks**
  - Заменен `Map<string, boolean>` на `Set<string>` для tracking обработанных sessionId (семантически корректнее, меньше overhead)
  - Добавлена обработка отсутствия `sessionId` в URL параметрах
  - UI показывает "No checkout session found" вместо misleading "Payment successful!" когда sessionId отсутствует
  - Информативное сообщение: "We could not find a Stripe checkout session. If you completed a payment, please open the link from your email or return to the dashboard."
  - Текст "You can continue with your video creation" показывается только при наличии sessionId
  - Файл: `app/success/page.tsx` (строки 16-18, 89-105)

- **Code Review: Race condition в concurrent requests**
  - Добавлена обработка Prisma P2002 ошибки (unique constraint violation) в `add-credits` и `webhook`
  - При конкурентных запросах второй запрос не возвращает 500, а успешно завершается с актуальным балансом
  - Гарантия идемпотентности даже между моментом проверки `existingTransaction` и созданием транзакции
  - Кредиты начисляются строго один раз, даже при race condition

- **Code Review: Success page sessionId tracking и messaging**
  - Изменен guard с простого boolean на Map по sessionId
  - Теперь разные sessionId могут обрабатываться в одной вкладке браузера
  - Улучшен UI messaging при fallback на webhook (честное сообщение вместо вводящего в заблуждение)
  - Различные toast уведомления для успеха, idempotency и fallback на webhook

- **Code Review: Documentation sync with Prisma schema**
  - Обновлена документация `docs/STRIPE_PAYMENT_FLOW.md` для соответствия актуальной Prisma schema
  - Добавлен enum `CreditTransactionType` с значениями CREDIT/DEBIT в документацию
  - Добавлена User relation с `@relation(fields: [userId], references: [id], onDelete: Cascade)`
  - Изменен тип поля `type` с `String` на `CreditTransactionType` в примере модели
  - Добавлен `@@index([userId])` для соответствия реальной схеме
  - Файл: `docs/STRIPE_PAYMENT_FLOW.md` (строки 18-35)

- **Code Review: Documentation P2002 handling clarification**
  - Уточнена документация P2002 error handling в разделе Race Condition
  - Разделено описание поведения webhook и manual API при P2002
  - **Webhook**: возвращает 200 OK немедленно без fetch баланса (Stripe не требует баланс в ответе)
  - **Manual API**: возвращает 200 OK с fetch актуального баланса (UI отображает баланс)
  - Документация теперь точно соответствует реальной реализации кода
  - Файл: `docs/STRIPE_PAYMENT_FLOW.md` (строки 111-128)

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

- **Code Review: Экспорт extractUrlFromValue функции**
  - Вынесена `extractUrlFromValue` на уровень модуля в `app/actions/image.ts`
  - Добавлен named export для использования в тестах и других модулях
  - Удалена mock реализация из теста - теперь используется реальная функция
  - Улучшена переиспользуемость кода и предотвращён дрифт между тестом и реализацией
  - Все 31 тест продолжают проходить с реальной функцией

- **Code Review: Рефакторинг checkout route тестов**
  - Экспортирована функция `getBaseUrl` из `app/api/stripe/checkout/route.ts`
  - Переписаны тесты для использования реального POST handler вместо mock реализации
  - Добавлено мокирование внешних зависимостей (`auth()`, `Stripe.checkout.sessions.create`)
  - Тесты теперь вызывают настоящий POST handler с Request объектами
  - Убрана дублированная константа VALID_PRICE_IDS - используется CREDIT_PLANS (single source of truth)
  - 24 integration теста покрывают: authentication, validation, успешные checkout, error handling, protocol validation
  - Тесты проверяют реальные NextResponse статусы и JSON payloads

- **Code Review: Валидация протокола в base URL**
  - Добавлена функция `ensureProtocol` в `getBaseUrl` для проверки наличия http/https
  - URLs без протокола автоматически получают https (production) или http (development)
  - Предотвращает создание невалидных redirect URLs для Stripe
  - URLs с существующим протоколом сохраняются без изменений
  - Добавлены тесты для production/development env и сохранения существующего протокола

- **Code Review: Улучшение getBaseUrl с валидацией и тестируемостью**
  - Добавлен параметр `env` (defaults to `process.env`) для dependency injection в тестах
  - Добавлена валидация через конструктор `new URL()` для проверки корректности URL
  - Добавлен trim для whitespace в дополнение к trailing slashes
  - Проверка протокола ДО создания URL (fail-fast для ftp://, ssh://, etc.)
  - Только http/https протоколы разрешены (отклонение ftp://, ssh://, file://, и других)
  - Улучшенные error messages: "Invalid protocol: ftp:", "Invalid base URL configuration"
  - **Конфигурация**: Установите переменную окружения `NEXT_PUBLIC_APP_URL` с полным URL включая протокол (например, `https://example.com` для production или `http://localhost:3000` для development). Приложение автоматически добавит протокол если отсутствует, но лучше явно указать для избежания проблем с Stripe redirect URLs.
  - Протокол проверяется ДО создания URL объекта для ранних ошибок
  - Ясные error messages с подсказками для конфигурации (`Please set NEXT_PUBLIC_APP_URL...`)
  - Защита от невалидных протоколов (ftp, ssh и т.д.) - только http/https
  - Добавлено 7 новых тестов: whitespace trimming, protocol validation, error messages
  - Тесты больше не манипулируют `process.env` - используют параметр

- **Code Review: Checkout route security improvements**
  - Добавлена обработка invalid JSON body с возвратом 400 "Invalid JSON body"
  - Предотвращает server crashes при malformed JSON requests
  - Allow-list `validPriceIds` теперь скрыт в production environments
  - В development/test environments `validPriceIds` возвращается для debugging
  - Улучшена безопасность: злоумышленники не могут узнать все допустимые priceIds в production
  - Добавлено 2 новых теста: invalid JSON handling, production env behavior
  - Файл: `app/api/stripe/checkout/route.ts` (строки 87-113)

### Добавлено
- **Integration тесты для Stripe webhook** (`app/api/stripe/webhook/route.spec.ts`)
  - 7 integration тестов для реального POST handler webhook route
  - Мокированы Stripe constructEvent, Prisma transaction и findUnique
  - Покрытие error handling: P2002 (duplicate), P2025 (record not found), unexpected errors
  - Покрытие signature validation: missing signature, invalid signature
  - Тесты проверяют успешную обработку checkout session
  - Проверяется обработка unsupported event types
  - Используются getters для mock функций (cleaner mock management)
  - **Обновлено**: тесты теперь используют real `Prisma.PrismaClientKnownRequestError` instances (type-safe)

- **Unit тесты для creditMapping** (`lib/creditMapping.spec.ts`)
  - **12 comprehensive тестов** (было 11, +1 новый)
  - Покрытие: defaults, null/undefined, unknown priceId, env overrides для всех планов
  - Whitespace trimming, whitespace-only values, invalid values (string, negative, zero)
  - **Новый тест**: "should reject zero and negative values to prevent misconfiguration"
  - Проверяется что "0", "-10", "-1" fall back to defaults (предотвращает accidental plan disabling)
  - Тестируется `getCreditMap()` и `CREDIT_PLANS` структура

- **Real concurrency тесты** (`lib/creditSystem.race.spec.ts`)
  - **8 executable тестов** (было 8 placeholder "documentation tests")
  - Полная переработка: заменены `expect(true).toBe(true)` на real Prisma mocks
  - Симуляция concurrent requests: Request 1 succeeds, Request 2 gets P2002
  - Тесты для add-credits endpoint race condition
  - Тесты для webhook endpoint race condition (duplicate webhooks)
  - Тестирование idempotency window (check-then-create race)
  - Проверка current balance fetching после P2002 в add-credits
  - Проверка 200 OK response на P2002 в webhook (prevents Stripe retry)
  - Проверка re-throwing non-P2002 errors (P2025, generic errors)
  - Validation Prisma error codes (P2002 structure, P2025 structure)
  - Используются real `Prisma.PrismaClientKnownRequestError` instances

- **Общий credit mapping helper** (`lib/creditMapping.ts`)
  - Централизованная конфигурация для всех операций с кредитами
  - Поддержка переопределения через environment variables (`CREDITS_STARTER`, `CREDITS_PRO`, `CREDITS_ENTERPRISE`)
  - Функции `getCreditsForPriceId()` и `getCreditMap()` для единообразной работы с кредитами
  - **Comprehensive JSDoc documentation** с @example и @remarks секциями
  - Документировано поведение для edge cases: "0", negative, invalid, whitespace
  - Inline комментарии с полным списком rejected values

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
  - **Обновлено**: все ASCII flow диаграммы помечены как ` ```text` (markdownlint MD040)

- **Integration тесты для Stripe checkout** (`app/api/stripe/checkout/route.spec.ts`)
  - **33 integration теста** (было 31, +2 новых)
  - Мокированы только внешние зависимости: auth и Stripe API
  - Тесты создают Request объекты и проверяют настоящие NextResponse
  - Покрытие: authentication (3), priceId validation (8), успешные checkout (4), error handling (1), URL normalization (17)
  - **Новые тесты**: invalid JSON body handling, production environment behavior (validPriceIds hidden)
  - URL normalization включает: trailing slashes, whitespace, protocol detection, production/development env, error handling
  - Тесты используют dependency injection через параметр `env` (cleaner isolation)
  - Используется CREDIT_PLANS как single source of truth (нет дублированных констант)
  - Проверяются реальные HTTP статусы, JSON payloads, параметры Stripe API вызовов

#### Итоговая статистика тестов
- **Всего тестов: 101** (было 88 в начале Code Review)
- **Рост покрытия: +13 тестов** за сессию Code Review
  - Checkout route: 33 теста (было 31, +2)
  - Webhook route: 7 тестов (новые)
  - CreditMapping: 12 тестов (было 11, +1)
  - Race conditions: 8 тестов (было 8 placeholders, полностью переработаны)
  - Image extraction: 31 тест (было 31)
  - Logger: 10 тестов (было 10)
- **Test suites: 6 passed**
- **Время выполнения: ~1.2s**
- **Code coverage improvements**: реальные executable tests вместо documentation placeholders

### Изменено
- **Webhook Handler** (`app/api/stripe/webhook/route.ts`)
  - Использует общий credit mapping вместо hardcoded значений
  - Добавлена проверка идемпотентности через `CreditTransaction.stripeSessionId` (предотвращает двойное начисление)
  - Атомарная транзакция: `user.credits` increment + `CreditTransaction` create в одной транзакции
  - Валидация `userId`, `sessionId` и `creditsToAdd` перед обработкой
  - Возвращает 200 OK для невалидных запросов (предотвращает retry loops)
  - Try-catch для обработки P2002 при concurrent webhook processing
  - **Полная идемпотентность**: webhook и add-credits используют одну таблицу `CreditTransaction` для координации
  - **Type-safe error handling**: используется `Prisma.PrismaClientKnownRequestError` вместо duck-typing

- **Manual Credit Handler** (`app/api/stripe/add-credits/route.ts`)
  - Теперь использует общий credit mapping helper
  - Синхронизировано с webhook handler
  - Предотвращает расхождения в суммах кредитов между handlers
  - Try-catch для обработки P2002 при concurrent API calls
  - При P2002 возвращает актуальный баланс пользователя вместо ошибки
  - **Security hardening**: priceId проверяется из server-trusted line_items (с fallback на metadata)
  - Stripe session получается с `expand: ['line_items.data.price']` для defense-in-depth
  - **Type-safe error handling**: используется `Prisma.PrismaClientKnownRequestError`

- **Success Page** (`app/success/page.tsx`)
  - Guard теперь использует Map<sessionId, boolean> вместо простого boolean
  - Разные payment sessions могут обрабатываться в одной вкладке
  - Честные сообщения пользователю о статусе обработки кредитов
  - Отдельный UI state для webhook fallback сценария

- **Stripe Checkout** (`app/api/stripe/checkout/route.ts`)
  - **Улучшенная функция `getBaseUrl`**:
    - Принимает параметр `env` для dependency injection (testability)
    - Trim whitespace в дополнение к trailing slashes
    - Валидация через `new URL()` constructor для проверки корректности
    - Проверка протокола ДО создания URL (fail-fast для ftp://, ssh:// и т.д.)
    - Ясные error messages с подсказками конфигурации
    - URLs без протокола получают https (production) или http (development)
    - Только http/https протоколы разрешены
    - **Требование**: `NEXT_PUBLIC_APP_URL` должен включать протокол `http://` или `https://`, или приложение автоматически добавит его (https для production, http для development). Это предотвращает invalid Stripe redirect URLs.
  - Валидация priceId: type check + allow-list проверка перед Stripe API
  - Использует CREDIT_PLANS для allow-list валидации (single source of truth)
  - Улучшенные error responses с деталями для debugging

- **Stripe Checkout Tests** (`app/api/stripe/checkout/route.spec.ts`)
  - Полная переработка: тесты теперь используют реальную реализацию POST handler
  - Мокированы внешние зависимости: `auth()` и `Stripe.checkout.sessions.create`
  - Тесты создают настоящие Request объекты и проверяют реальные NextResponse
  - Убрана дублированная константа VALID_PRICE_IDS - используется импорт из CREDIT_PLANS
  - **31 integration тест** (было 24): добавлены тесты для whitespace trim, protocol validation, error messages
  - Тесты используют параметр `env` вместо манипуляции `process.env` (cleaner, более изолированные)
  - Покрытие: authentication, validation, успешные checkout, error handling, URL normalization, protocol validation

- **Image Processing** (`app/actions/image.ts`)
```text
  - Функция `extractUrlFromValue` теперь экспортируется на уровне модуля
  - Улучшена переиспользуемость - можно импортировать в тестах и других модулях
  - Удалена локальная копия функции внутри `processImage`
  - Добавлена JSDoc документация для экспортируемой функции
```

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
