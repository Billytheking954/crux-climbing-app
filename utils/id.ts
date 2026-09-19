let fallbackCounter = 0;

function fallbackId(): string {
  fallbackCounter = (fallbackCounter + 1) % Number.MAX_SAFE_INTEGER;
  return `${Date.now().toString(36)}-${fallbackCounter.toString(36).padStart(4, '0')}-${Math.random().toString(36).slice(2, 14).padEnd(12, '0')}`;
}

export function createId(prefix: string): string {
  const safePrefix = prefix.trim().replace(/[^a-zA-Z0-9_-]+/g, '-') || 'id';
  const cryptoObject = globalThis.crypto as (Crypto & { randomUUID?: () => string }) | undefined;
  const uuid = cryptoObject && typeof cryptoObject.randomUUID === 'function' ? cryptoObject.randomUUID() : fallbackId();
  return `${safePrefix}-${uuid}`;
}
