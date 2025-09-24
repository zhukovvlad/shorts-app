# Хук useVideoActions

Пользовательский React хук, который предоставляет комплексную функциональность управления видео, включая скачивание, обмен ссылками и удаление с правильной обработкой ошибок и обратной связью пользователю.

## Возможности

- ✅ **Скачивание видео**: Безопасное скачивание видеофайлов с обработкой ошибок
- ✅ **Обмен ссылками**: Копирование ссылок на видео в буфер обмена с проверкой совместимости браузера
- ✅ **Удаление видео**: Безопасное удаление видео с подтверждением и состояниями загрузки
- ✅ **Toast уведомления**: Удобная для пользователя обратная связь для всех операций
- ✅ **Поддержка TypeScript**: Полная типобезопасность с современными `type` определениями
- ✅ **Обработка ошибок**: Комплексная обработка ошибок с логированием
- ✅ **Безопасность**: Защита от XSS с `noopener noreferrer`

## Установка

Этот хук является частью проекта shorts-app и использует следующие зависимости:

```bash
npm install sonner react next
```

## Использование

### Базовое использование

```tsx
import { useVideoActions } from './hooks/useVideoActions';

function VideoComponent({ videoId, videoUrl }) {
  const { 
    handleDownload, 
    handleCopyLink, 
    handleDelete, 
    copied, 
    isDeleting 
  } = useVideoActions({
    videoId,
    videoUrl,
    onDeleteSuccessAction: () => {
      // Опционально: обработка успешного удаления
      router.push('/dashboard');
    }
  });

  return (
    <div>
      <button onClick={handleDownload}>
        Скачать видео
      </button>
      
      <button onClick={handleCopyLink}>
        {copied ? '✅ Скопировано!' : '📋 Копировать ссылку'}
      </button>
      
      <button 
        onClick={handleDelete} 
        disabled={isDeleting}
        className="text-red-600"
      >
        {isDeleting ? '🗑️ Удаление...' : '🗑️ Удалить'}
      </button>
    </div>
  );
}
```

### Продвинутое использование с подтверждением

```tsx
import { useState } from 'react';
import { useVideoActions } from './hooks/useVideoActions';

function VideoActionsWithConfirm({ videoId, videoUrl }) {
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  
  const { handleDelete, isDeleting, ...actions } = useVideoActions({
    videoId,
    videoUrl,
    onDeleteSuccessAction: () => {
      setShowConfirmDelete(false);
      // Обработка успешного удаления
    }
  });

  const confirmDelete = () => {
    setShowConfirmDelete(false);
    handleDelete();
  };

  return (
    <div>
      {/* Другие кнопки действий */}
      
      <button onClick={() => setShowConfirmDelete(true)}>
        Удалить видео
      </button>
      
      {showConfirmDelete && (
        <div className="confirm-dialog">
          <p>Вы уверены, что хотите удалить это видео?</p>
          <button onClick={confirmDelete} disabled={isDeleting}>
            {isDeleting ? 'Удаление...' : 'Да, удалить'}
          </button>
          <button onClick={() => setShowConfirmDelete(false)}>
            Отмена
          </button>
        </div>
      )}
    </div>
  );
}
```

## Справочник API

### Параметры

| Параметр | Тип | Обязательный | Описание |
|----------|-----|--------------|----------|
| `videoId` | `string` | ✅ | Уникальный идентификатор видео |
| `videoUrl` | `string \| null` | ✅ | URL файла видео для скачивания |
| `onDeleteSuccessAction` | `() => void` | ❌ | Обратный вызов, выполняемый после успешного удаления |

### Возвращаемые значения

| Свойство | Тип | Описание |
|----------|-----|----------|
| `handleDownload` | `() => void` | Функция для инициации скачивания видео |
| `handleCopyLink` | `() => Promise<void>` | Функция для копирования ссылки на видео в буфер обмена |
| `handleDelete` | `() => Promise<void>` | Функция для удаления видео |
| `copied` | `boolean` | Указывает, была ли недавно скопирована ссылка (сбрасывается через 2с) |
| `isDeleting` | `boolean` | Указывает, выполняется ли удаление |

## Обработка ошибок

Хук обрабатывает различные сценарии ошибок:

- **Ошибки скачивания**: Отсутствующий URL видео, проблемы с сетью
- **Ошибки буфера обмена**: Неподдерживаемые браузеры, отказ в разрешении
- **Ошибки удаления**: Проблемы с аутентификацией, сбои сети, ошибки сервера

Все ошибки логируются в консоль для отладки и показываются пользователям через toast уведомления.

## Совместимость с браузерами

- **Скачивание**: Работает во всех современных браузерах
- **Буфер обмена**: Требует HTTPS и современный браузер с поддержкой Clipboard API
- **Удаление**: Универсальная совместимость (зависит от ответа сервера)

## Соображения безопасности

- Ссылки открываются с `rel="noopener noreferrer"` для защиты от XSS
- Использование Clipboard API с правильной обработкой разрешений
- Валидация аутентификации на стороне сервера для удаления

## Зависимости

- `react`: Управление состоянием и хуки
- `sonner`: Toast уведомления
- `next/navigation`: Функциональность роутера
- `../lib/deleteVideo`: Серверное действие для удаления видео

## Участие в разработке

При модификации этого хука:

1. Поддерживайте типобезопасность TypeScript
2. Добавляйте правильную JSDoc документацию
3. Включайте обработку ошибок для новых функций
4. Обновляйте тесты и документацию
5. Обеспечивайте обратную совместимость

## Тестирование

```tsx
// Пример структуры тестов
import { renderHook, act } from '@testing-library/react';
import { useVideoActions } from './useVideoActions';

describe('useVideoActions', () => {
  it('должен обрабатывать скачивание, когда предоставлен videoUrl', () => {
    const { result } = renderHook(() => useVideoActions({
      videoId: 'test-id',
      videoUrl: 'https://example.com/video.mp4'
    }));
    
    act(() => {
      result.current.handleDownload();
    });
    
    // Добавить проверки
  });
});
```

## История изменений

### v1.2.0 (Текущая)
- ✅ Заменены `interface` на `type` (современная практика TypeScript)
- ✅ Переименовано `onDeleteSuccess` → `onDeleteSuccessAction` (требования Next.js)
- ✅ Документация теперь отслеживается в git для контроля версий
- ✅ Обновлены примеры в документации

### v1.1.0 (Сентябрь 2025)
- ✅ Добавлена комплексная поддержка TypeScript
- ✅ Улучшена обработка ошибок с логированием в консоль
- ✅ Добавлены улучшения безопасности
- ✅ Исправлены типы toast уведомлений
- ✅ Добавлены проверки совместимости браузера

### v1.0.0
- Начальная реализация с базовой функциональностью