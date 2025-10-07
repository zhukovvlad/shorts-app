# Database Migration Guide - NextAuth Integration

## Обзор

Эта миграция создает структуру базы данных для NextAuth.js с поддержкой OAuth провайдеров.

## Изменения в схеме

### Модель User
- **Основной ключ**: `id` (String, CUID) - используется NextAuth
- **Уникальные поля**: 
  - `email` - для идентификации пользователя
- **Связи**:
  - `accounts[]` - OAuth аккаунты пользователя
  - `sessions[]` - активные сессии
  - `videos[]` - созданные видео
- **Поля для NextAuth**:
  - `name`, `email`, `emailVerified`, `image` - стандартные поля профиля
- **Кастомные поля**:
  - `credits` - баланс кредитов пользователя (по умолчанию 1)
  - `createdAt`, `updatedAt` - временные метки

### Модель Account (NextAuth)
Хранит OAuth аккаунты пользователей:
- Поддерживает множественные провайдеры на одного пользователя
- FK `userId` → `User.id` с CASCADE при удалении
- Уникальный индекс на `(provider, providerAccountId)`

### Модель Session (NextAuth)
Управляет пользовательскими сессиями:
- JWT tokens хранятся в `sessionToken`
- FK `userId` → `User.id` с CASCADE при удалении
- Автоматическая очистка по истечении срока

### Модель Video
Хранит сгенерированные видео:
- FK `userId` → `User.id` (RESTRICT - нельзя удалить пользователя с видео)
- Поддержка метаданных: промпты, изображения, аудио, субтитры

### Модель VerificationToken (NextAuth)
Токены для верификации email:
- Используется для passwordless authentication
- Уникальный индекс на `(identifier, token)`

## Применение миграции

### Шаг 1: Настройка подключения к Timeweb

Добавь в `.env`:

```env
# Timeweb PostgreSQL
DATABASE_URL="postgresql://gen_user:YOUR_PASSWORD@s64c08952f8065169210bf4b.twc1.net:5432/default_db?sslmode=require"
DIRECT_URL="postgresql://gen_user:YOUR_PASSWORD@s64c08952f8065169210bf4b.twc1.net:5432/default_db?sslmode=require"
```

Замени `YOUR_PASSWORD` на реальный пароль из панели Timeweb.

### Шаг 2: Применение миграции

```bash
# Проверка статуса
npx prisma migrate status

# Применение миграции
npx prisma migrate deploy

# Или для dev окружения
npx prisma migrate dev
```

### Шаг 3: Генерация Prisma Client

```bash
npx prisma generate
```

### Шаг 4: Проверка схемы

```bash
npx prisma db pull  # Проверить что БД соответствует схеме
npx prisma validate # Валидация schema.prisma
```

## Важные моменты

### ✅ Что уже исправлено в коде:

1. **app/lib/checkUser.ts** - использует `User.id`
2. **app/lib/checkUserLight.ts** - использует `User.id`
3. **app/lib/userCredits.ts** - запрос по `where: { id }`
4. **app/lib/deleteVideo.ts** - использует `User.id`
5. **app/lib/findPrompt.ts** - работает с `User.id`
6. **app/dashboard/page.tsx** - использует `session.user.id`
7. **app/videos/[videoId]/page.tsx** - использует `session.user.id`
8. **app/actions/create.ts** - все запросы по `id` вместо `userId`
9. **app/api/stripe/checkout/route.ts** - использует `session.user.id`
10. **app/api/video/[videoId]/progress/route.ts** - использует `session.user.id`

### 🔐 Foreign Keys правильно настроены:

- `Account.userId` → `User.id` (CASCADE)
- `Session.userId` → `User.id` (CASCADE)
- `Video.userId` → `User.id` (RESTRICT)

### 📊 Индексы:

- ✅ `User.email` - уникальный индекс для быстрого поиска
- ✅ `Session.sessionToken` - уникальный для быстрой проверки сессий
- ✅ `Account(provider, providerAccountId)` - композитный уникальный индекс
- ✅ `VerificationToken(identifier, token)` - композитный уникальный

## Тестирование

После применения миграции:

```bash
# 1. Запустить сервер
npm run dev

# 2. Попробовать OAuth вход через любой провайдер
# Должен создаться User + Account + Session

# 3. Проверить создание видео
# Должна работать связь Video.userId → User.id

# 4. Проверить удаление пользователя с видео
# Должна сработать защита RESTRICT на Video FK
```

## Rollback (если понадобится)

Если нужно откатить миграцию:

```bash
# Удалить все таблицы
npx prisma migrate reset

# Или вручную в psql
DROP TABLE IF EXISTS "Video" CASCADE;
DROP TABLE IF EXISTS "Session" CASCADE;
DROP TABLE IF EXISTS "Account" CASCADE;
DROP TABLE IF EXISTS "VerificationToken" CASCADE;
DROP TABLE IF EXISTS "User" CASCADE;
```

## Следующие шаги

1. ✅ Применить миграцию на Timeweb БД
2. ✅ Протестировать OAuth вход
3. ✅ Проверить создание видео
4. ✅ Убедиться что credits работают
5. ✅ Настроить backup для production БД

## Troubleshooting

### SSL Connection Error

Если возникает ошибка SSL:

```env
DATABASE_URL="...?sslmode=require&sslaccept=accept_invalid_certs"
```

### Connection Timeout

Проверь что IP сервера добавлен в whitelist Timeweb.

### Migration Conflict

Если есть конфликт с существующими таблицами:

```bash
# Сбросить БД (ВНИМАНИЕ: удалит все данные!)
npx prisma migrate reset

# Или применить baseline
npx prisma migrate resolve --applied 20251007000000_init_nextauth
```
