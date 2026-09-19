export type StorageErrorCode = 'READ_FAILED' | 'WRITE_FAILED' | 'PARSE_FAILED' | 'SCHEMA_INVALID' | 'MIGRATION_FAILED';

export class StorageDataError extends Error {
  readonly code: StorageErrorCode;

  constructor(code: StorageErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'StorageDataError';
    this.code = code;
  }
}
