#!/bin/bash

# Скрипт ротации логов для Shorts App с разделением сервер/воркер
# Использовать в cron: 0 2 * * * /path/to/rotate-logs-separated.sh

LOG_DIR="${LOG_DIR:-./logs}"

# Политики хранения
WORKER_ARCHIVE_DAYS=7   # Воркер генерирует больше логов - короче хранение
WORKER_DELETE_DAYS=30   # Удаляем через месяц

SERVER_ARCHIVE_DAYS=30  # Серверные логи важнее - дольше храним
SERVER_DELETE_DAYS=90   # Удаляем через 3 месяца

echo "Starting log rotation at $(date)"

# === WORKER LOGS (короткое хранение) ===
echo "Processing worker logs..."

# Архивируем логи воркера старше 7 дней
find "$LOG_DIR" -name "worker-*.log" -type f -mtime +$WORKER_ARCHIVE_DAYS ! -name "*.gz" -exec gzip {} \;
echo "  - Archived worker logs older than $WORKER_ARCHIVE_DAYS days"

# Удаляем архивы воркера старше 30 дней
find "$LOG_DIR" -name "worker-*.log.gz" -type f -mtime +$WORKER_DELETE_DAYS -delete
echo "  - Deleted worker archives older than $WORKER_DELETE_DAYS days"

# === SERVER LOGS (длинное хранение) ===
echo "Processing server logs..."

# Архивируем логи сервера старше 30 дней
find "$LOG_DIR" -name "server-*.log" -type f -mtime +$SERVER_ARCHIVE_DAYS ! -name "*.gz" -exec gzip {} \;
echo "  - Archived server logs older than $SERVER_ARCHIVE_DAYS days"

# Удаляем архивы сервера старше 90 дней
find "$LOG_DIR" -name "server-*.log.gz" -type f -mtime +$SERVER_DELETE_DAYS -delete
echo "  - Deleted server archives older than $SERVER_DELETE_DAYS days"

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
