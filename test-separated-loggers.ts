// Тестирование разделенных логгеров (сервер vs воркер)

import { logger, workerLogger } from './lib/logger';

console.log('=== Testing Separated Loggers ===\n');

// Тест серверного логгера
console.log('1. Testing SERVER logger:');
logger.info('Server started', { port: 3000, env: 'development' });
logger.info('User logged in', { userId: 'user_12345678', email: 'test@example.com' });
logger.warn('High memory usage', { usage: '85%', threshold: '80%' });
logger.error('Database connection failed', { 
  error: 'Connection timeout',
  host: 'localhost',
  port: 5432
});

console.log('\n2. Testing WORKER logger:');
// Тест воркерного логгера
workerLogger.info('Worker started', { concurrency: 5, queue: 'video-processing' });
workerLogger.info('Job started', { jobId: '123', videoId: 'video_abc123', userId: 'user_98765432' });
workerLogger.info('Processing step completed', { 
  videoId: 'video_abc123', 
  step: 'script',
  duration: 1234
});
workerLogger.warn('Retry attempt', { 
  jobId: '123',
  attempt: 2,
  maxRetries: 3
});
workerLogger.error('Job failed', { 
  jobId: '123',
  videoId: 'video_abc123',
  error: 'API timeout',
  step: 'render'
});

console.log('\n=== Test completed ===');
console.log('\nCheck logs directory:');
console.log('  - logs/server-info-*.log');
console.log('  - logs/server-error-*.log');
console.log('  - logs/server-combined-*.log');
console.log('  - logs/worker-info-*.log');
console.log('  - logs/worker-error-*.log');
console.log('  - logs/worker-combined-*.log');
