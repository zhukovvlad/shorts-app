import type { RedisOptions } from 'ioredis';
import { logger } from '@/lib/logger';

/**
 * Создает конфигурацию для подключения к Redis
 * Используется во всех местах приложения для консистентности
 */
export function createRedisConfig(): RedisOptions {
  const host = process.env.TIMEWEB_REDIS_HOST;
  const username = process.env.TIMEWEB_REDIS_USERNAME;
  const password = process.env.TIMEWEB_REDIS_PASSWORD;
  
  // Валидируем порт
  let port = 6379; // Значение по умолчанию
  if (process.env.TIMEWEB_REDIS_PORT) {
    const parsedPort = parseInt(process.env.TIMEWEB_REDIS_PORT, 10);
    if (!isNaN(parsedPort) && parsedPort > 0 && parsedPort <= 65535) {
      port = parsedPort;
    } else {
      logger.warn('Invalid TIMEWEB_REDIS_PORT, falling back to 6379', { 
        providedPort: process.env.TIMEWEB_REDIS_PORT 
      });
    }
  }

  return {
    host,
    port,
    username,
    password,
    maxRetriesPerRequest: null,
  };
}

/**
 * Валидирует наличие обязательных переменных окружения для Redis
 * @throws Error если обязательные переменные не установлены
 */
export function validateRedisConfig(): void {
  const host = process.env.TIMEWEB_REDIS_HOST;
  const password = process.env.TIMEWEB_REDIS_PASSWORD;
  const username = process.env.TIMEWEB_REDIS_USERNAME;

  if (!host || !password) {
    logger.error('Missing required Redis configuration', {
      host: host ? '[SET]' : '[NOT SET]',
      username: username ? '[SET]' : '[NOT SET]',
      password: password ? '[SET]' : '[NOT SET]'
    });
    throw new Error('TIMEWEB_REDIS_HOST and TIMEWEB_REDIS_PASSWORD must be set for Redis functionality');
  }

  // Username является опциональным для Redis без ACL
  // Но для Timeweb Redis с ACL он обязателен
  if (username && !password) {
    logger.warn('Redis username provided but password is missing');
  }
}
