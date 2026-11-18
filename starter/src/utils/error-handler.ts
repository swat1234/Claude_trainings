/**
 * Custom error class for review operations
 */
export class ReviewError extends Error {
  constructor(
    message: string,
    public code: string,
    public metadata?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ReviewError';
    Error.captureStackTrace(this, ReviewError);
  }
}

/**
 * Error codes for the review system
 */
export const ErrorCodes = {
  MISSING_API_KEY: 'MISSING_API_KEY',
  MISSING_GITHUB_TOKEN: 'MISSING_GITHUB_TOKEN',
  INVALID_CONFIG: 'INVALID_CONFIG',

  PR_NOT_FOUND: 'PR_NOT_FOUND',
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',
  GITHUB_API_ERROR: 'GITHUB_API_ERROR',
  RATE_LIMITED: 'RATE_LIMITED',

  AGENT_TIMEOUT: 'AGENT_TIMEOUT',
  AGENT_FAILED: 'AGENT_FAILED',
  STRUCTURED_OUTPUT_FAILED: 'STRUCTURED_OUTPUT_FAILED',

  RETRY_EXHAUSTED: 'RETRY_EXHAUSTED',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR'
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

/**
 * Retry an asynchronous operation using exponential backoff and jitter.
 *
 * maxRetries represents the number of retries after the initial attempt.
 * For example, maxRetries = 3 allows up to four total attempts.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === maxRetries) {
        break;
      }

      const backoff = delayMs * Math.pow(2, attempt);
      const jitter = Math.random() * 100;
      const waitTime = backoff + jitter;

      await new Promise<void>((resolve) => {
        setTimeout(resolve, waitTime);
      });
    }
  }

  throw new ReviewError(
    `Operation failed after ${maxRetries + 1} attempts`,
    ErrorCodes.RETRY_EXHAUSTED,
    {
      maxRetries,
      totalAttempts: maxRetries + 1,
      cause:
        lastError instanceof Error
          ? lastError.message
          : String(lastError)
    }
  );
}

/**
 * Wrap an asynchronous operation with a timeout.
 */
export async function withTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  errorMessage: string = 'Operation timed out'
): Promise<T> {
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(
        new ReviewError(
          errorMessage,
          ErrorCodes.AGENT_TIMEOUT,
          { timeoutMs }
        )
      );
    }, timeoutMs);
  });

  try {
    return await Promise.race([
      fn(),
      timeoutPromise
    ]);
  } finally {
    if (timeoutHandle !== undefined) {
      clearTimeout(timeoutHandle);
    }
  }
}

/**
 * Check whether an error is a ReviewError.
 */
export function isReviewError(error: unknown): error is ReviewError {
  return error instanceof ReviewError;
}

/**
 * Format an error for logging or display.
 */
export function formatError(error: unknown): string {
  if (isReviewError(error)) {
    return `[${error.code}] ${error.message}`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}