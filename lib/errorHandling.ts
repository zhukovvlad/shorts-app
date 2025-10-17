/**
 * Centralized error handling utilities
 * Provides consistent error handling across the application
 */

import { RETRYABLE_ERROR_PATTERNS } from '@/app/constants/video';
import { ValidationError } from './validation';

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
 * Handles axios, got, node, and standard error patterns
 */
export function getErrorCode(error: unknown): string | undefined {
  // Standard error.code (string)
  if (hasErrorProperty(error, 'code') && typeof error.code === 'string') {
    return error.code;
  }
  
  // Direct error.status (number)
  if (hasErrorProperty(error, 'status') && typeof error.status === 'number') {
    return String(error.status);
  }
  
  // axios pattern: error.response.status
  if (hasErrorProperty(error, 'response')) {
    const resp = (error as Record<string, unknown>).response;
    if (hasErrorProperty(resp, 'status') && typeof (resp as any).status === 'number') {
      return String((resp as any).status);
    }
  }
  
  // node/got pattern: error.statusCode
  if (hasErrorProperty(error, 'statusCode') && typeof (error as any).statusCode === 'number') {
    return String((error as any).statusCode);
  }
  
  return undefined;
}

/**
 * Checks if an error is a network-related error that should be retried
 * Uses centralized patterns from app/constants/video.ts
 */
export function isNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  
  // Check for AbortError (e.g., from AbortController)
  if (error.name === 'AbortError') return false;
  
  const message = error.message.toLowerCase();
  
  // Use centralized retryable patterns
  return RETRYABLE_ERROR_PATTERNS.some(pattern => 
    message.includes(pattern.toLowerCase())
  );
}

/**
 * Checks if an error is an authentication error
 * Considers HTTP status codes 401/403 and message patterns
 */
export function isAuthError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  
  const message = error.message.toLowerCase();
  const code = getErrorCode(error);
  
  // Check HTTP auth status codes
  if (code === '401' || code === '403') return true;
  
  // Check message patterns
  return (
    message.includes('not authenticated') ||
    message.includes('unauthorized') ||
    message.includes('authentication')
  );
}

/**
 * Extracts a user-friendly error message from an error object
 * Returns ValidationError messages as-is since they are already user-friendly
 */
export function getUserFriendlyErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return 'An unexpected error occurred';
  }
  
  // Return ValidationError messages directly (already user-friendly)
  if (error instanceof ValidationError || error.name === 'ValidationError') {
    return error.message;
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
 * Guards against metadata serialization failures and provides production sink placeholder
 */
export function logError(
  context: string,
  error: unknown,
  metadata?: Record<string, unknown>
) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;
  
  // Safely serialize metadata to avoid JSON.stringify failures
  const metaSafe = (() => {
    try {
      return metadata && JSON.parse(JSON.stringify(metadata));
    } catch {
      return '[unserializable metadata]';
    }
  })();
  
  if (process.env.NODE_ENV !== 'production') {
    console.error(`[${context}]`, errorMessage, metaSafe, errorStack);
  } else {
    // TODO: Forward to configured logger (e.g., Sentry, Datadog) with PII redaction
    // Example: Sentry.captureException(error, { contexts: { custom: metaSafe } });
    console.error(`[${context}]`, errorMessage); // Fallback for production
  }
}
