function normalizeError(error: unknown): Error {
  return error instanceof Error ? error : new Error(typeof error === 'string' ? error : JSON.stringify(error));
}

export const logger = {
  error(error: unknown, context?: string): void {
    const normalized = normalizeError(error);
    console.error(context ? `[CRUX:${context}]` : '[CRUX]', normalized);
  },
  warn(message: string, context?: string): void {
    console.warn(context ? `[CRUX:${context}] ${message}` : `[CRUX] ${message}`);
  },
};
