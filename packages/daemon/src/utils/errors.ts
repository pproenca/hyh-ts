/**
 * Type guard for Node.js errors with error codes.
 * Use this instead of casting to NodeJS.ErrnoException.
 */
export function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}
