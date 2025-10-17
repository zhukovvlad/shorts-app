/**
 * Input validation utilities
 * Provides consistent validation across the application
 */

import { PROMPT_MIN_LENGTH, PROMPT_MAX_LENGTH } from '@/app/constants/video';

/**
 * Validation error class for better error handling
 */
export class ValidationError extends Error {
  constructor(
    message: string,
    public field?: string,
    public code?: string
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Validates a video prompt
 * @throws {ValidationError} if validation fails
 */
export function validatePrompt(prompt: unknown): string {
  if (typeof prompt !== 'string') {
    throw new ValidationError(
      'Prompt must be a string',
      'prompt',
      'INVALID_TYPE'
    );
  }

  const trimmed = prompt.trim();

  if (trimmed.length === 0) {
    throw new ValidationError(
      'Prompt cannot be empty',
      'prompt',
      'EMPTY_PROMPT'
    );
  }

  if (trimmed.length < PROMPT_MIN_LENGTH) {
    throw new ValidationError(
      `Prompt must be at least ${PROMPT_MIN_LENGTH} characters long`,
      'prompt',
      'PROMPT_TOO_SHORT'
    );
  }

  if (trimmed.length > PROMPT_MAX_LENGTH) {
    throw new ValidationError(
      `Prompt must be at most ${PROMPT_MAX_LENGTH} characters long`,
      'prompt',
      'PROMPT_TOO_LONG'
    );
  }

  return trimmed;
}

/**
 * Validates an email address
 * @throws {ValidationError} if validation fails
 */
export function validateEmail(email: unknown): string {
  if (typeof email !== 'string') {
    throw new ValidationError(
      'Email must be a string',
      'email',
      'INVALID_TYPE'
    );
  }

  const trimmed = email.trim().toLowerCase();

  // Basic email validation regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(trimmed)) {
    throw new ValidationError(
      'Invalid email format',
      'email',
      'INVALID_EMAIL'
    );
  }

  return trimmed;
}

/**
 * Validates a user ID
 * @throws {ValidationError} if validation fails
 */
export function validateUserId(userId: unknown): string {
  if (typeof userId !== 'string') {
    throw new ValidationError(
      'User ID must be a string',
      'userId',
      'INVALID_TYPE'
    );
  }

  const trimmed = userId.trim();

  if (trimmed.length === 0) {
    throw new ValidationError(
      'User ID cannot be empty',
      'userId',
      'EMPTY_USER_ID'
    );
  }

  // User IDs should be alphanumeric (and potentially dashes/underscores)
  const userIdRegex = /^[a-zA-Z0-9_-]+$/;

  if (!userIdRegex.test(trimmed)) {
    throw new ValidationError(
      'User ID contains invalid characters',
      'userId',
      'INVALID_USER_ID'
    );
  }

  return trimmed;
}

/**
 * Validates a video ID (UUID)
 * @throws {ValidationError} if validation fails
 */
export function validateVideoId(videoId: unknown): string {
  if (typeof videoId !== 'string') {
    throw new ValidationError(
      'Video ID must be a string',
      'videoId',
      'INVALID_TYPE'
    );
  }

  const trimmed = videoId.trim();

  // UUID v4 regex
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (!uuidRegex.test(trimmed)) {
    throw new ValidationError(
      'Invalid video ID format',
      'videoId',
      'INVALID_VIDEO_ID'
    );
  }

  return trimmed;
}

/**
 * Validates a positive integer
 * Rejects NaN, Infinity, and non-integer values
 * @throws {ValidationError} if validation fails
 */
export function validatePositiveInteger(
  value: unknown,
  fieldName: string = 'value'
): number {
  if (typeof value !== 'number') {
    throw new ValidationError(
      `${fieldName} must be a number`,
      fieldName,
      'INVALID_TYPE'
    );
  }

  if (!Number.isFinite(value)) {
    throw new ValidationError(
      `${fieldName} must be a finite number`,
      fieldName,
      'NOT_FINITE'
    );
  }

  if (!Number.isInteger(value)) {
    throw new ValidationError(
      `${fieldName} must be an integer`,
      fieldName,
      'NOT_INTEGER'
    );
  }

  if (value <= 0) {
    throw new ValidationError(
      `${fieldName} must be positive`,
      fieldName,
      'NOT_POSITIVE'
    );
  }

  return value;
}

/**
 * Validates credits amount
 * @throws {ValidationError} if validation fails
 */
export function validateCredits(credits: unknown): number {
  return validatePositiveInteger(credits, 'credits');
}

/**
 * Validates a URL
 * @throws {ValidationError} if validation fails
 * @returns Canonicalized URL string with normalized protocol, host, and default ports removed
 */
export function validateUrl(url: unknown, fieldName: string = 'url'): string {
  if (typeof url !== 'string') {
    throw new ValidationError(
      `${fieldName} must be a string`,
      fieldName,
      'INVALID_TYPE'
    );
  }

  // Trim whitespace
  const trimmedUrl = url.trim();

  if (trimmedUrl.length === 0) {
    throw new ValidationError(
      `${fieldName} cannot be empty`,
      fieldName,
      'EMPTY_URL'
    );
  }

  let urlObj: URL;
  
  try {
    urlObj = new URL(trimmedUrl);
  } catch {
    throw new ValidationError(
      `Invalid ${fieldName} format`,
      fieldName,
      'INVALID_URL'
    );
  }

  // Enforce only http or https schemes
  if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
    throw new ValidationError(
      `${fieldName} must use http or https protocol`,
      fieldName,
      'INVALID_SCHEME'
    );
  }

  // Build canonicalized URL:
  // - Normalize protocol and host to lowercase
  const protocol = urlObj.protocol.toLowerCase();
  const host = urlObj.hostname.toLowerCase();
  
  // - Remove default ports (80 for http, 443 for https)
  const port = urlObj.port;
  const shouldIncludePort = 
    port && 
    !((protocol === 'http:' && port === '80') || 
      (protocol === 'https:' && port === '443'));
  
  const hostWithPort = shouldIncludePort ? `${host}:${port}` : host;
  
  // - Ensure pathname is at least '/'
  const pathname = urlObj.pathname || '/';
  
  // - Preserve search and hash
  const search = urlObj.search;
  const hash = urlObj.hash;
  
  // Reconstruct canonicalized URL
  return `${protocol}//${hostWithPort}${pathname}${search}${hash}`;
}

/**
 * Sanitizes a string by removing potentially dangerous characters
 * Use this for user-generated content that will be displayed
 * 
 * - Normalizes Unicode to NFKC form (mitigates homoglyph and compatibility issues)
 * - Removes Unicode control characters (Cc) and format characters (Cf)
 * - Trims whitespace
 */
export function sanitizeString(input: string): string {
  return input
    .normalize('NFKC') // Normalize Unicode to canonical form
    .replace(/\p{Cc}|\p{Cf}/gu, '') // Remove control and format characters
    .trim();
}

/**
 * Validates and sanitizes a display name
 * @throws {ValidationError} if validation fails
 */
export function validateDisplayName(name: unknown): string {
  if (typeof name !== 'string') {
    throw new ValidationError(
      'Display name must be a string',
      'name',
      'INVALID_TYPE'
    );
  }

  const sanitized = sanitizeString(name);

  if (sanitized.length === 0) {
    throw new ValidationError(
      'Display name cannot be empty',
      'name',
      'EMPTY_NAME'
    );
  }

  if (sanitized.length > 100) {
    throw new ValidationError(
      'Display name must be at most 100 characters',
      'name',
      'NAME_TOO_LONG'
    );
  }

  return sanitized;
}

/**
 * Checks if a value is a validation error
 */
export function isValidationError(error: unknown): error is ValidationError {
  return error instanceof ValidationError;
}

/**
 * Validates multiple fields and collects all errors
 * Returns array of validation errors (empty if all valid)
 * 
 * Note: This function only collects errors. Use validateFieldsWithValues
 * if you need both validated values and errors to avoid duplicate work.
 */
export function validateFields(
  validators: Array<() => void>
): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const validator of validators) {
    try {
      validator();
    } catch (error) {
      if (isValidationError(error)) {
        errors.push(error);
      } else {
        // Re-throw non-validation errors
        throw error;
      }
    }
  }

  return errors;
}

/**
 * Validates multiple fields and returns both values and errors
 * Reduces duplicate work by capturing validator return values
 * 
 * @param validators - Array of validation functions that return values
 * @returns Tuple of [values, errors] where values contains successful results
 * 
 * @example
 * ```typescript
 * const [values, errors] = validateFieldsWithValues([
 *   () => validatePrompt(prompt),
 *   () => validateEmail(email),
 *   () => validateCredits(credits),
 * ]);
 * 
 * if (errors.length > 0) {
 *   // Handle validation errors
 *   const messages = errors.map(e => e.message).join(', ');
 *   throw new Error(messages);
 * }
 * 
 * // Use validated values
 * const [validPrompt, validEmail, validCredits] = values;
 * ```
 */
export function validateFieldsWithValues<T extends unknown[]>(
  validators: { [K in keyof T]: () => T[K] }
): [(T[number] | undefined)[], ValidationError[]] {
  const values: (T[number] | undefined)[] = [];
  const errors: ValidationError[] = [];

  for (let i = 0; i < validators.length; i++) {
    try {
      const result = validators[i]();
      values[i] = result;
    } catch (error) {
      if (isValidationError(error)) {
        errors.push(error);
        values[i] = undefined; // Mark failed validation
      } else {
        // Re-throw non-validation errors
        throw error;
      }
    }
  }

  return [values, errors];
}

/**
 * Example usage of validateFields:
 * 
 * const errors = validateFields([
 *   () => validatePrompt(prompt),
 *   () => validateEmail(email),
 *   () => validateCredits(credits),
 * ]);
 * 
 * if (errors.length > 0) {
 *   // Handle validation errors
 *   const messages = errors.map(e => e.message).join(', ');
 *   throw new Error(messages);
 * }
 */
