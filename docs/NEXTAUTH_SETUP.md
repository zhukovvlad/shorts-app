# 🔐 Настройка NextAuth с OAuth провайдерами

Эта инструкция поможет настроить NextAuth с поддержкой Google, GitHub, Яндекс и Mail.ru.

---

## 📋 Содержание

1. [Генерация NEXTAUTH_SECRET](#1-генерация-nextauth_secret)
2. [Настройка Google OAuth](#2-настройка-google-oauth)
3. [Настройка GitHub OAuth](#3-настройка-github-oauth)
4. [Настройка Yandex OAuth](#4-настройка-yandex-oauth)
5. [Настройка Mail.ru OAuth](#5-настройка-mailru-oauth)
6. [Обновление .env файла](#6-обновление-env-файла)
7. [Применение миграции БД](#7-применение-миграции-бд)
8. [Тестирование](#8-тестирование)

---

## 1. Генерация NEXTAUTH_SECRET

NextAuth использует секретный ключ для подписи JWT токенов.

### Команда для генерации:
```bash
openssl rand -base64 32
```

**Результат будет выглядеть так:**
```
jT8xK9mN2pQ4rS6vW8yZ0bC3dE5fG7hI9jK1lM3nO5p=
```

💡 Сохраните этот ключ - он понадобится для `.env` файла.

---

## 2. Настройка Google OAuth

### Шаг 1: Перейдите в Google Cloud Console
🔗 https://console.cloud.google.com/apis/credentials

### Шаг 2: Создайте проект (если еще нет)
1. Нажмите на выпадающий список проектов вверху
2. Нажмите **"New Project"**
3. Назовите проект: `ShortsApp` или любое другое имя
4. Нажмите **"Create"**

### Шаг 3: Настройте OAuth Consent Screen
1. В боковом меню выберите **"OAuth consent screen"**
2. Выберите **"External"** (для тестирования)
3. Заполните обязательные поля:
   - **App name:** ShortsApp
   - **User support email:** ваш email
   - **Developer contact email:** ваш email
4. Нажмите **"Save and Continue"**
5. На странице "Scopes" нажмите **"Save and Continue"** (можно пропустить)
6. На странице "Test users" добавьте свой email для тестирования
7. Нажмите **"Save and Continue"**

### Шаг 4: Создайте OAuth 2.0 Client ID
1. В боковом меню выберите **"Credentials"**
2. Нажмите **"+ CREATE CREDENTIALS"** → **"OAuth client ID"**
3. Выберите **"Web application"**
4. Настройте:
   - **Name:** ShortsApp Web Client
   - **Authorized JavaScript origins:**
     ```
     http://localhost:3000
     https://ваш-домен.com
     ```
   - **Authorized redirect URIs:**
     ```
     http://localhost:3000/api/auth/callback/google
     https://ваш-домен.com/api/auth/callback/google
     ```
5. Нажмите **"Create"**

### Шаг 5: Скопируйте credentials
После создания появится модальное окно с:
- **Client ID:** `123456789-abcdefg.apps.googleusercontent.com`
- **Client Secret:** `GOCSPX-xxxxxxxxxxxxxxxxxxxx`

✅ Сохраните эти значения для `.env` файла.

---

## 3. Настройка GitHub OAuth

### Шаг 1: Перейдите в GitHub Developer Settings
🔗 https://github.com/settings/developers

### Шаг 2: Создайте новое OAuth приложение
1. Нажмите **"New OAuth App"**
2. Заполните форму:
   - **Application name:** ShortsApp
   - **Homepage URL:** `http://localhost:3000`
   - **Application description:** AI Video Generator
   - **Authorization callback URL:** `http://localhost:3000/api/auth/callback/github`
3. Нажмите **"Register application"**

### Шаг 3: Сгенерируйте Client Secret
1. После создания приложения, вы увидите **Client ID**
2. Нажмите **"Generate a new client secret"**
3. Скопируйте **Client Secret** (он показывается только один раз!)

### Шаг 4: Скопируйте credentials
- **Client ID:** `Iv1.a1b2c3d4e5f6g7h8`
- **Client Secret:** `1234567890abcdef1234567890abcdef12345678`

✅ Сохраните эти значения для `.env` файла.

### 📝 Для production:
Повторите процесс и добавьте:
- **Homepage URL:** `https://ваш-домен.com`
- **Authorization callback URL:** `https://ваш-домен.com/api/auth/callback/github`

---

## 4. Настройка Yandex OAuth

### Шаг 1: Перейдите в Яндекс.OAuth
🔗 https://oauth.yandex.ru/

### Шаг 2: Зарегистрируйтесь/войдите
Используйте свой Яндекс аккаунт

### Шаг 3: Создайте новое приложение
1. Нажмите **"Зарегистрировать новое приложение"**
2. Заполните форму:
   - **Название сервиса:** ShortsApp
   - **Платформы:** Выберите **"Веб-сервисы"**
   - **Redirect URI:**
     ```
     http://localhost:3000/api/auth/callback/yandex
     https://ваш-домен.com/api/auth/callback/yandex
     ```
3. **Права доступа** (в разделе Яндекс.Паспорт):
   - ✅ Доступ к email адресу
   - ✅ Доступ к аватару пользователя
   - ✅ Доступ к логину, имени и фамилии

### Шаг 4: Получите credentials
После создания приложения вы увидите:
- **ID приложения (Client ID):** `1234567890abcdef`
- **Пароль приложения (Client Secret):** Нажмите "Показать" для просмотра

✅ Сохраните эти значения для `.env` файла.

### 📌 Примечание:
Яндекс OAuth работает только с HTTPS в production. Для локальной разработки `http://localhost` допустим.

---

## 5. Настройка Mail.ru OAuth

### Шаг 1: Перейдите в Mail.ru OAuth
🔗 https://o2.mail.ru/app/

### Шаг 2: Войдите
Используйте свой Mail.ru аккаунт (или создайте новый)

### Шаг 3: Создайте новое приложение
1. Нажмите **"Создать приложение"**
2. Заполните форму:
   - **Название:** ShortsApp
   - **Описание:** AI генератор коротких видео
   - **Тип:** Выберите **"Web-сайт"**
   - **Redirect URI:**
     ```
     http://localhost:3000/api/auth/callback/mailru
     https://ваш-домен.com/api/auth/callback/mailru
     ```
3. **Права доступа:**
   - ✅ Основная информация о пользователе
   - ✅ Email адрес

### Шаг 4: Получите credentials
После создания приложения:
- **ID приложения (Client ID):** `123456`
- **Секретный ключ (Client Secret):** `abcdef1234567890`

✅ Сохраните эти значения для `.env` файла.

### 📝 Важно:
- Mail.ru OAuth требует подтверждения приложения для production
- Для разработки можно использовать без подтверждения

---

## 6. Обновление .env файла

Создайте или обновите файл `.env` в корне проекта:

```env
# ==================== NextAuth Configuration ====================
# Сгенерируйте: openssl rand -base64 32
NEXTAUTH_SECRET="jT8xK9mN2pQ4rS6vW8yZ0bC3dE5fG7hI9jK1lM3nO5p="
NEXTAUTH_URL="http://localhost:3000"

# ==================== OAuth Providers ====================

# Google OAuth
GOOGLE_CLIENT_ID="123456789-abcdefg.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="GOCSPX-xxxxxxxxxxxxxxxxxxxx"

# GitHub OAuth
GITHUB_CLIENT_ID="Iv1.a1b2c3d4e5f6g7h8"
GITHUB_CLIENT_SECRET="1234567890abcdef1234567890abcdef12345678"

# Yandex OAuth
YANDEX_CLIENT_ID="1234567890abcdef"
YANDEX_CLIENT_SECRET="ваш-секретный-ключ"

# Mail.ru OAuth
MAILRU_CLIENT_ID="123456"
MAILRU_CLIENT_SECRET="abcdef1234567890"

# ==================== Database ====================
# Ваши существующие переменные БД остаются без изменений
DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..."
```

### 🔒 Безопасность:
- ❌ **НИКОГДА** не коммитьте `.env` файл в Git
- ✅ Убедитесь, что `.env` добавлен в `.gitignore`
- ✅ Для production используйте переменные окружения на хостинге

---

## 7. Применение миграции БД

NextAuth требует специальные таблицы в базе данных.

### Шаг 1: Проверьте Prisma схему
Убедитесь, что в `prisma/schema.prisma` есть модели NextAuth (они уже добавлены):
- ✅ User
- ✅ Account
- ✅ Session
- ✅ VerificationToken

### Шаг 2: Создайте миграцию
```bash
npx prisma migrate dev --name add_nextauth_models
```

### Шаг 3: Проверьте миграцию
```bash
# Откройте Prisma Studio для проверки
npx prisma studio
```

### ⚠️ Важно для существующих пользователей:
Если у вас уже есть пользователи с Clerk:
```sql
-- Пример миграции данных (запустите в вашей БД)
-- ВНИМАНИЕ: Сделайте backup перед выполнением!

-- 1. Переименование userId в id (если нужно)
ALTER TABLE "User" RENAME COLUMN "userId" TO "id";

-- 2. Добавление новых полей
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailVerified" TIMESTAMP;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "image" TEXT;
```

---

## 8. Тестирование

### Шаг 1: Запустите приложение
```bash
npm run dev
```

### Шаг 2: Откройте страницу входа
Перейдите по адресу: http://localhost:3000/sign-in

### Шаг 3: Протестируйте каждый провайдер

#### ✅ Google:
1. Нажмите "Войти через Google"
2. Выберите аккаунт
3. Разрешите доступ
4. Должен быть редирект на `/dashboard`

#### ✅ GitHub:
1. Нажмите "Войти через GitHub"
2. Authorize приложение
3. Должен быть редирект на `/dashboard`

#### ✅ Яндекс:
1. Нажмите "Войти через Яндекс"
2. Войдите в Яндекс аккаунт
3. Разрешите доступ
4. Должен быть редирект на `/dashboard`

#### ✅ Mail.ru:
1. Нажмите "Войти через Mail.ru"
2. Войдите в Mail.ru аккаунт
3. Разрешите доступ
4. Должен быть редирект на `/dashboard`

### Шаг 4: Проверьте сессию
В консоли разработчика:
```javascript
// Проверить текущую сессию
fetch('/api/auth/session').then(r => r.json()).then(console.log)
```

Должны увидеть:
```json
{
  "user": {
    "id": "cm2abc123",
    "name": "Ваше Имя",
    "email": "email@example.com",
    "image": "https://..."
  },
  "expires": "2025-11-05T..."
}
```

---

## 🐛 Устранение проблем

### Проблема: "Invalid Redirect URI"
**Решение:** Убедитесь, что callback URL точно совпадает:
```
http://localhost:3000/api/auth/callback/{provider}
```
Без лишних слешей в конце!

### Проблема: "Client Secret is invalid"
**Решение:** 
- Проверьте, что скопировали весь секрет
- Убедитесь, что нет лишних пробелов
- Перегенерируйте секрет в консоли провайдера

### Проблема: "Database error"
**Решение:**
```bash
# Перегенерируйте Prisma Client
npx prisma generate

# Проверьте подключение к БД
npx prisma db push
```

### Проблема: "NEXTAUTH_SECRET не установлен"
**Решение:**
```bash
# Сгенерируйте новый секрет
openssl rand -base64 32

# Добавьте в .env
NEXTAUTH_SECRET="полученный-секрет"
```

### Проблема: Яндекс OAuth не работает на localhost
**Решение:** Яндекс требует HTTPS для production, но `http://localhost` должен работать. Проверьте:
1. Redirect URI указан правильно
2. Разрешения на получение email и профиля выданы

---

## 📚 Полезные ссылки

### Документация провайдеров:
- 🔵 [Google OAuth 2.0](https://developers.google.com/identity/protocols/oauth2)
- 🐙 [GitHub OAuth Apps](https://docs.github.com/en/developers/apps/building-oauth-apps)
- 🔴 [Яндекс.OAuth](https://yandex.ru/dev/id/doc/ru/)
- 📧 [Mail.ru OAuth](https://o2.mail.ru/docs/)

### NextAuth.js:
- 📖 [NextAuth.js Documentation](https://next-auth.js.org/)
- 🎯 [NextAuth.js Providers](https://next-auth.js.org/providers/)

---

## 🎉 Готово!

После выполнения всех шагов у вас будет:
- ✅ Рабочая авторизация через 4 провайдера
- ✅ Безопасное хранение сессий
- ✅ Автоматическое создание пользователей
- ✅ Полный контроль над процессом авторизации

**Следующие шаги:**
1. Обновите остальные файлы проекта, использующие Clerk API
2. Протестируйте все функции приложения
3. Настройте production переменные окружения
4. Разверните на production

---

💬 **Нужна помощь?** Откройте issue в репозитории или свяжитесь с командой разработки.
