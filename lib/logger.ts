import path from 'path';

// Импортируем fs только на сервере (не в браузере)
const fs = typeof window === 'undefined' ? require('fs') : null;

type LogLevel = 'debug' | 'info' | 'warn' | 'error';
type LogSource = 'server' | 'worker';

interface LogContext {
  [key: string]: any;
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development';
  private isProduction = process.env.NODE_ENV === 'production';
  private logDir = process.env.LOG_DIR || './logs';
  private logToFile = process.env.LOG_TO_FILE === 'true';
  private source: LogSource;
  
  constructor(source: LogSource = 'server') {
    this.source = source;
    // Создаем директорию для логов если включено файловое логирование
    if (this.logToFile && typeof window === 'undefined') {
      this.ensureLogDirectory();
    }
  }
  
  private ensureLogDirectory(): void {
    if (!fs) return; // Пропускаем в браузере
    
    try {
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true });
      }
    } catch (error) {
      console.error('Failed to create log directory:', error);
    }
  }
  
  private getLogFileName(level: LogLevel): string {
    const date = new Date().toISOString().split('T')[0];
    return path.join(this.logDir, `${this.source}-${level}-${date}.log`);
  }
  
  private writeToFile(level: LogLevel, formattedLog: string): void {
    if (!this.logToFile || typeof window !== 'undefined' || !fs) return;
    
    try {
      const logFile = this.getLogFileName(level);
      fs.appendFileSync(logFile, formattedLog + '\n', 'utf8');
      
      // Также пишем все error и warn логи в отдельный combined файл для конкретного источника
      if (level === 'error' || level === 'warn') {
        const combinedFile = path.join(this.logDir, `${this.source}-combined-${new Date().toISOString().split('T')[0]}.log`);
        fs.appendFileSync(combinedFile, formattedLog + '\n', 'utf8');
      }
    } catch (error) {
      console.error('Failed to write log to file:', error);
    }
  }
  
  private formatLog(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const sourceTag = `[${this.source.toUpperCase()}]`;
    const contextStr = context ? ` ${JSON.stringify(context)}` : '';
    return `[${timestamp}] ${sourceTag} ${level.toUpperCase()}: ${message}${contextStr}`;
  }

  private redactPII(context: LogContext): LogContext {
    const redacted = { ...context };
    
    // Список полей, которые могут содержать PII
    const piiFields = ['userId', 'email', 'username', 'id', 'ip', 'token'];
    
    piiFields.forEach(field => {
      if (redacted[field]) {
        if (typeof redacted[field] === 'string') {
          // Показываем только первые 4 символа для ID
          redacted[field] = redacted[field].length > 4 
            ? `${redacted[field].substring(0, 4)}***` 
            : '***';
        } else {
          redacted[field] = '[REDACTED]';
        }
      }
    });

    return redacted;
  }

  debug(message: string, context?: LogContext): void {
    if (!this.isDevelopment) return;
    
    const safeContext = context ? this.redactPII(context) : undefined;
    const formatted = this.formatLog('debug', message, safeContext);
    console.debug(formatted);
    this.writeToFile('debug', formatted);
  }

  info(message: string, context?: LogContext): void {
    const safeContext = context ? this.redactPII(context) : undefined;
    const formatted = this.formatLog('info', message, safeContext);
    console.info(formatted);
    this.writeToFile('info', formatted);
  }

  warn(message: string, context?: LogContext): void {
    const safeContext = context ? this.redactPII(context) : undefined;
    const formatted = this.formatLog('warn', message, safeContext);
    console.warn(formatted);
    this.writeToFile('warn', formatted);
  }

  error(message: string, context?: LogContext): void {
    const safeContext = context ? this.redactPII(context) : undefined;
    const formatted = this.formatLog('error', message, safeContext);
    console.error(formatted);
    this.writeToFile('error', formatted);
  }
}

export const logger = new Logger('server');
export const workerLogger = new Logger('worker');