#!/bin/bash

# Strict mode: fail fast and catch errors early
set -euo pipefail
IFS=$'\n\t'

# Log Rotation Script for Shorts App
# Запускать через cron: 0 2 * * * /path/to/rotate-logs.sh

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

ARCHIVE_DIR="${LOG_DIR}/archive"
DAYS_TO_KEEP=30
DAYS_TO_ARCHIVE=90

echo "Starting log rotation at $(date)"

# Создаем директорию для архива если не существует
mkdir -p "${ARCHIVE_DIR}"

# Архивируем логи старше 30 дней
# Используем copy-truncate для избежания race conditions с активными процессами
set +e  # Временно отключаем errexit
find "${LOG_DIR}" -maxdepth 1 -name "*.log" -mtime +"${DAYS_TO_KEEP}" -type f -print0 2>/dev/null | while IFS= read -r -d '' log; do
    if [ -f "$log" ]; then
        filename=$(basename "$log")
        echo "Archiving: $filename"
        # Копируем файл во временный
        if cp "$log" "${log}.tmp" 2>/dev/null; then
            # Очищаем оригинальный файл (процесс продолжит писать в него)
            : > "$log"
            # Сжимаем копию в архив
            if gzip -c "${log}.tmp" > "${ARCHIVE_DIR}/${filename}.gz" 2>/dev/null; then
                # Удаляем временный файл только после успешного сжатия
                rm -f "${log}.tmp"
            else
                echo "  ERROR: Failed to gzip ${log}.tmp" >&2
                # Восстанавливаем содержимое из временного файла при ошибке
                cat "${log}.tmp" >> "$log" 2>/dev/null || true
                rm -f "${log}.tmp"
            fi
        else
            echo "  ERROR: Failed to copy $log" >&2
        fi
    fi
done
set -e  # Включаем errexit обратно

# Удаляем архивы старше 90 дней
echo "Deleting archives older than ${DAYS_TO_ARCHIVE} days..."
set +e  # Временно отключаем errexit
find "${ARCHIVE_DIR}" -name "*.log.gz" -mtime +"${DAYS_TO_ARCHIVE}" -type f -print0 2>/dev/null | while IFS= read -r -d '' archive; do
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
echo "Deleted archives: processed files (check output above for details)"

echo "Log rotation completed at $(date)"
echo "---"
