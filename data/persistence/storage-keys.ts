export const StorageKeys = {
  sessions: 'crux_sessions',
  goals: 'crux_goals',
  projects: 'crux_projects',
  schemaVersion: 'crux_storage_schema_version',
  recoverySnapshot: 'crux_storage_recovery_snapshot',
  backupV4: 'crux_storage_backup_before_v4',
  backupV5: 'crux_storage_backup_before_v5',
  backupV6: 'crux_storage_backup_before_v6',
  backupV7: 'crux_storage_backup_before_v7',
  backupV8: 'crux_storage_backup_before_v8',
} as const;

export const CURRENT_STORAGE_SCHEMA_VERSION = 8;
