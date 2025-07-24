/**
 * Comprehensive logging utility for Mattermost integration
 * Provides structured logging for both server-side and client-side components
 */

export enum LogLevel {
  ERROR = 'ERROR',
  WARN = 'WARN',
  INFO = 'INFO',
  DEBUG = 'DEBUG'
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  component: string;
  userId?: string;
  sessionId?: string;
  message: string;
  data?: any;
}

export class Logger {
  private static instance: Logger;
  private component: string;
  private isServer: boolean;

  constructor(component: string) {
    this.component = component;
    this.isServer = typeof window === 'undefined';
  }

  static getInstance(component: string): Logger {
    return new Logger(component);
  }

  private formatLog(level: LogLevel, message: string, data?: any, userId?: string, sessionId?: string): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      component: this.component,
      userId,
      sessionId,
      message,
      data
    };
  }

  private output(logEntry: LogEntry): void {
    const prefix = `[${logEntry.timestamp}] [${logEntry.level}] [${logEntry.component}]`;
    const userInfo = logEntry.userId ? ` [USER:${logEntry.userId}]` : '';
    const sessionInfo = logEntry.sessionId ? ` [SESSION:${logEntry.sessionId}]` : '';
    const fullMessage = `${prefix}${userInfo}${sessionInfo} ${logEntry.message}`;

    if (this.isServer) {
      // Server-side logging
      console.log(fullMessage, logEntry.data || '');
    } else {
      // Browser console logging with appropriate console methods
      switch (logEntry.level) {
        case LogLevel.ERROR:
          console.error(fullMessage, logEntry.data || '');
          break;
        case LogLevel.WARN:
          console.warn(fullMessage, logEntry.data || '');
          break;
        case LogLevel.INFO:
          console.info(fullMessage, logEntry.data || '');
          break;
        case LogLevel.DEBUG:
          console.debug(fullMessage, logEntry.data || '');
          break;
      }
    }
  }

  error(message: string, data?: any, userId?: string, sessionId?: string): void {
    const logEntry = this.formatLog(LogLevel.ERROR, message, data, userId, sessionId);
    this.output(logEntry);
  }

  warn(message: string, data?: any, userId?: string, sessionId?: string): void {
    const logEntry = this.formatLog(LogLevel.WARN, message, data, userId, sessionId);
    this.output(logEntry);
  }

  info(message: string, data?: any, userId?: string, sessionId?: string): void {
    const logEntry = this.formatLog(LogLevel.INFO, message, data, userId, sessionId);
    this.output(logEntry);
  }

  debug(message: string, data?: any, userId?: string, sessionId?: string): void {
    // Only show debug logs in development or when explicitly enabled
    if (process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_DEBUG_WEBSOCKET === 'true') {
      const logEntry = this.formatLog(LogLevel.DEBUG, message, data, userId, sessionId);
      this.output(logEntry);
    }
  }

  // Specialized logging methods for different types of operations
  apiCall(method: string, url: string, status?: number, duration?: number, userId?: string): void {
    this.info(`API ${method} ${url}`, {
      method,
      url,
      status,
      duration_ms: duration
    }, userId);
  }

  websocketEvent(event: string, eventData?: any, userId?: string): void {
    this.debug(`WebSocket event: ${event}`, {
      event,
      data: eventData
    }, userId);
  }

  databaseOperation(operation: string, table: string, success: boolean, duration?: number, error?: any): void {
    const level = success ? LogLevel.INFO : LogLevel.ERROR;
    const message = `Database ${operation} on ${table}: ${success ? 'SUCCESS' : 'FAILED'}`;
    
    if (success) {
      this.info(message, { operation, table, duration_ms: duration });
    } else {
      this.error(message, { operation, table, error, duration_ms: duration });
    }
  }

  performanceMetric(metric: string, value: number, unit: string = 'ms', userId?: string): void {
    this.info(`Performance metric: ${metric}`, {
      metric,
      value,
      unit
    }, userId);
  }

  userAction(action: string, details?: any, userId?: string, sessionId?: string): void {
    this.info(`User action: ${action}`, {
      action,
      details
    }, userId, sessionId);
  }

  systemEvent(event: string, details?: any): void {
    this.info(`System event: ${event}`, {
      event,
      details
    });
  }

  integrationEvent(integration: string, event: string, success: boolean, details?: any): void {
    const level = success ? LogLevel.INFO : LogLevel.ERROR;
    const message = `${integration} integration: ${event} - ${success ? 'SUCCESS' : 'FAILED'}`;
    
    if (success) {
      this.info(message, { integration, event, details });
    } else {
      this.error(message, { integration, event, details });
    }
  }
}

// Pre-configured loggers for different components
export const mattermostLogger = Logger.getInstance('MATTERMOST');
export const websocketLogger = Logger.getInstance('WEBSOCKET');
export const apiLogger = Logger.getInstance('API');
export const databaseLogger = Logger.getInstance('DATABASE');
export const dashboardLogger = Logger.getInstance('DASHBOARD');
export const botLogger = Logger.getInstance('BOT');
export const webhookLogger = Logger.getInstance('WEBHOOK');
export const metricsLogger = Logger.getInstance('METRICS');

export default Logger;