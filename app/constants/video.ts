/**
 * Video processing constants
 * Centralized configuration for video generation and processing
 */

// Video duration constants (in frames at 30fps)
export const DEFAULT_VIDEO_DURATION_FRAMES = 180; // 6 seconds at 30fps

// Prompt validation
export const PROMPT_MIN_LENGTH = 10;
export const PROMPT_MAX_LENGTH = 500;

// Progress polling configuration
export const PROGRESS_POLL_INTERVAL_MS = 3000; // 3 seconds
export const PROGRESS_POLL_MAX_INTERVAL_MS = 8000; // 8 seconds max
export const PROGRESS_POLL_INTERVAL_INCREMENT_MS = 1000; // Increase by 1s each unchanged poll

// Video processing steps
export const VIDEO_PROCESSING_STEPS = [
  'script',
  'images',
  'audio',
  'captions',
  'render'
] as const;

export type VideoProcessingStep = typeof VIDEO_PROCESSING_STEPS[number];

// Retry configuration
export const MAX_RETRY_ATTEMPTS = 3;
export const INITIAL_RETRY_DELAY_MS = 5000; // 5 seconds

// Cache TTL values (in seconds)
export const VIDEO_LIST_CACHE_TTL = 30; // 30 seconds
export const VIDEO_PROGRESS_TTL = 3600; // 1 hour
export const VIDEO_CHECKPOINT_TTL = 7200; // 2 hours
export const VIDEO_METADATA_TTL = 86400; // 24 hours

// Pagination
export const VIDEOS_PER_PAGE = 20;

// Worker configuration
export const WORKER_CONCURRENCY = 2;
export const WORKER_PROGRESS_CLEANUP_DELAY_MS = 30000; // 30 seconds

// Image generation
export const IMAGE_ASPECT_RATIO_TARGET = 9 / 16; // Vertical video format
export const IMAGE_ASPECT_RATIO_TOLERANCE = 0.05; // 5% tolerance

// Retryable error codes
export const RETRYABLE_ERROR_CODES = [
  'ECONNRESET',     // Connection reset
  'ENOTFOUND',      // DNS lookup failed
  'ETIMEDOUT',      // Connection timeout
  'ECONNREFUSED',   // Connection refused
  'ENETUNREACH',    // Network unreachable
  'EAI_AGAIN',      // DNS temporary failure
  'EPIPE',          // Broken pipe
  'EHOSTUNREACH',   // Host unreachable
  'ECONNABORTED',   // Connection aborted
] as const;

// Retryable error message patterns
export const RETRYABLE_ERROR_PATTERNS = [
  'fetch failed',
  'connect timeout',
  'network error',
  'connection refused',
  'temporary failure',
  'service unavailable',  // 503
  'gateway timeout',      // 504
  'socket hang up',       // Common in undici/Node HTTP
  'timed out',            // Generic timeout
] as const;
