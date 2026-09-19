import type { StorageEngine, StorageReadEntry } from './storage-engine';
import { StorageKeys } from './storage-keys';
import { StorageDataError } from './storage-errors';

// A durable undo record makes multi-key writes recoverable on engines where
// multiSet can be interrupted. Callers serialize reads and writes together.
const JOURNAL_KEY = 'crux_storage_pending_transaction';
const ALLOWED_KEYS: Set<string> = new Set([
  StorageKeys.sessions, StorageKeys.goals, StorageKeys.projects, StorageKeys.schemaVersion,
]);

export async function recoverInterruptedWrite(engine: StorageEngine): Promise<void> {
  const raw = await engine.getItem(JOURNAL_KEY);
  if (raw === null) return;
  let previous: StorageReadEntry[];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) throw new Error('Invalid transaction');
    const keys = new Set<string>();
    for (const entry of parsed) {
      if (!Array.isArray(entry) || entry.length !== 2 || typeof entry[0] !== 'string' ||
          !ALLOWED_KEYS.has(entry[0]) || keys.has(entry[0]) ||
          (entry[1] !== null && typeof entry[1] !== 'string')) throw new Error('Invalid transaction entry');
      keys.add(entry[0]);
    }
    previous = parsed as StorageReadEntry[];
  } catch (cause) {
    throw new StorageDataError('SCHEMA_INVALID', 'CRUX found an invalid recovery journal. Saved data was left untouched.', { cause });
  }
  // Keep the journal until every restoration succeeds; retries are idempotent.
  for (const [key, value] of previous) {
    if (value === null) await engine.removeItem(key);
    else await engine.setItem(key, value);
  }
  await engine.removeItem(JOURNAL_KEY);
}

export async function writeTransaction(engine: StorageEngine, entries: [string, string][]): Promise<void> {
  if (!entries.length) return;
  await recoverInterruptedWrite(engine);
  const previous = await engine.multiGet(entries.map(([key]) => key));
  await engine.setItem(JOURNAL_KEY, JSON.stringify(previous));
  try {
    await engine.multiSet(entries);
    await engine.removeItem(JOURNAL_KEY);
  } catch (cause) {
    // If the device/storage remains unavailable, the next read retries recovery.
    try { await recoverInterruptedWrite(engine); } catch { /* Preserve journal. */ }
    throw new StorageDataError('WRITE_FAILED', 'CRUX could not finish saving. Retry when storage is available.', { cause });
  }
}
