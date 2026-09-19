import { MutationSerializationQueue } from './mutation-queue';
import { recoverInterruptedWrite, writeTransaction } from './transaction';
import { logger } from '@/core/logging/logger';
import { normalizeVGradeInput } from '@/domain/grades';
import {
  MAX_SUPPORTED_V_GRADE,
  assertSnapshotIntegrity,
  isBoulderResult,
  isGoalType,
  isValidDateString,
  resultSupportsProjectLink,
} from '@/domain/invariants';
import type { Boulder, ClimbingGoal, ClimbingProject, ClimbingSession, CruxSnapshot, ProjectMilestone, ProjectPhoto } from '@/domain/models';
import { projectCompletionStateMatchesSessions, reconcileProjectsWithSessions, sanitizeSessionProjectLinks } from '@/domain/project-reconciliation';
import type { StorageEngine } from './storage-engine';
import { StorageDataError } from './storage-errors';
import { CURRENT_STORAGE_SCHEMA_VERSION, StorageKeys } from './storage-keys';

type UnknownRecord = Record<string, unknown>;
function isRecord(value: unknown): value is UnknownRecord { return typeof value === 'object' && value !== null && !Array.isArray(value); }
function clean(value: unknown): string | undefined { if (typeof value !== 'string') return undefined; const v = value.trim(); return v || undefined; }
function cleanKnown(value: unknown): string | undefined { const v = clean(value); return v && v.toLowerCase() !== 'unknown' ? v : undefined; }
function cleanArray(value: unknown): string[] { return Array.isArray(value) ? Array.from(new Set(value.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean))) : []; }
function cleanChoice(value: unknown): string | string[] | undefined { if (Array.isArray(value)) { const items = cleanArray(value).filter((item) => item.toLowerCase() !== 'unknown'); return items.length ? items : undefined; } return cleanKnown(value); }
function positiveNumber(value: unknown): number | undefined { return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined; }

function parseArray(raw: string | null): unknown[] | null {
  if (raw === null || raw.trim() === '') return [];
  try { const value = JSON.parse(raw); return Array.isArray(value) ? value : null; } catch { return null; }
}

function normalizeBoulder(value: unknown, sessionId: string, startedAt: string, finishedAt: string | undefined, index: number): Boulder | null {
  if (!isRecord(value) || !isBoulderResult(value.result)) return null;
  const gradeRaw = clean(value.grade);
  const grade = gradeRaw ? normalizeVGradeInput(gradeRaw) : null;
  if (!grade) return null;
  const rawAttempts = value.attempts;
  const baseAttempts = typeof rawAttempts === 'number' && Number.isFinite(rawAttempts) ? Math.max(1, Math.floor(rawAttempts)) : 1;
  const attempts = value.result === 'Flash' ? 1 : value.result === 'Send' ? Math.max(2, baseAttempts) : baseAttempts;
  const createdAt = isValidDateString(value.createdAt) ? value.createdAt : startedAt;
  const at = new Date(createdAt).getTime();
  if (at < new Date(startedAt).getTime() || (finishedAt && at > new Date(finishedAt).getTime())) return null;
  return {
    id: clean(value.id) ?? `boulder-legacy-${sessionId}-${index}`,
    sessionId,
    projectId: resultSupportsProjectLink(value.result) ? clean(value.projectId) : undefined,
    name: clean(value.name),
    grade,
    result: value.result,
    attempts,
    terrain: cleanKnown(value.terrain),
    holdType: cleanChoice(value.holdType),
    movementType: cleanChoice(value.movementType),
    createdAt,
  };
}

function normalizeSession(value: unknown, index: number): ClimbingSession | null {
  if (!isRecord(value) || !isValidDateString(value.startedAt)) return null;
  const startedAt = value.startedAt;
  let finishedAt: string | undefined;
  if (value.finishedAt !== undefined && value.finishedAt !== null) {
    if (!isValidDateString(value.finishedAt) || new Date(value.finishedAt).getTime() < new Date(startedAt).getTime()) return null;
    finishedAt = value.finishedAt;
  }
  const id = clean(value.id) ?? `session-legacy-${index}`;
  const source = Array.isArray(value.boulders) ? value.boulders : [];
  const boulders: Boulder[] = [];
  for (let i = 0; i < source.length; i += 1) {
    const boulder = normalizeBoulder(source[i], id, startedAt, finishedAt, i);
    if (!boulder) return null;
    boulders.push(boulder);
  }
  return { id, gymName: clean(value.gymName) ?? 'Unknown Gym', startedAt, finishedAt, boulders };
}

function repairExtraActiveSessions(sessions: ClimbingSession[]): ClimbingSession[] {
  const active = sessions.map((session, index) => ({ session, index })).filter(({ session }) => !session.finishedAt)
    .sort((a, b) => new Date(b.session.startedAt).getTime() - new Date(a.session.startedAt).getTime() || a.index - b.index);
  if (active.length <= 1) return sessions;
  const keep = active[0].session.id;
  const ids = new Set(active.map(({ session }) => session.id));
  return sessions.map((session) => {
    if (session.id === keep || !ids.has(session.id)) return session;
    const last = session.boulders.reduce((time, b) => Math.max(time, new Date(b.createdAt).getTime()), new Date(session.startedAt).getTime());
    return { ...session, finishedAt: new Date(last).toISOString() };
  });
}

function normalizeGoal(value: unknown, index: number, legacy: boolean): ClimbingGoal | null {
  if (!isRecord(value) || !isGoalType(value.type)) return null;
  const title = clean(value.title);
  if (!title || typeof value.target !== 'number' || !Number.isSafeInteger(value.target) || !isValidDateString(value.createdAt)) return null;
  let target = value.target;
  if (value.type === 'grade') { if (target < 0 || (!legacy && target > MAX_SUPPORTED_V_GRADE)) return null; if (legacy) target = Math.min(target, MAX_SUPPORTED_V_GRADE); }
  else if (target <= 0) return null;
  let completedAt: string | undefined;
  if (value.completedAt !== undefined && value.completedAt !== null) {
    if (!isValidDateString(value.completedAt) || new Date(value.completedAt).getTime() < new Date(value.createdAt).getTime()) return null;
    completedAt = value.completedAt;
  }
  return { id: clean(value.id) ?? `goal-legacy-${index}`, type: value.type, title, target, createdAt: value.createdAt, completedAt };
}

function normalizePhotos(value: unknown, projectId: string, projectCreatedAt: string, legacy: boolean): ProjectPhoto[] | null {
  if (value == null) return [];
  if (!Array.isArray(value)) return null;
  const photos: ProjectPhoto[] = [];
  const ids = new Set<string>(); const uris = new Set<string>();
  for (let i = 0; i < value.length; i += 1) {
    const item = value[i];
    if (typeof item === 'string') {
      if (!legacy) return null;
      const uri = clean(item); if (!uri || uris.has(uri)) continue;
      const id = `photo-legacy-${projectId}-${i}`;
      photos.push({ id, uri, createdAt: projectCreatedAt, sanitized: false }); ids.add(id); uris.add(uri); continue;
    }
    if (!isRecord(item)) return null;
    const uri = clean(item.uri); const id = clean(item.id) ?? (legacy ? `photo-legacy-${projectId}-${i}` : undefined);
    const createdAt = isValidDateString(item.createdAt) ? item.createdAt : legacy ? projectCreatedAt : undefined;
    if (!uri || !id || !createdAt) return null;
    if (ids.has(id) || uris.has(uri)) {
      if (legacy) continue;
      return null;
    }
    if (new Date(createdAt).getTime() < new Date(projectCreatedAt).getTime()) return null;
    if (!legacy && typeof item.sanitized !== 'boolean') return null;
    const width = positiveNumber(item.width); const height = positiveNumber(item.height); const sizeBytes = positiveNumber(item.sizeBytes); const mimeType = clean(item.mimeType);
    photos.push({ id, uri, createdAt, sanitized: item.sanitized === true, width, height, sizeBytes, mimeType }); ids.add(id); uris.add(uri);
  }
  return photos;
}

function normalizeMilestones(value: unknown, projectId: string, projectCreatedAt: string): ProjectMilestone[] | null {
  if (value == null) return [];
  if (!Array.isArray(value)) return null;
  const result: ProjectMilestone[] = [];
  for (let i = 0; i < value.length; i += 1) {
    const item = value[i]; if (!isRecord(item)) return null;
    const title = clean(item.title); if (!title || !isValidDateString(item.createdAt) || new Date(item.createdAt).getTime() < new Date(projectCreatedAt).getTime()) return null;
    result.push({ id: clean(item.id) ?? `milestone-legacy-${projectId}-${i}`, title, note: clean(item.note), createdAt: item.createdAt });
  }
  return result.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

function normalizeProject(value: unknown, index: number, legacy: boolean): ClimbingProject | null {
  if (!isRecord(value)) return null;
  const name = clean(value.name); const gradeRaw = clean(value.grade); const grade = gradeRaw ? normalizeVGradeInput(gradeRaw) : null;
  if (!name || !grade || !isValidDateString(value.createdAt)) return null;
  const id = clean(value.id) ?? `project-legacy-${index}`;
  const createdAt = value.createdAt;
  const status = value.status === 'completed' ? 'completed' : 'active';
  let completionSource: 'manual' | 'boulder' | undefined = value.completionSource === 'manual' || value.completionSource === 'boulder' ? value.completionSource : undefined;
  let completedAt = isValidDateString(value.completedAt) ? value.completedAt : undefined;
  if (status === 'completed') { completionSource ??= 'manual'; completedAt ??= createdAt; if (new Date(completedAt).getTime() < new Date(createdAt).getTime()) return null; }
  else { completionSource = undefined; completedAt = undefined; }
  const milestones = normalizeMilestones(value.milestones, id, createdAt); const photos = normalizePhotos(value.photos, id, createdAt, legacy);
  if (!milestones || !photos) return null;
  const fallbackUpdated = completedAt ?? createdAt;
  const updatedAt = isValidDateString(value.updatedAt) ? value.updatedAt : fallbackUpdated;
  if (new Date(updatedAt).getTime() < new Date(createdAt).getTime()) return null;
  return { id, name, grade, status, createdAt, updatedAt, completedAt, completionSource, notes: clean(value.notes), beta: clean(value.beta), milestones, photos };
}

function normalizeSnapshot(raw: { sessions: unknown[]; goals: unknown[]; projects: unknown[] }, legacy: boolean): CruxSnapshot | null {
  const sessions: ClimbingSession[] = [];
  for (let i = 0; i < raw.sessions.length; i += 1) { const value = normalizeSession(raw.sessions[i], i); if (!value) return null; sessions.push(value); }
  const repairedSessions = legacy ? repairExtraActiveSessions(sessions) : sessions;
  if (!legacy && repairedSessions.filter((s) => !s.finishedAt).length > 1) return null;
  const goals: ClimbingGoal[] = [];
  for (let i = 0; i < raw.goals.length; i += 1) { const value = normalizeGoal(raw.goals[i], i, legacy); if (!value) return null; goals.push(value); }
  const projects: ClimbingProject[] = [];
  for (let i = 0; i < raw.projects.length; i += 1) { const value = normalizeProject(raw.projects[i], i, legacy); if (!value) return null; projects.push(value); }
  const linkedSessions = legacy ? sanitizeSessionProjectLinks(repairedSessions, projects) : repairedSessions;
  const reconciledProjects = legacy ? reconcileProjectsWithSessions(projects, linkedSessions).projects : projects;
  try { assertSnapshotIntegrity(linkedSessions, goals, reconciledProjects); } catch { return null; }
  if (!legacy && !projectCompletionStateMatchesSessions(reconciledProjects, linkedSessions)) return null;
  return { sessions: linkedSessions, goals, projects: reconciledProjects };
}

async function readRaw(engine: StorageEngine): Promise<{ sessions: string | null; goals: string | null; projects: string | null }> {
  try {
    const entries = new Map(await engine.multiGet([StorageKeys.sessions, StorageKeys.goals, StorageKeys.projects]));
    return { sessions: entries.get(StorageKeys.sessions) ?? null, goals: entries.get(StorageKeys.goals) ?? null, projects: entries.get(StorageKeys.projects) ?? null };
  } catch (error) { throw new StorageDataError('READ_FAILED', 'CRUX could not read saved data.', { cause: error }); }
}

async function preserveRecovery(engine: StorageEngine, reason: string): Promise<void> {
  try {
    const entries = await engine.multiGet([StorageKeys.sessions, StorageKeys.goals, StorageKeys.projects, StorageKeys.schemaVersion]);
    await engine.setItem(StorageKeys.recoverySnapshot, JSON.stringify({ createdAt: new Date().toISOString(), reason, entries: Object.fromEntries(entries) }));
  } catch (error) { logger.error(error, 'storage.recovery-snapshot'); }
}

async function backup(engine: StorageEngine, key: string, previousVersion: number, raw: Awaited<ReturnType<typeof readRaw>>): Promise<void> {
  if (await engine.getItem(key)) return;
  await engine.setItem(key, JSON.stringify({ createdAt: new Date().toISOString(), previousVersion, sessionsRaw: raw.sessions, goalsRaw: raw.goals, projectsRaw: raw.projects }));
}

export class StorageSchemaManager {
  private readonly io = new MutationSerializationQueue();
  private migrationPromise: Promise<void> | null = null;
  constructor(private readonly engine: StorageEngine) {}
  resetRuntimeState(): void { this.migrationPromise = null; }

  async ensureCurrentSchema(): Promise<void> {
    if (this.migrationPromise) return this.migrationPromise;
    this.migrationPromise = this.ensureCurrentSchemaInternal();
    try { await this.migrationPromise; } catch (error) { this.migrationPromise = null; throw error; }
  }

  private async ensureCurrentSchemaInternal(): Promise<void> {
    try {
      let rawVersion: string | null;
      try { rawVersion = await this.engine.getItem(StorageKeys.schemaVersion); }
      catch (error) { throw new StorageDataError('READ_FAILED', 'CRUX could not read the storage schema version.', { cause: error }); }
      if (rawVersion !== null && !/^(0|[1-9][0-9]*)$/.test(rawVersion)) throw new StorageDataError('MIGRATION_FAILED', 'The saved schema version is invalid. Existing data was left untouched.');
      const version = rawVersion === null ? 0 : Number(rawVersion);
      if (!Number.isSafeInteger(version)) throw new StorageDataError('MIGRATION_FAILED', 'The saved schema version is invalid.');
      if (version > CURRENT_STORAGE_SCHEMA_VERSION) throw new StorageDataError('MIGRATION_FAILED', 'CRUX data was created by a newer app version and cannot be safely modified by this version.');
      if (version === CURRENT_STORAGE_SCHEMA_VERSION) return;
      await this.migrate(version);
    } catch (error) {
      if (error instanceof StorageDataError) throw error;
      logger.error(error, 'storage.migration');
      throw new StorageDataError('MIGRATION_FAILED', 'CRUX could not safely prepare stored data.', { cause: error });
    }
  }

  private async migrate(version: number): Promise<void> {
    const raw = await readRaw(this.engine);
    if (version < 4) await backup(this.engine, StorageKeys.backupV4, version, raw);
    if (version < 5) await backup(this.engine, StorageKeys.backupV5, version, raw);
    if (version < 6) await backup(this.engine, StorageKeys.backupV6, version, raw);
    if (version < 7) await backup(this.engine, StorageKeys.backupV7, version, raw);
    await backup(this.engine, StorageKeys.backupV8, version, raw);
    const sessions = parseArray(raw.sessions); const goals = parseArray(raw.goals); const projects = parseArray(raw.projects);
    if (!sessions || !goals || !projects) throw new StorageDataError('MIGRATION_FAILED', 'Existing CRUX data could not be parsed safely. The original data was preserved.');
    const snapshot = normalizeSnapshot({ sessions, goals, projects }, true);
    if (!snapshot) throw new StorageDataError('MIGRATION_FAILED', 'Existing CRUX data did not match the expected schema. The original data was preserved.');
    await writeTransaction(this.engine, [
      [StorageKeys.sessions, JSON.stringify(snapshot.sessions)], [StorageKeys.goals, JSON.stringify(snapshot.goals)],
      [StorageKeys.projects, JSON.stringify(snapshot.projects)], [StorageKeys.schemaVersion, String(CURRENT_STORAGE_SCHEMA_VERSION)],
    ]);
  }

  async readSnapshot(): Promise<CruxSnapshot> {
    return this.io.run(async () => {
      await recoverInterruptedWrite(this.engine);
      return this.readSnapshotInternal();
    }, 'snapshot:read');
  }

  private async readSnapshotInternal(): Promise<CruxSnapshot> {
    await this.ensureCurrentSchema();
    const raw = await readRaw(this.engine);
    const sessions = parseArray(raw.sessions); const goals = parseArray(raw.goals); const projects = parseArray(raw.projects);
    if (!sessions || !goals || !projects) { await preserveRecovery(this.engine, 'snapshot-parse-failed'); throw new StorageDataError('PARSE_FAILED', 'Saved CRUX data is malformed. It was left untouched and a recovery snapshot was preserved.'); }
    const snapshot = normalizeSnapshot({ sessions, goals, projects }, false);
    if (!snapshot) { await preserveRecovery(this.engine, 'snapshot-schema-invalid'); throw new StorageDataError('SCHEMA_INVALID', 'Saved CRUX data does not match the expected schema. It was left untouched.'); }
    return snapshot;
  }

  async writeSnapshot(snapshot: CruxSnapshot, changed: Set<'sessions' | 'goals' | 'projects'>): Promise<void> {
    return this.io.run(async () => {
      await recoverInterruptedWrite(this.engine);
      assertSnapshotIntegrity(snapshot.sessions, snapshot.goals, snapshot.projects);
      if (!projectCompletionStateMatchesSessions(snapshot.projects, snapshot.sessions)) throw new StorageDataError('SCHEMA_INVALID', 'CRUX refused to save inconsistent project completion state.');
      const entries: [string, string][] = [];
      if (changed.has('sessions')) entries.push([StorageKeys.sessions, JSON.stringify(snapshot.sessions)]);
      if (changed.has('goals')) entries.push([StorageKeys.goals, JSON.stringify(snapshot.goals)]);
      if (changed.has('projects')) entries.push([StorageKeys.projects, JSON.stringify(snapshot.projects)]);
      if (!entries.length) return;
      try { await writeTransaction(this.engine, entries); } catch (error) { throw new StorageDataError('WRITE_FAILED', 'CRUX could not save data safely.', { cause: error }); }
    }, 'snapshot:write');
  }
}
