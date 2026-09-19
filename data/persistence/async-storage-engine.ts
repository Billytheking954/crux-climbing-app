import AsyncStorage from '@react-native-async-storage/async-storage';
import type { StorageEngine, StorageEntry, StorageReadEntry } from './storage-engine';

export const asyncStorageEngine: StorageEngine = {
  getItem: (key) => AsyncStorage.getItem(key),
  setItem: (key, value) => AsyncStorage.setItem(key, value),
  removeItem: (key) => AsyncStorage.removeItem(key),
  multiGet: async (keys) => [...(await AsyncStorage.multiGet([...keys]))] as StorageReadEntry[],
  multiSet: (entries) => AsyncStorage.multiSet(entries.map(([key, value]) => [key, value] as [string, string])),
};
