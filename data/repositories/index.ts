import { asyncStorageEngine } from '@/data/persistence/async-storage-engine';
import { CruxRepository } from './crux-repository';
import { SettingsRepository } from './settings-repository';

export const cruxRepository = new CruxRepository(asyncStorageEngine);
export const settingsRepository = new SettingsRepository(asyncStorageEngine);
