# Testing

## Setup

Проект использует **Jest** для автоматизированного тестирования с полной поддержкой TypeScript.

### Установленные пакеты:
- `jest` - тестовый фреймворк
- `@types/jest` - типы TypeScript для Jest
- `ts-jest` - TypeScript preprocessor для Jest
- `@jest/globals` - глобальные типы Jest

## Запуск тестов

```bash
# Запустить все тесты
npm test

# Запустить тесты в watch режиме (автоматический перезапуск при изменениях)
npm run test:watch

# Запустить тесты с отчетом о покрытии кода
npm run test:coverage
```

## Структура тестов

Тесты располагаются рядом с тестируемыми модулями и имеют расширение `.spec.ts` или `.test.ts`:

```
lib/
  logger.ts           # Основной модуль
  logger.spec.ts      # Тесты для logger
```

## Конфигурация

Конфигурация Jest находится в `jest.config.js`:

- **testEnvironment**: `node` - окружение Node.js для тестов
- **preset**: `ts-jest` - поддержка TypeScript
- **moduleNameMapper**: Поддержка alias `@/` для импортов
- **testTimeout**: 10000ms - таймаут для каждого теста

## Примеры тестов

### Logger Tests (`lib/logger.spec.ts`)

Автоматизированные тесты для системы логирования:

✅ **Создание лог-файлов**: Проверка что файлы создаются с правильными именами и содержимым  
✅ **Разделение источников**: [SERVER] и [WORKER] логи пишутся в разные файлы  
✅ **Редакция PII**: userId, email, token маскируются  
✅ **Формат**: ISO 8601 timestamps и JSON контекст  
✅ **Уровни логирования**: info, warn, error, debug  
✅ **Идемпотентность**: Тесты очищают созданные файлы после выполнения

### Написание новых тестов

```typescript
import fs from 'fs';
import path from 'path';

describe('MyModule', () => {
  // Выполняется перед всеми тестами
  beforeAll(() => {
    // Setup
  });

  // Выполняется после каждого теста
  afterEach(() => {
    // Cleanup
  });

  // Выполняется после всех тестов
  afterAll(() => {
    // Final cleanup
  });

  it('should do something', () => {
    // Arrange
    const input = 'test';
    
    // Act
    const result = myFunction(input);
    
    // Assert
    expect(result).toBe('expected');
    expect(result).toContain('exp');
    expect(result).not.toBeNull();
  });
});
```

## Best Practices

### 1. Изоляция тестов
- Каждый тест должен быть независимым
- Используйте `beforeEach`/`afterEach` для setup/cleanup
- Не полагайтесь на порядок выполнения тестов

### 2. Именование
- Используйте описательные имена: `should create log file with correct content`
- Группируйте тесты с `describe()`
- Один `it()` блок = одна проверка

### 3. AAA Pattern
```typescript
it('should format message correctly', () => {
  // Arrange - подготовка данных
  const input = { message: 'test' };
  
  // Act - выполнение действия
  const result = formatMessage(input);
  
  // Assert - проверка результата
  expect(result).toBe('[TEST] test');
});
```

### 4. Переменные окружения
```typescript
// Сохраняем оригинальные значения
const originalEnv = process.env.NODE_ENV;

// Изменяем для теста
process.env.NODE_ENV = 'test';

// Восстанавливаем после теста
afterAll(() => {
  process.env.NODE_ENV = originalEnv;
});
```

### 5. Файловые операции
```typescript
const TEST_DIR = path.join(__dirname, 'test-data');

beforeEach(() => {
  // Создаем тестовую директорию
  fs.mkdirSync(TEST_DIR, { recursive: true });
});

afterEach(() => {
  // Удаляем тестовую директорию
  fs.rmSync(TEST_DIR, { recursive: true, force: true });
});
```

## Coverage

Отчет о покрытии кода создается в директории `coverage/`:

```bash
npm run test:coverage

# Открыть HTML отчет
open coverage/lcov-report/index.html
```

## CI/CD

Тесты можно интегрировать в CI/CD pipeline:

```yaml
# .github/workflows/test.yml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '20'
      - run: npm ci
      - run: npm test
      - run: npm run test:coverage
```

## Troubleshooting

### Тесты не запускаются
```bash
# Очистить кэш Jest
npx jest --clearCache

# Переустановить зависимости
rm -rf node_modules package-lock.json
npm install
```

### TypeScript ошибки
```bash
# Убедитесь что типы установлены
npm install --save-dev @types/jest @types/node

# Проверьте tsconfig.json
```

### Timeout ошибки
```typescript
// Увеличить timeout для конкретного теста
it('slow test', async () => {
  // test code
}, 15000); // 15 секунд

// Или в jest.config.js
testTimeout: 20000
```

## Полезные ссылки

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [ts-jest Documentation](https://kulshekhar.github.io/ts-jest/)
- [Jest Matchers](https://jestjs.io/docs/expect)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)
