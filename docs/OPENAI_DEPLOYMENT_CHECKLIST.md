# Чеклист деплоя OpenAI интеграции

## Перед деплоем

- [ ] Получить API ключ OpenAI на https://platform.openai.com/api-keys
- [ ] Добавить `OPENAI_API_KEY` в переменные окружения production
- [ ] Проверить лимиты API на OpenAI dashboard
- [ ] Убедиться, что платежный метод настроен в OpenAI аккаунте

## Тестирование локально

```bash
# 1. Добавить в .env
echo "OPENAI_API_KEY=sk-your-key" >> .env

# 2. Запустить тесты
npm test

# 3. Запустить dev сервер
npm run dev

# 4. Протестировать создание видео с DALL-E моделью
# Перейти на /new и выбрать DALL-E 3 из списка моделей
```

## Production деплой

### Vercel
```bash
# Добавить переменную окружения
vercel env add OPENAI_API_KEY production
# Введите ключ когда будет запрошен

# Или через UI:
# 1. Перейти в Settings -> Environment Variables
# 2. Добавить OPENAI_API_KEY = sk-...
# 3. Выбрать Production environment
```

### Timeweb / Docker
```bash
# Добавить в docker-compose.yml или .env на сервере
OPENAI_API_KEY=sk-your-key-here

# Или через переменные окружения
export OPENAI_API_KEY=sk-your-key-here
```

## После деплоя

- [ ] Создать тестовое видео с DALL-E 2 (самый дешёвый)
- [ ] Проверить, что изображение загружается в S3
- [ ] Проверить логи на наличие ошибок OpenAI
- [ ] Создать тестовое видео с DALL-E 3
- [ ] Создать тестовое видео с DALL-E 3 HD
- [ ] Проверить стоимость в OpenAI usage dashboard

## Мониторинг

### Метрики для отслеживания
1. **API Usage**: https://platform.openai.com/usage
   - Количество запросов
   - Стоимость за период
   - Rate limits
   
2. **Логи приложения**
   ```bash
   # Поиск OpenAI логов
   grep "OpenAI" logs/server-*.log
   grep "DALL-E" logs/server-*.log
   ```

3. **Ошибки**
   ```bash
   # Проверка ошибок OpenAI
   grep "Error processing image from OpenAI" logs/server-error-*.log
   ```

## Rollback план

Если возникнут проблемы:

1. **Отключить OpenAI модели из UI**
   - Закомментировать OpenAI модели в `lib/imageModels.ts`
   - Задеплоить изменения

2. **Откатить на предыдущий коммит**
   ```bash
   git revert HEAD
   git push origin production/timeweb
   ```

3. **Удалить переменную окружения**
   ```bash
   vercel env rm OPENAI_API_KEY production
   ```

## Известные ограничения

- DALL-E 2 не поддерживает 9:16 формат
- DALL-E 3 HD работает медленнее других моделей
- Стоимость выше чем у Replicate моделей
- Rate limits: 
  - Tier 1: 3 requests/min
  - Tier 2: 50 requests/min
  - Tier 3+: выше

## Troubleshooting

### Ошибка: "API key not found"
**Решение**: Проверить что `OPENAI_API_KEY` установлен в окружении

### Ошибка: "Rate limit exceeded"
**Решение**: 
- Проверить tier в OpenAI dashboard
- Подождать 1 минуту и повторить
- Рассмотреть upgrade tier

### Ошибка: "Insufficient quota"
**Решение**:
- Добавить платежный метод в OpenAI
- Пополнить баланс
- Увеличить spending limit

### Изображения не генерируются
**Решение**:
1. Проверить логи: `grep "OpenAI" logs/server-*.log`
2. Убедиться что API key валиден
3. Проверить что модель выбрана корректно
4. Попробовать Replicate модель для сравнения

## Контакты поддержки

- OpenAI Support: https://help.openai.com/
- OpenAI Status: https://status.openai.com/

## Стоимость (обновлено 2025)

| Модель | Размер | Цена за изображение |
|--------|--------|---------------------|
| DALL-E 3 Standard | 1024x1024 | $0.040 |
| DALL-E 3 Standard | 1024x1792 | $0.080 |
| DALL-E 3 HD | 1024x1024 | $0.080 |
| DALL-E 3 HD | 1024x1792 | $0.120 |
| DALL-E 2 | 512x512 | $0.020 |

Для типичного видео с 5-10 изображениями:
- DALL-E 3: $0.40 - $0.80
- DALL-E 3 HD: $0.60 - $1.20
- DALL-E 2: $0.10 - $0.20

## Дополнительные ресурсы

- [OpenAI API Documentation](https://platform.openai.com/docs/api-reference/images)
- [OpenAI Pricing](https://openai.com/pricing)
- [Rate Limits Guide](https://platform.openai.com/docs/guides/rate-limits)
