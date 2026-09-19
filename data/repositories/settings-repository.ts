import type { StorageEngine } from '@/data/persistence/storage-engine';
import { StorageDataError } from '@/data/persistence/storage-errors';

const SETTINGS_KEY = 'crux_settings';
const SETTINGS_SCHEMA_VERSION = 1;

export type CruxSettings = {
  schemaVersion: number;
  name: string;
};

export const defaultSettings: CruxSettings = {
  schemaVersion: SETTINGS_SCHEMA_VERSION,
  name: '',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function normalizeStoredSettings(value: unknown): CruxSettings {
  if (!isRecord(value)) return { ...defaultSettings };
  return {
    schemaVersion: SETTINGS_SCHEMA_VERSION,
    name: typeof value.name === 'string' ? value.name.trim() : '',
  };
}

export class SettingsRepository {
  constructor(private readonly engine: StorageEngine) {}

  async get(): Promise<CruxSettings> {
    let raw: string | null;
    try {
      raw = await this.engine.getItem(SETTINGS_KEY);
    } catch (error) {
      throw new StorageDataError('READ_FAILED', 'CRUX could not read saved settings.', { cause: error });
    }

    if (!raw) return { ...defaultSettings };

    try {
      return normalizeStoredSettings(JSON.parse(raw));
    } catch (error) {
      throw new StorageDataError('PARSE_FAILED', 'Saved CRUX settings are malformed. They were left untouched.', { cause: error });
    }
  }

  async save(settings: CruxSettings): Promise<CruxSettings> {
    const normalized = normalizeStoredSettings(settings);
    try {
      await this.engine.setItem(SETTINGS_KEY, JSON.stringify(normalized));
      return normalized;
    } catch (error) {
      throw new StorageDataError('WRITE_FAILED', 'CRUX could not save settings.', { cause: error });
    }
  }

  async update(update: Partial<CruxSettings>): Promise<CruxSettings> {
    return this.save({ ...(await this.get()), ...update, schemaVersion: SETTINGS_SCHEMA_VERSION });
  }
}
