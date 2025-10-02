type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: any;
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development';
  
  private formatLog(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const contextStr = context ? ` ${JSON.stringify(context)}` : '';
    return `[${timestamp}] ${level.toUpperCase()}: ${message}${contextStr}`;
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
    console.debug(this.formatLog('debug', message, safeContext));
  }

  info(message: string, context?: LogContext): void {
    const safeContext = context ? this.redactPII(context) : undefined;
    console.info(this.formatLog('info', message, safeContext));
  }

  warn(message: string, context?: LogContext): void {
    const safeContext = context ? this.redactPII(context) : undefined;
    console.warn(this.formatLog('warn', message, safeContext));
  }

  error(message: string, context?: LogContext): void {
    const safeContext = context ? this.redactPII(context) : undefined;
    console.error(this.formatLog('error', message, safeContext));
  }
}

export const logger = new Logger();