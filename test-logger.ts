import { logger } from './lib/logger';

// Тестируем все уровни логирования
console.log('=== Testing Logger ===\n');

logger.debug('Debug message - should only appear in development', { 
  debugInfo: 'some debug data' 
});

logger.info('Info message - video processing started', { 
  videoId: 'video_test_123456789',
  userId: 'user_abc123',
  action: 'create'
});

logger.warn('Warning message - Redis connection slow', { 
  latency: 500,
  threshold: 200
});

logger.error('Error message - failed to process video', { 
  videoId: 'video_error_999',
  userId: 'user_error_123',
  error: 'Timeout after 30s',
  critical: true
});

console.log('\n=== Test Complete ===');
console.log('Check logs/ directory for output files');
