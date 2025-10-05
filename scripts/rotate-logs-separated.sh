#!/bin/bash

# Strict mode: fail fast and catch errors early
set -euo pipefail
IFS=$'\n\t'

# Скрипт ротации логов Shorts App с разделением сервер/воркер
# Использовать в cron: 0 2 * * * /path/to/rotate-logs-separated.sh

LOG_DIR="${LOG_DIR:-./logs}"

# Валидация LOG_DIR
if [ ! -e "$LOG_DIR" ]; then
  echo "Error: LOG_DIR '$LOG_DIR' does not exist" >&2
  exit 1
fi

if [ ! -d "$LOG_DIR" ]; then
  echo "Error: LOG_DIR '$LOG_DIR' exists but is not a directory" >&2
  exit 1
fi

if [ ! -r "$LOG_DIR" ]; then
  echo "Error: LOG_DIR '$LOG_DIR' is not readable" >&2
  exit 1
fi

if [ ! -w "$LOG_DIR" ]; then
  echo "Error: LOG_DIR '$LOG_DIR' is not writable" >&2
  exit 1
fi

if [ ! -x "$LOG_DIR" ]; then
  echo "Error: LOG_DIR '$LOG_DIR' is not executable (cannot access directory)" >&2
  exit 1
fi

# Политики хранения
WORKER_ARCHIVE_DAYS=7   # Воркер генерирует больше логов - короче хранение
WORKER_DELETE_DAYS=30   # Удаляем через месяц

SERVER_ARCHIVE_DAYS=30  # Серверные логи важнее - дольше храним
SERVER_DELETE_DAYS=90   # Удаляем через 3 месяца

echo "Starting log rotation at $(date)"

# === WORKER LOGS (короткое хранение) ===
echo "Processing worker logs..."

# Архивируем логи воркера старше 7 дней
# Используем copy-truncate для избежания race conditions с активными процессами
set +e  # Временно отключаем errexit для толерантности к ошибкам
find "$LOG_DIR" -name "worker-*.log" -type f -mtime +"$WORKER_ARCHIVE_DAYS" ! -name "*.gz" -print0 2>/dev/null | while IFS= read -r -d '' logfile; do
  if [ -f "$logfile" ]; then
    # Копируем файл с timestamp
    timestamp=$(date +%s)
    if cp "$logfile" "${logfile}.${timestamp}.tmp" 2>/dev/null; then
      # Очищаем оригинальный файл (процесс продолжит писать в него)
      : > "$logfile"
      # Сжимаем копию
      if gzip "${logfile}.${timestamp}.tmp" 2>/dev/null; then
        # Переименовываем в финальное имя
        mv "${logfile}.${timestamp}.tmp.gz" "${logfile}.gz" 2>/dev/null || true
      else
        echo "  ERROR: Failed to gzip ${logfile}.${timestamp}.tmp" >&2
        # Восстанавливаем содержимое при ошибке
        cat "${logfile}.${timestamp}.tmp" >> "$logfile" 2>/dev/null || true
        rm -f "${logfile}.${timestamp}.tmp"
      fi
    else
      echo "  ERROR: Failed to copy $logfile" >&2
    fi
  fi
done
set -e  # Включаем errexit обратно
echo "  - Archived worker logs older than $WORKER_ARCHIVE_DAYS days"

# Удаляем архивы воркера старше 30 дней
echo "Deleting worker archives older than $WORKER_DELETE_DAYS days..."
set +e  # Временно отключаем errexit
find "$LOG_DIR" -name "worker-*.log.gz" -type f -mtime +"$WORKER_DELETE_DAYS" -print0 2>/dev/null | while IFS= read -r -d '' archive; do
  if [ -f "$archive" ]; then
    echo "  DELETING: $archive"
    if rm -f "$archive" 2>/dev/null; then
      : # Success - continue
    else
      echo "  ERROR deleting $archive: failed to remove file" >&2
    fi
  fi
done
set -e  # Включаем errexit обратно
echo "  - Deleted worker archives: processed files (check output above for details)"

# === SERVER LOGS (длинное хранение) ===
echo "Processing server logs..."

# Архивируем логи сервера старше 30 дней
# Используем copy-truncate для избежания race conditions с активными процессами
set +e  # Временно отключаем errexit для толерантности к ошибкам
find "$LOG_DIR" -name "server-*.log" -type f -mtime +"$SERVER_ARCHIVE_DAYS" ! -name "*.gz" -print0 2>/dev/null | while IFS= read -r -d '' logfile; do
  if [ -f "$logfile" ]; then
    # Копируем файл с timestamp
    timestamp=$(date +%s)
    if cp "$logfile" "${logfile}.${timestamp}.tmp" 2>/dev/null; then
      # Очищаем оригинальный файл (процесс продолжит писать в него)
      : > "$logfile"
      # Сжимаем копию
      if gzip "${logfile}.${timestamp}.tmp" 2>/dev/null; then
        # Переименовываем в финальное имя
        mv "${logfile}.${timestamp}.tmp.gz" "${logfile}.gz" 2>/dev/null || true
      else
        echo "  ERROR: Failed to gzip ${logfile}.${timestamp}.tmp" >&2
        # Восстанавливаем содержимое при ошибке
        cat "${logfile}.${timestamp}.tmp" >> "$logfile" 2>/dev/null || true
        rm -f "${logfile}.${timestamp}.tmp"
      fi
    else
      echo "  ERROR: Failed to copy $logfile" >&2
    fi
  fi
done
set -e  # Включаем errexit обратно
echo "  - Archived server logs older than $SERVER_ARCHIVE_DAYS days"

# Удаляем архивы сервера старше 90 дней
echo "Deleting server archives older than $SERVER_DELETE_DAYS days..."
set +e  # Временно отключаем errexit
find "$LOG_DIR" -name "server-*.log.gz" -type f -mtime +"$SERVER_DELETE_DAYS" -print0 2>/dev/null | while IFS= read -r -d '' archive; do
  if [ -f "$archive" ]; then
    echo "  DELETING: $archive"
    if rm -f "$archive" 2>/dev/null; then
      : # Success - continue
    else
      echo "  ERROR deleting $archive: failed to remove file" >&2
    fi
  fi
done
set -e  # Включаем errexit обратно
echo "  - Deleted server archives: processed files (check output above for details)"

# === СТАТИСТИКА ===
echo ""
echo "Current log statistics:"
echo "  Worker logs: $(find "$LOG_DIR" -name "worker-*.log" 2>/dev/null | wc -l) active files"
echo "  Worker archives: $(find "$LOG_DIR" -name "worker-*.log.gz" 2>/dev/null | wc -l) archived files"
echo "  Server logs: $(find "$LOG_DIR" -name "server-*.log" 2>/dev/null | wc -l) active files"
echo "  Server archives: $(find "$LOG_DIR" -name "server-*.log.gz" 2>/dev/null | wc -l) archived files"
echo "  Total size: $(du -sh "$LOG_DIR" 2>/dev/null | cut -f1)"

echo ""
echo "Log rotation completed at $(date)"
