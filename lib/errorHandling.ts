/**
 * Centralized error handling utilities
 * Provides consistent error handling across the application
 */

/**
 * Checks if an error is a network-related error that should be retried
 */
export function isNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  
  const message = error.message.toLowerCase();
  const networkPatterns = [
    'fetch failed',
    'network error',
    'connection refused',
    'timeout',
    'econnreset',
    'enotfound',
    'etimedout',
  ];
  
  return networkPatterns.some(pattern => message.includes(pattern));
}

/**
 * Checks if an error is an authentication error
 */
export function isAuthError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  
  const message = error.message.toLowerCase();
  return message.includes('not authenticated') || 
         message.includes('unauthorized') ||
         message.includes('authentication');
}

/**
 * Extracts a user-friendly error message from an error object
 */
export function getUserFriendlyErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return 'An unexpected error occurred';
  }
  
  const message = error.message.toLowerCase();
  
  if (isAuthError(error)) {
    return 'Authentication required. Please sign in again.';
  }
  
  if (isNetworkError(error)) {
    return 'Network error. Please check your connection and try again.';
  }
  
  if (message.includes('insufficient credits')) {
    return 'Insufficient credits. Please purchase more credits to continue.';
  }
  
  if (message.includes('prompt')) {
    return error.message; // Return original message for prompt validation errors
  }
  
  // Generic error message
  return 'An error occurred. Please try again.';
}

/**
 * Logs an error with context
 */
export function logError(
  context: string,
  error: unknown,
  metadata?: Record<string, unknown>
) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;
  
  if (process.env.NODE_ENV === 'development') {
    console.error(`[${context}]`, errorMessage, metadata, errorStack);
  }
  
  // In production, you might want to send to an error tracking service
  // like Sentry, LogRocket, etc.
}

/**
 * Type guard to check if error has a specific property
 */
export function hasErrorProperty<K extends string>(
  error: unknown,
  property: K
): error is Record<K, unknown> {
  return typeof error === 'object' && error !== null && property in error;
}

/**
 * Safely extracts error code from various error types
 */
export function getErrorCode(error: unknown): string | undefined {
  if (hasErrorProperty(error, 'code') && typeof error.code === 'string') {
    return error.code;
  }
  
  if (hasErrorProperty(error, 'status') && typeof error.status === 'number') {
    return String(error.status);
  }
  
  return undefined;
}
