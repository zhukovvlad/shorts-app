#!/bin/bash

# Log Rotation Script for Shorts App
# Запускать через cron: 0 2 * * * /path/to/rotate-logs.sh

LOG_DIR="${LOG_DIR:-./logs}"
ARCHIVE_DIR="${LOG_DIR}/archive"
DAYS_TO_KEEP=30
DAYS_TO_ARCHIVE=90

echo "Starting log rotation at $(date)"

# Создаем директорию для архива если не существует
mkdir -p "${ARCHIVE_DIR}"

# Архивируем логи старше 30 дней
find "${LOG_DIR}" -maxdepth 1 -name "*.log" -mtime +${DAYS_TO_KEEP} -type f | while read log; do
    filename=$(basename "$log")
    echo "Archiving: $filename"
    gzip -c "$log" > "${ARCHIVE_DIR}/${filename}.gz"
    rm "$log"
done

# Удаляем архивы старше 90 дней
find "${ARCHIVE_DIR}" -name "*.log.gz" -mtime +${DAYS_TO_ARCHIVE} -type f -delete

echo "Log rotation completed at $(date)"
echo "---"
