export type StorageEntry = readonly [string, string];
export type StorageReadEntry = readonly [string, string | null];

export interface StorageEngine {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  multiGet(keys: readonly string[]): Promise<StorageReadEntry[]>;
  multiSet(entries: readonly StorageEntry[]): Promise<void>;
}
