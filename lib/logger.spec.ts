import fs from 'fs';
import path from 'path';

const TEST_LOG_DIR = path.join(__dirname, '..', 'logs-test');

// Сохраняем оригинальные переменные окружения
const originalEnv = {
  LOG_DIR: process.env.LOG_DIR,
  LOG_TO_FILE: process.env.LOG_TO_FILE,
  NODE_ENV: process.env.NODE_ENV,
};

// Устанавливаем тестовое окружение ПЕРЕД импортом logger
process.env.LOG_DIR = TEST_LOG_DIR;
process.env.LOG_TO_FILE = 'true';

// Теперь импортируем logger с правильными переменными окружения
import { logger, workerLogger } from './logger';

describe('Logger', () => {
  // Настройка окружения перед всеми тестами
  beforeAll(() => {
    // Устанавливаем тестовое окружение
    process.env.LOG_DIR = TEST_LOG_DIR;
    process.env.LOG_TO_FILE = 'true';
    
    // Создаем тестовую директорию для логов
    if (!fs.existsSync(TEST_LOG_DIR)) {
      fs.mkdirSync(TEST_LOG_DIR, { recursive: true });
    }
  });

  // Очистка после каждого теста
  afterEach(() => {
    // Удаляем все файлы логов после каждого теста
    if (fs.existsSync(TEST_LOG_DIR)) {
      const files = fs.readdirSync(TEST_LOG_DIR);
      files.forEach(file => {
        fs.unlinkSync(path.join(TEST_LOG_DIR, file));
      });
    }
  });

  // Восстановление окружения после всех тестов
  afterAll(() => {
    // Удаляем тестовую директорию
    if (fs.existsSync(TEST_LOG_DIR)) {
      const files = fs.readdirSync(TEST_LOG_DIR);
      files.forEach(file => {
        fs.unlinkSync(path.join(TEST_LOG_DIR, file));
      });
      fs.rmdirSync(TEST_LOG_DIR);
    }
    
    // Восстанавливаем оригинальные переменные окружения
    if (originalEnv.LOG_DIR !== undefined) {
      process.env.LOG_DIR = originalEnv.LOG_DIR;
    } else {
      delete process.env.LOG_DIR;
    }
    
    if (originalEnv.LOG_TO_FILE !== undefined) {
      process.env.LOG_TO_FILE = originalEnv.LOG_TO_FILE;
    } else {
      delete process.env.LOG_TO_FILE;
    }
    
    if (originalEnv.NODE_ENV !== undefined) {
      Object.defineProperty(process.env, 'NODE_ENV', {
        value: originalEnv.NODE_ENV,
        writable: true,
        configurable: true
      });
    }
  });

  describe('Server Logger', () => {
    it('should create info log file with correct content', () => {
      const testMessage = 'Test info message';
      const testContext = { videoId: 'test_123', action: 'create' };
      
      logger.info(testMessage, testContext);
      
      // Получаем имя файла логов для текущей даты
      const date = new Date().toISOString().split('T')[0];
      const logFile = path.join(TEST_LOG_DIR, `server-info-${date}.log`);
      
      // Проверяем, что файл создан
      expect(fs.existsSync(logFile)).toBe(true);
      
      // Читаем содержимое файла
      const content = fs.readFileSync(logFile, 'utf8');
      
      // Проверяем содержимое
      expect(content).toContain(testMessage);
      expect(content).toContain('[SERVER]');
      expect(content).toContain('INFO:');
      expect(content).toContain('test_123'); // videoId не маскируется (не в PII полях)
      expect(content).toContain('create');
    });

    it('should create error log file with correct content', () => {
      const testMessage = 'Test error message';
      const testContext = { 
        videoId: 'error_456', 
        error: 'Timeout occurred',
        userId: 'user_test_789'
      };
      
      logger.error(testMessage, testContext);
      
      const date = new Date().toISOString().split('T')[0];
      const errorLogFile = path.join(TEST_LOG_DIR, `server-error-${date}.log`);
      const combinedLogFile = path.join(TEST_LOG_DIR, `server-combined-${date}.log`);
      
      // Проверяем, что файлы созданы
      expect(fs.existsSync(errorLogFile)).toBe(true);
      expect(fs.existsSync(combinedLogFile)).toBe(true);
      
      // Читаем содержимое
      const errorContent = fs.readFileSync(errorLogFile, 'utf8');
      const combinedContent = fs.readFileSync(combinedLogFile, 'utf8');
      
      // Проверяем error файл
      expect(errorContent).toContain(testMessage);
      expect(errorContent).toContain('[SERVER]');
      expect(errorContent).toContain('ERROR:');
      expect(errorContent).toContain('Timeout occurred');
      
      // Проверяем, что ошибка также записана в combined файл
      expect(combinedContent).toContain(testMessage);
      expect(combinedContent).toContain('ERROR:');
    });

    it('should create warn log file with correct content', () => {
      const testMessage = 'Test warning message';
      const testContext = { latency: 500, threshold: 200 };
      
      logger.warn(testMessage, testContext);
      
      const date = new Date().toISOString().split('T')[0];
      const warnLogFile = path.join(TEST_LOG_DIR, `server-warn-${date}.log`);
      const combinedLogFile = path.join(TEST_LOG_DIR, `server-combined-${date}.log`);
      
      // Проверяем, что файлы созданы
      expect(fs.existsSync(warnLogFile)).toBe(true);
      expect(fs.existsSync(combinedLogFile)).toBe(true);
      
      // Читаем содержимое
      const warnContent = fs.readFileSync(warnLogFile, 'utf8');
      
      // Проверяем содержимое
      expect(warnContent).toContain(testMessage);
      expect(warnContent).toContain('[SERVER]');
      expect(warnContent).toContain('WARN:');
      expect(warnContent).toContain('500');
    });

    it('should not log debug messages in production mode', () => {
      // Logger уже инициализирован в production режиме по умолчанию
      const testMessage = 'Test debug message in production';
      logger.debug(testMessage);
      
      const date = new Date().toISOString().split('T')[0];
      const debugLogFile = path.join(TEST_LOG_DIR, `server-debug-${date}.log`);
      
      // В production режиме debug файл не должен создаться
      expect(fs.existsSync(debugLogFile)).toBe(false);
    });

    it('should redact PII data in logs', () => {
      const testContext = {
        userId: 'user_1234567890',
        email: 'test@example.com',
        token: 'secret_token_xyz',
        publicData: 'this is public'
      };
      
      logger.info('Test PII redaction', testContext);
      
      const date = new Date().toISOString().split('T')[0];
      const logFile = path.join(TEST_LOG_DIR, `server-info-${date}.log`);
      const content = fs.readFileSync(logFile, 'utf8');
      
      // Проверяем, что PII данные замаскированы
      expect(content).toContain('user***');
      expect(content).toContain('test***');
      expect(content).toContain('secr***');
      expect(content).toContain('this is public');
      
      // Проверяем, что полные данные НЕ присутствуют
      expect(content).not.toContain('user_1234567890');
      expect(content).not.toContain('test@example.com');
      expect(content).not.toContain('secret_token_xyz');
    });
  });

  describe('Worker Logger', () => {
    it('should create worker info log file with [WORKER] tag', () => {
      const testMessage = 'Worker processing job';
      const testContext = { jobId: 'job_123', videoId: 'video_456' };
      
      workerLogger.info(testMessage, testContext);
      
      const date = new Date().toISOString().split('T')[0];
      const logFile = path.join(TEST_LOG_DIR, `worker-info-${date}.log`);
      
      // Проверяем, что файл создан
      expect(fs.existsSync(logFile)).toBe(true);
      
      // Читаем содержимое
      const content = fs.readFileSync(logFile, 'utf8');
      
      // Проверяем содержимое
      expect(content).toContain(testMessage);
      expect(content).toContain('[WORKER]');
      expect(content).toContain('INFO:');
      expect(content).not.toContain('[SERVER]');
    });

    it('should create worker error log with correct structure', () => {
      const testMessage = 'Worker job failed';
      const testContext = { jobId: 'job_error', error: 'Processing timeout' };
      
      workerLogger.error(testMessage, testContext);
      
      const date = new Date().toISOString().split('T')[0];
      const errorLogFile = path.join(TEST_LOG_DIR, `worker-error-${date}.log`);
      const combinedLogFile = path.join(TEST_LOG_DIR, `worker-combined-${date}.log`);
      
      // Проверяем файлы
      expect(fs.existsSync(errorLogFile)).toBe(true);
      expect(fs.existsSync(combinedLogFile)).toBe(true);
      
      const errorContent = fs.readFileSync(errorLogFile, 'utf8');
      
      // Проверяем содержимое
      expect(errorContent).toContain('[WORKER]');
      expect(errorContent).toContain('ERROR:');
      expect(errorContent).toContain('Processing timeout');
    });
  });

  describe('Log Format', () => {
    it('should include timestamp in ISO format', () => {
      logger.info('Test timestamp');
      
      const date = new Date().toISOString().split('T')[0];
      const logFile = path.join(TEST_LOG_DIR, `server-info-${date}.log`);
      const content = fs.readFileSync(logFile, 'utf8');
      
      // Проверяем формат timestamp: [2025-10-05T12:34:56.789Z]
      const timestampRegex = /\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\]/;
      expect(timestampRegex.test(content)).toBe(true);
    });

    it('should format context as JSON', () => {
      const testContext = { key1: 'value1', key2: 123, key3: true };
      logger.info('Test JSON format', testContext);
      
      const date = new Date().toISOString().split('T')[0];
      const logFile = path.join(TEST_LOG_DIR, `server-info-${date}.log`);
      const content = fs.readFileSync(logFile, 'utf8');
      
      // Проверяем, что контекст в формате JSON
      expect(content).toContain('"key1":"value1"');
      expect(content).toContain('"key2":123');
      expect(content).toContain('"key3":true');
    });
  });

  describe('Multiple Logs', () => {
    it('should append logs to the same file on the same day', () => {
      logger.info('First log message');
      logger.info('Second log message');
      logger.info('Third log message');
      
      const date = new Date().toISOString().split('T')[0];
      const logFile = path.join(TEST_LOG_DIR, `server-info-${date}.log`);
      const content = fs.readFileSync(logFile, 'utf8');
      
      // Разбиваем на строки
      const lines = content.trim().split('\n');
      
      // Проверяем, что все три сообщения присутствуют
      expect(lines.length).toBe(3);
      expect(content).toContain('First log message');
      expect(content).toContain('Second log message');
      expect(content).toContain('Third log message');
    });
  });
});
