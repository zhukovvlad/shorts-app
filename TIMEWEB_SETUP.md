# Быстрый старт - Подключение Timeweb БД

**Статус:** ✅ Настроено и работает (13 октября 2025)

## Шаг 1: Добавь строку подключения

Создай или обнови `.env.local` (или `.env`):

```env
# Timeweb PostgreSQL Database
DATABASE_URL="postgresql://gen_user:ВАШ_ПАРОЛЬ@s64c08952f8065169210bf4b.twc1.net:5432/default_db?sslmode=require"
DIRECT_URL="postgresql://gen_user:ВАШ_ПАРОЛЬ@s64c08952f8065169210bf4b.twc1.net:5432/default_db?sslmode=require"
```

**Важно:** Замени `ВАШ_ПАРОЛЬ` на реальный пароль из панели Timeweb!

## Шаг 2: Примени миграцию

```bash
# Применить миграцию на новую БД
npx prisma migrate deploy

# Сгенерировать Prisma Client
npx prisma generate
```

## Шаг 3: Проверь что все работает

```bash
# Запустить тестовый скрипт
npx tsx scripts/test-migration.ts
```

Если видишь "🎉 ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ УСПЕШНО!" - значит все готово!

## Шаг 4: Запусти приложение

```bash
npm run dev
```

Попробуй залогиниться через OAuth - должен создаться User и работать весь функционал.

---

## Что уже сделано ✅

1. **Создана миграция** в `prisma/migrations/20251007000000_init_nextauth/`
2. **Обновлена schema.prisma** - удалено старое поле `userId`
3. **Весь код обновлен**:
   - Все запросы используют `User.id` вместо `User.userId`
   - Foreign Keys правильно настроены
   - NextAuth использует `session.user.id`

4. **Созданы документация и тесты**:
   - `docs/DATABASE_MIGRATION.md` - подробная документация
   - `scripts/test-migration.ts` - автоматические проверки

## Если что-то пошло не так

1. **Ошибка подключения SSL:**
   ```env
   DATABASE_URL="...?sslmode=require&sslaccept=accept_invalid_certs"
   ```

2. **Уже есть таблицы в БД:**
   ```bash
   # ВНИМАНИЕ: Удалит все данные!
   npx prisma migrate reset
   ```

3. **Нужна помощь:**
   - Проверь `docs/DATABASE_MIGRATION.md`
   - Запусти `npx tsx scripts/test-migration.ts`
   - Проверь логи: `npx prisma migrate status`

## Следующие шаги

После успешной миграции:
- [x] Протестировать OAuth вход
- [x] Создать тестовое видео
- [x] Проверить работу credits

---

## Обновления

### 13 октября 2025 - Stripe Credits

**Исправлено:** Начисление кредитов теперь работает в dev режиме через `/api/stripe/add-credits`
- Success page автоматически начисляет кредиты после оплаты
- Webhook продолжает работать для production
- Подробнее: см. `app/api/stripe/add-credits/route.ts`
- [ ] Настроить backup БД на Timeweb
