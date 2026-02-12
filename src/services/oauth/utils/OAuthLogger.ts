/**
 * OAuth Logger - Security-aware logging and monitoring for OAuth operations
 * Provides comprehensive logging without exposing sensitive information
 * Requirements: 7.3, 7.5
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  SECURITY = 4
}

export enum OAuthOperation {
  // Authentication flow operations
  FLOW_INITIATED = 'flow_initiated',
  BROWSER_LAUNCHED = 'browser_launched',
  CALLBACK_RECEIVED = 'callback_received',
  TOKEN_EXCHANGE = 'token_exchange',
  AUTHENTICATION_SUCCESS = 'authentication_success',
  AUTHENTICATION_FAILED = 'authentication_failed',

  // Token management operations
  TOKEN_STORED = 'token_stored',
  TOKEN_RETRIEVED = 'token_retrieved',
  TOKEN_REFRESHED = 'token_refreshed',
  TOKEN_REFRESH_FAILED = 'token_refresh_failed',
  TOKEN_VALIDATED = 'token_validated',
  TOKEN_EXPIRED = 'token_expired',
  TOKEN_DELETED = 'token_deleted',

  // Server operations
  CALLBACK_SERVER_STARTED = 'callback_server_started',
  CALLBACK_SERVER_STOPPED = 'callback_server_stopped',
  CALLBACK_SERVER_ERROR = 'callback_server_error',

  // Security operations
  STATE_GENERATED = 'state_generated',
  STATE_VALIDATED = 'state_validated',
  PKCE_GENERATED = 'pkce_generated',
  CSRF_DETECTED = 'csrf_detected',
  INVALID_CALLBACK = 'invalid_callback',

  // Provider operations
  PROVIDER_REGISTERED = 'provider_registered',
  PROVIDER_CONFIG_UPDATED = 'provider_config_updated',

  // Error and cleanup operations
  CLEANUP_STARTED = 'cleanup_started',
  CLEANUP_COMPLETED = 'cleanup_completed',
  RESOURCE_LEAK_DETECTED = 'resource_leak_detected',

  // Performance operations
  OPERATION_TIMED = 'operation_timed',
  RETRY_ATTEMPTED = 'retry_attempted'
}

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  operation: OAuthOperation;
  provider?: string;
  flowId?: string;
  message: string;
  metadata?: Record<string, any>;
  duration?: number; // milliseconds
  error?: {
    type: string;
    message: string;
    stack?: string;
  };
  performance?: {
    startTime: number;
    endTime: number;
    duration: number;
  };
}

export interface OAuthMetrics {
  totalOperations: number;
  successfulAuthentications: number;
  failedAuthentications: number;
  tokenRefreshes: number;
  averageAuthTime: number;
  errorsByType: Record<string, number>;
  operationsByProvider: Record<string, number>;
  securityEvents: number;
  lastActivity: Date;
}

export interface LoggerConfig {
  level: LogLevel;
  enableConsoleOutput: boolean;
  enableFileLogging: boolean;
  enableMetrics: boolean;
  maxLogEntries: number;
  logFilePath?: string;
  sensitiveFields: string[];
  performanceThresholds: {
    authFlow: number; // milliseconds
    tokenRefresh: number;
    callbackResponse: number;
  };
}

/**
 * Security-aware OAuth logger that never exposes sensitive information
 */
export class OAuthLogger {
  private static instance: OAuthLogger | null = null;
  private config: LoggerConfig;
  private logEntries: LogEntry[] = [];
  private metrics: OAuthMetrics;
  private activeOperations: Map<string, { startTime: number; operation: OAuthOperation }> = new Map();

  private constructor(config?: Partial<LoggerConfig>) {
    this.config = {
      level: LogLevel.INFO,
      enableConsoleOutput: true,
      enableFileLogging: false,
      enableMetrics: true,
      maxLogEntries: 1000,
      sensitiveFields: [
        'access_token',
        'refresh_token',
        'authorization_code',
        'code',
        'client_secret',
        'password',
        'token',
        'bearer',
        'auth',
        'credential'
      ],
      performanceThresholds: {
        authFlow: 30000, // 30 seconds
        tokenRefresh: 10000, // 10 seconds
        callbackResponse: 5000 // 5 seconds
      },
      ...config
    };

    this.metrics = {
      totalOperations: 0,
      successfulAuthentications: 0,
      failedAuthentications: 0,
      tokenRefreshes: 0,
      averageAuthTime: 0,
      errorsByType: {},
      operationsByProvider: {},
      securityEvents: 0,
      lastActivity: new Date()
    };
  }

  /**
   * Get singleton instance of OAuth logger
   */
  static getInstance(config?: Partial<LoggerConfig>): OAuthLogger {
    if (!OAuthLogger.instance) {
      OAuthLogger.instance = new OAuthLogger(config);
    }
    return OAuthLogger.instance;
  }

  /**
   * Update logger configuration
   */
  updateConfig(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Log OAuth operation with security filtering
   */
  log(
    level: LogLevel,
    operation: OAuthOperation,
    message: string,
    metadata?: Record<string, any>,
    provider?: string,
    flowId?: string,
    error?: Error
  ): void {
    // Skip if log level is below configured threshold
    if (level < this.config.level) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      operation,
      provider,
      flowId,
      message,
      metadata: metadata ? this.sanitizeMetadata(metadata) : undefined,
      error: error ? {
        type: error.constructor.name,
        message: error.message,
        stack: level === LogLevel.DEBUG ? error.stack : undefined
      } : undefined
    };

    // Add to log entries with rotation
    this.addLogEntry(entry);

    // Update metrics
    if (this.config.enableMetrics) {
      this.updateMetrics(entry);
    }

    // Output to console if enabled
    if (this.config.enableConsoleOutput) {
      this.outputToConsole(entry);
    }

    // Write to file if enabled
    if (this.config.enableFileLogging && this.config.logFilePath) {
      this.writeToFile(entry);
    }
  }

  /**
   * Log debug information (development only)
   */
  debug(operation: OAuthOperation, message: string, metadata?: Record<string, any>, provider?: string, flowId?: string): void {
    this.log(LogLevel.DEBUG, operation, message, metadata, provider, flowId);
  }

  /**
   * Log informational messages
   */
  info(operation: OAuthOperation, message: string, metadata?: Record<string, any>, provider?: string, flowId?: string): void {
    this.log(LogLevel.INFO, operation, message, metadata, provider, flowId);
  }

  /**
   * Log warning messages
   */
  warn(operation: OAuthOperation, message: string, metadata?: Record<string, any>, provider?: string, flowId?: string): void {
    this.log(LogLevel.WARN, operation, message, metadata, provider, flowId);
  }

  /**
   * Log error messages
   */
  error(operation: OAuthOperation, message: string, error?: Error, metadata?: Record<string, any>, provider?: string, flowId?: string): void {
    this.log(LogLevel.ERROR, operation, message, metadata, provider, flowId, error);
  }

  /**
   * Log security events (always logged regardless of level)
   */
  security(operation: OAuthOperation, message: string, metadata?: Record<string, any>, provider?: string, flowId?: string): void {
    this.log(LogLevel.SECURITY, operation, message, metadata, provider, flowId);
  }

  /**
   * Start timing an operation
   */
  startTiming(operationId: string, operation: OAuthOperation): void {
    this.activeOperations.set(operationId, {
      startTime: Date.now(),
      operation
    });
  }

  /**
   * End timing an operation and log performance
   */
  endTiming(operationId: string, provider?: string, flowId?: string, metadata?: Record<string, any>): number {
    const activeOp = this.activeOperations.get(operationId);
    if (!activeOp) {
      this.warn(OAuthOperation.OPERATION_TIMED, `No active timing found for operation: ${operationId}`);
      return 0;
    }

    const endTime = Date.now();
    const duration = endTime - activeOp.startTime;

    // Remove from active operations
    this.activeOperations.delete(operationId);

    // Log performance
    const performanceMetadata = {
      ...metadata,
      duration,
      operationId,
      performance: {
        startTime: activeOp.startTime,
        endTime,
        duration
      }
    };

    // Check against performance thresholds
    const threshold = this.getPerformanceThreshold(activeOp.operation);
    if (threshold && duration > threshold) {
      this.warn(
        OAuthOperation.OPERATION_TIMED,
        `Operation ${activeOp.operation} exceeded threshold: ${duration}ms > ${threshold}ms`,
        performanceMetadata,
        provider,
        flowId
      );
    } else {
      this.debug(
        OAuthOperation.OPERATION_TIMED,
        `Operation ${activeOp.operation} completed in ${duration}ms`,
        performanceMetadata,
        provider,
        flowId
      );
    }

    return duration;
  }

  /**
   * Log retry attempt
   */
  logRetry(operation: OAuthOperation, attempt: number, maxRetries: number, error: Error, provider?: string, flowId?: string): void {
    this.info(
      OAuthOperation.RETRY_ATTEMPTED,
      `Retry attempt ${attempt}/${maxRetries} for ${operation}`,
      {
        attempt,
        maxRetries,
        errorType: error.constructor.name,
        errorMessage: error.message
      },
      provider,
      flowId
    );
  }

  /**
   * Get current metrics
   */
  getMetrics(): OAuthMetrics {
    return { ...this.metrics };
  }

  /**
   * Get recent log entries (sanitized)
   */
  getRecentLogs(count: number = 100): LogEntry[] {
    return this.logEntries.slice(-count).map(entry => ({
      ...entry,
      metadata: entry.metadata ? this.sanitizeMetadata(entry.metadata) : undefined
    }));
  }

  /**
   * Get logs for specific provider
   */
  getProviderLogs(provider: string, count: number = 100): LogEntry[] {
    return this.logEntries
      .filter(entry => entry.provider === provider)
      .slice(-count)
      .map(entry => ({
        ...entry,
        metadata: entry.metadata ? this.sanitizeMetadata(entry.metadata) : undefined
      }));
  }

  /**
   * Get security events
   */
  getSecurityEvents(count: number = 50): LogEntry[] {
    return this.logEntries
      .filter(entry => entry.level === LogLevel.SECURITY)
      .slice(-count);
  }

  /**
   * Clear all logs and reset metrics
   */
  clear(): void {
    this.logEntries = [];
    this.metrics = {
      totalOperations: 0,
      successfulAuthentications: 0,
      failedAuthentications: 0,
      tokenRefreshes: 0,
      averageAuthTime: 0,
      errorsByType: {},
      operationsByProvider: {},
      securityEvents: 0,
      lastActivity: new Date()
    };
  }

  /**
   * Export logs for debugging (with sensitive data removed)
   */
  exportLogs(): string {
    const exportData = {
      timestamp: new Date().toISOString(),
      config: {
        level: this.config.level,
        enableMetrics: this.config.enableMetrics,
        maxLogEntries: this.config.maxLogEntries
      },
      metrics: this.metrics,
      logs: this.getRecentLogs(this.config.maxLogEntries)
    };

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Sanitize metadata to remove sensitive information
   */
  private sanitizeMetadata(metadata: Record<string, any>): Record<string, any> {
    const sanitized: Record<string, any> = {};

    for (const [key, value] of Object.entries(metadata)) {
      const lowerKey = key.toLowerCase();

      // Check if key contains sensitive information
      const isSensitive = this.config.sensitiveFields.some(field =>
        lowerKey.includes(field.toLowerCase())
      );

      if (isSensitive) {
        if (typeof value === 'string') {
          // Show only first and last 4 characters for strings
          sanitized[key] = value.length > 8
            ? `${value.substring(0, 4)}...${value.substring(value.length - 4)}`
            : '[REDACTED]';
        } else {
          sanitized[key] = '[REDACTED]';
        }
      } else if (typeof value === 'object' && value !== null) {
        // Recursively sanitize nested objects
        sanitized[key] = this.sanitizeMetadata(value);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Add log entry with rotation
   */
  private addLogEntry(entry: LogEntry): void {
    this.logEntries.push(entry);

    // Rotate logs if we exceed max entries
    if (this.logEntries.length > this.config.maxLogEntries) {
      this.logEntries = this.logEntries.slice(-this.config.maxLogEntries);
    }
  }

  /**
   * Update metrics based on log entry
   */
  private updateMetrics(entry: LogEntry): void {
    this.metrics.totalOperations++;
    this.metrics.lastActivity = entry.timestamp;

    // Update operation counts by provider
    if (entry.provider) {
      this.metrics.operationsByProvider[entry.provider] =
        (this.metrics.operationsByProvider[entry.provider] || 0) + 1;
    }

    // Update specific operation metrics
    switch (entry.operation) {
      case OAuthOperation.AUTHENTICATION_SUCCESS:
        this.metrics.successfulAuthentications++;
        if (entry.performance) {
          this.updateAverageAuthTime(entry.performance.duration);
        }
        break;

      case OAuthOperation.AUTHENTICATION_FAILED:
        this.metrics.failedAuthentications++;
        break;

      case OAuthOperation.TOKEN_REFRESHED:
        this.metrics.tokenRefreshes++;
        break;

      case OAuthOperation.CSRF_DETECTED:
      case OAuthOperation.INVALID_CALLBACK:
        this.metrics.securityEvents++;
        break;
    }

    // Update error counts
    if (entry.error) {
      this.metrics.errorsByType[entry.error.type] =
        (this.metrics.errorsByType[entry.error.type] || 0) + 1;
    }
  }

  /**
   * Update average authentication time
   */
  private updateAverageAuthTime(duration: number): void {
    const currentAvg = this.metrics.averageAuthTime;
    const count = this.metrics.successfulAuthentications;

    // Calculate running average
    this.metrics.averageAuthTime = ((currentAvg * (count - 1)) + duration) / count;
  }

  /**
   * Output log entry to console
   */
  private outputToConsole(entry: LogEntry): void {
    const timestamp = entry.timestamp.toISOString();
    const level = LogLevel[entry.level];
    const provider = entry.provider ? `[${entry.provider}]` : '';
    const flowId = entry.flowId ? `[${entry.flowId}]` : '';

    const prefix = `[${timestamp}] [${level}] [OAuth${provider}${flowId}]`;
    const message = `${prefix} ${entry.operation}: ${entry.message}`;

    switch (entry.level) {
      case LogLevel.DEBUG:
        console.debug(message, entry.metadata);
        break;
      case LogLevel.INFO:
        // console.info(message, entry.metadata);
        break;
      case LogLevel.WARN:
        console.warn(message, entry.metadata);
        break;
      case LogLevel.ERROR:
      case LogLevel.SECURITY:
        console.error(message, entry.error || entry.metadata);
        break;
    }
  }

  /**
   * Write log entry to file (placeholder - would need file system implementation)
   */
  private writeToFile(entry: LogEntry): void {
    // This would be implemented with actual file writing in a real application
    // For now, we'll just track that file logging was requested
    if (entry.level >= LogLevel.WARN) {
      // Only write warnings and errors to file to avoid spam
      const logLine = JSON.stringify({
        timestamp: entry.timestamp.toISOString(),
        level: LogLevel[entry.level],
        operation: entry.operation,
        provider: entry.provider,
        flowId: entry.flowId,
        message: entry.message,
        metadata: entry.metadata,
        error: entry.error
      });

      // In a real implementation, this would append to the log file
      // fs.appendFileSync(this.config.logFilePath!, logLine + '\n');
    }
  }

  /**
   * Get performance threshold for operation
   */
  private getPerformanceThreshold(operation: OAuthOperation): number | undefined {
    switch (operation) {
      case OAuthOperation.FLOW_INITIATED:
      case OAuthOperation.AUTHENTICATION_SUCCESS:
      case OAuthOperation.AUTHENTICATION_FAILED:
        return this.config.performanceThresholds.authFlow;

      case OAuthOperation.TOKEN_REFRESHED:
      case OAuthOperation.TOKEN_REFRESH_FAILED:
        return this.config.performanceThresholds.tokenRefresh;

      case OAuthOperation.CALLBACK_RECEIVED:
        return this.config.performanceThresholds.callbackResponse;

      default:
        return undefined;
    }
  }
}

/**
 * Convenience function to get the OAuth logger instance
 */
export function getOAuthLogger(config?: Partial<LoggerConfig>): OAuthLogger {
  return OAuthLogger.getInstance(config);
}

/**
 * Generate a unique flow ID for tracking OAuth operations
 */
export function generateFlowId(): string {
  return `oauth_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}