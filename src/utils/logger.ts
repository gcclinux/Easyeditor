/**
 * Conditional Logger Utility
 * 
 * Wraps console.log/warn/error with a check against the VITE_LOGGING environment variable.
 * Logging is suppressed unless VITE_LOGGING is explicitly set to "true" in .env.local.
 */

const isLoggingEnabled = (): boolean => {
  try {
    return import.meta.env.VITE_LOGGING === 'true';
  } catch {
    return false;
  }
};

/**
 * Creates a scoped logger for a specific module/component.
 * All output is suppressed unless VITE_LOGGING=true.
 */
export function createLogger(prefix: string) {
  return {
    log: (...args: any[]) => {
      if (isLoggingEnabled()) {
        console.log(`[${prefix}]`, ...args);
      }
    },
    warn: (...args: any[]) => {
      if (isLoggingEnabled()) {
        console.warn(`[${prefix}]`, ...args);
      }
    },
    error: (...args: any[]) => {
      if (isLoggingEnabled()) {
        console.error(`[${prefix}]`, ...args);
      }
    },
  };
}
