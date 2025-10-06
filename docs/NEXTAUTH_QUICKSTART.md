# 🚀 NextAuth Quick Start - Шпаргалка

## 📝 Быстрая настройка (5 минут)

### 1️⃣ Сгенерировать секрет
```bash
openssl rand -base64 32
```

### 2️⃣ Создать .env
```bash
# Скопируйте шаблон
cp .env.auth.example .env.local

# Или добавьте в существующий .env
cat .env.auth.example >> .env
```

### 3️⃣ Заполнить переменные окружения
```env
NEXTAUTH_SECRET="ваш-сгенерированный-секрет"
NEXTAUTH_URL="http://localhost:3000"

# Минимум - настройте хотя бы один провайдер
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."
```

### 4️⃣ Применить миграцию БД
```bash
npx prisma migrate dev --name add_nextauth_models
```

### 5️⃣ Запустить и протестировать
```bash
npm run dev
```
Откройте: http://localhost:3000/sign-in

---

## 🔗 Быстрые ссылки для регистрации OAuth приложений

| Провайдер | URL для регистрации | Callback URL |
|-----------|---------------------|--------------|
| 🔵 Google | https://console.cloud.google.com/apis/credentials | `http://localhost:3000/api/auth/callback/google` |
| 🐙 GitHub | https://github.com/settings/developers | `http://localhost:3000/api/auth/callback/github` |
| 🔴 Яндекс | https://oauth.yandex.ru/ | `http://localhost:3000/api/auth/callback/yandex` |
| 📧 Mail.ru | https://o2.mail.ru/app/ | `http://localhost:3000/api/auth/callback/mailru` |

---

## 🔄 Переключение между ветками

### Вернуться к Clerk (оригинал)
```bash
git checkout main
npm install  # восстановить зависимости
```

### Использовать NextAuth (новая версия)
```bash
git checkout feature/nextauth-migration
npm install  # установить новые зависимости
```

---

## 📦 Что изменилось

### Удалено
- `@clerk/nextjs`
- Clerk переменные окружения

### Добавлено
- `next-auth` v5
- `@auth/prisma-adapter`
- `bcrypt` (опционально, для будущего)
- 3 новые таблицы в БД: Account, Session, VerificationToken

### Изменено
- `app/layout.tsx` - SessionProvider вместо ClerkProvider
- `middleware.ts` - NextAuth middleware
- `components/Navigation.tsx` - useSession вместо useUser
- `prisma/schema.prisma` - обновлена модель User

---

## 🐛 Частые ошибки

### ❌ Ошибка: "NEXTAUTH_SECRET must be provided"
```bash
# Решение: Сгенерируйте и добавьте в .env
openssl rand -base64 32
```

### ❌ Ошибка: "Invalid redirect URI"
**Решение:** Убедитесь что callback URL в OAuth приложении точно совпадает:
```
http://localhost:3000/api/auth/callback/google
```
(без лишнего `/` в конце!)

### ❌ Ошибка: Database connection
```bash
# Решение: Проверьте подключение
npx prisma db push
npx prisma generate
```

---

## 🎯 Минимальная настройка для теста

Хотите быстро протестировать? Настройте только **GitHub**:

1. Идите на https://github.com/settings/developers
2. "New OAuth App"
3. Заполните:
   - Homepage: `http://localhost:3000`
   - Callback: `http://localhost:3000/api/auth/callback/github`
4. Скопируйте Client ID и Secret
5. Добавьте в `.env`:
   ```env
   NEXTAUTH_SECRET="любая-случайная-строка-32-символа"
   NEXTAUTH_URL="http://localhost:3000"
   GITHUB_CLIENT_ID="ваш-client-id"
   GITHUB_CLIENT_SECRET="ваш-secret"
   ```
6. Запустите: `npm run dev`
7. Откройте: http://localhost:3000/sign-in

Готово! Теперь можно войти через GitHub.

---

## 📖 Документация

Полная инструкция: [docs/NEXTAUTH_SETUP.md](./NEXTAUTH_SETUP.md)

---

## 💡 Следующие шаги

После успешной настройки авторизации нужно обновить:

- [ ] `app/lib/checkUser.ts` - заменить Clerk на NextAuth
- [ ] `app/lib/checkUserLight.ts` - заменить Clerk на NextAuth
- [ ] `app/actions/*.ts` - все server actions с auth
- [ ] `app/api/**/*.ts` - API routes с аутентификацией
- [ ] Другие файлы, использующие `@clerk/nextjs`

Поиск всех мест с Clerk:
```bash
grep -r "@clerk/nextjs" app/
```
