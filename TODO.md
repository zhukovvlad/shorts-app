# TODO - Список задач для продакшн деплоя

## 🔴 Критические задачи (обязательно перед продакшн)

### 1. Настройка домена для fallback email
**Файл:** `app/lib/checkUser.ts` (строка ~49)

**Текущее состояние:**
```typescript
fallbackEmail = `no-email-${hash}@noreply.yourdomain.com`;
```

**Что нужно сделать:**
- [ ] Заменить `yourdomain.com` на ваш реальный контролируемый домен
- [ ] Примеры: `@noreply.shorts-app.ru`, `@system.myapp.com`, `@no-reply.example.com`
- [ ] Настроить MX записи для обработки bounce emails (опционально)

**Приоритет:** 🔴 Высокий  
**Дедлайн:** Перед продакшн деплоем

---

### 2. Обновить URL в Stripe checkout
**Файл:** `app/api/stripe/checkout/route.ts` (строки 22-23)

**Текущее состояние:**
```typescript
success_url: 'http://localhost:3000/success',
cancel_url: 'http://localhost:3000/cancel',
```

**Что нужно сделать:**
- [ ] Заменить `localhost:3000` на продакшн URL
- [ ] Использовать переменную окружения `NEXT_PUBLIC_APP_URL` или `process.env.APP_URL`
- [ ] Пример: `${process.env.NEXT_PUBLIC_APP_URL}/success`

**Приоритет:** 🔴 Высокий  
**Дедлайн:** Перед продакшн деплоем

---

## 🟡 Важные задачи (рекомендуется)

### 3. Проверить OAuth callback URLs
**Файлы:** Документация в `docs/OAUTH_PROVIDERS.md`

**Что нужно сделать:**
- [ ] Убедиться, что в Google Cloud Console добавлен продакшн redirect URI
- [ ] Убедиться, что в GitHub OAuth добавлен продакшн callback URL
- [ ] Убедиться, что в Yandex OAuth добавлен продакшн callback URI
- [ ] Убедиться, что в Mail.ru OAuth добавлен продакшн callback URI

**Формат продакшн URL:**
```text
https://yourdomain.com/api/auth/callback/google
https://yourdomain.com/api/auth/callback/github
https://yourdomain.com/api/auth/callback/yandex
https://yourdomain.com/api/auth/callback/mailru
```

**Приоритет:** 🟡 Средний  
**Дедлайн:** Перед продакшн деплоем

---

### 4. Настроить переменные окружения для продакшн
**Файлы:** `.env.production` (создать)

**Что нужно сделать:**
- [ ] Создать `.env.production` или настроить в хостинге
- [ ] Убедиться, что все OAuth credentials настроены
- [ ] Проверить `DATABASE_URL` и `DIRECT_URL` для продакшн БД
- [ ] Проверить `STRIPE_SECRET_KEY` и `STRIPE_WEBHOOK_SECRET`
- [ ] Установить `NODE_ENV=production`
- [ ] Настроить `NEXTAUTH_URL` на продакшн домен
- [ ] Сгенерировать новый `NEXTAUTH_SECRET` для продакшн

**Приоритет:** 🟡 Средний  
**Дедлайн:** Перед продакшн деплоем

---

## 🟢 Опциональные улучшения

### 5. Добавить интернационализацию (i18n)
**Файл:** `app/constants/errors.ts` и другие

**Текущее состояние:**
- Создан файл `app/constants/errors.ts` с константами сообщений об ошибках
- Сообщения пока только на русском языке

**Что можно улучшить:**
- [ ] Установить библиотеку i18n (например, `next-intl` или `react-i18next`)
- [ ] Создать файлы переводов для разных языков (ru, en)
- [ ] Заменить константы на i18n ключи
- [ ] Добавить переключатель языка в UI

**Приоритет:** 🟢 Низкий  
**Примечание:** В `app/constants/errors.ts` уже есть TODO комментарий об этом

---

### 6. Улучшить обработку ошибок в middleware
**Файл:** `middleware.ts`

**Что можно добавить:**
- [ ] Логирование неудачных попыток аутентификации
- [ ] Rate limiting для защиты от брутфорса
- [ ] Более детальные redirect с сохранением intended URL

**Приоритет:** 🟢 Низкий

---

### 7. Добавить мониторинг и алерты
**Что можно настроить:**
- [ ] Мониторинг ошибок OAuth аутентификации
- [ ] Алерты при проблемах с Stripe webhook
- [ ] Мониторинг утечек соединений с БД
- [ ] Логирование fallback email генерации

**Приоритет:** 🟢 Низкий

---

### 8. Документация
**Что можно улучшить:**
- [ ] Добавить инструкции по деплою на Timeweb
- [ ] Документировать процесс настройки переменных окружения
- [ ] Создать troubleshooting guide для OAuth провайдеров

**Приоритет:** 🟢 Низкий

---

## ✅ Завершенные задачи

- [x] Создан общий хук `useOAuthSignIn` для устранения дублирования кода
- [x] Исправлен Prisma фильтр в Stripe webhook (`userId` → `id`)
- [x] Убрана проверка email в `checkUser.ts`, upsert теперь безусловный
- [x] Обновлена документация Google OAuth (убрано упоминание Google+)
- [x] Улучшен middleware.ts для Edge Runtime совместимости
- [x] Добавлено закрытие Prisma соединений во всех early exit в test-migration.ts
- [x] Заменен placeholder email домен на контролируемый с SHA-256 хешем
- [x] Добавлена обработка edge case в useOAuthSignIn (result без error и url)
- [x] Созданы константы для сообщений об ошибках (app/constants/errors.ts)
- [x] Убран non-null assertion в checkUser.ts, сделан явный type-safe подход

---

## 📝 Примечания

### Полезные команды

```bash
# Проверка TypeScript
npx tsc --noEmit

# Запуск миграций
npx prisma migrate deploy

# Генерация Prisma Client
npx prisma generate

# Тест миграции
npx tsx scripts/test-migration.ts

# Проверка lint
npm run lint
```

### Контакты и ссылки

- Repository: <https://github.com/zhukovvlad/shorts-app>
- Branch: production/timeweb

---

**Последнее обновление:** 7 октября 2025  
**Статус:** В разработке
