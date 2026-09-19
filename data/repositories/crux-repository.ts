import { calculateClimbingStats, getHighestGrade } from '@/domain/stats';
import { gradeToNumber, normalizeVGradeInput } from '@/domain/grades';
import {
  validateBoulderInput,
  validateGoal,
  validateGoalValues,
  validateProjectPhoto,
  validateProjectValues,
  validateSessionUpdate,
} from '@/domain/invariants';
import type {
  Boulder,
  BoulderResult,
  ClimbingGoal,
  ClimbingProject,
  ClimbingSession,
  CruxSnapshot,
  GoalType,
  ProjectMilestone,
  ProjectPhoto,
  ProjectStatus,
} from '@/domain/models';
import {
  projectHasCompletionEvidence,
  reconcileProjectsWithSessions,
} from '@/domain/project-reconciliation';
import { MutationSerializationQueue } from '@/data/persistence/mutation-queue';
import { StorageSchemaManager } from '@/data/persistence/schema';
import type { StorageEngine } from '@/data/persistence/storage-engine';
import { createId } from '@/utils/id';

export type BoulderInput = {
  projectId?: string;
  name?: string;
  grade: string;
  result: BoulderResult;
  attempts: number;
  terrain?: string;
  holdType?: string | string[];
  movementType?: string | string[];
};

function optionalString(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function optionalChoice(value: string | string[] | undefined): string | string[] | undefined {
  if (Array.isArray(value)) {
    const values = Array.from(new Set(value.map((item) => item.trim()).filter(Boolean)));
    return values.length ? values : undefined;
  }
  return optionalString(value);
}

function normalizeBoulderInput(input: BoulderInput): BoulderInput {
  const grade = normalizeVGradeInput(input.grade);
  if (!grade) throw new Error('Boulder grade must be a supported V grade or V-grade range.');
  const normalized: BoulderInput = {
    ...input,
    name: optionalString(input.name),
    grade,
    attempts: Math.floor(input.attempts),
    terrain: optionalString(input.terrain),
    holdType: optionalChoice(input.holdType),
    movementType: optionalChoice(input.movementType),
  };
  validateBoulderInput(normalized);
  return normalized;
}

function sameIds(a: { id: string }[], b: { id: string }[]): boolean {
  if (a.length !== b.length) return false;
  const ids = new Set(a.map((item) => item.id));
  return b.every((item) => ids.has(item.id));
}

export class CruxRepository {
  private readonly schema: StorageSchemaManager;
  private readonly mutations = new MutationSerializationQueue();

  constructor(engine: StorageEngine) {
    this.schema = new StorageSchemaManager(engine);
  }

  resetRuntimeState(): void {
    this.schema.resetRuntimeState();
  }

  async getSnapshot(): Promise<CruxSnapshot> {
    return this.schema.readSnapshot();
  }

  async getSessions(): Promise<ClimbingSession[]> {
    return (await this.getSnapshot()).sessions;
  }

  async getSessionById(sessionId: string): Promise<ClimbingSession | null> {
    return (await this.getSessions()).find((session) => session.id === sessionId) ?? null;
  }

  async getAllBoulders(): Promise<Boulder[]> {
    return (await this.getSessions()).flatMap((session) => session.boulders);
  }

  async createSession(gymName: string, options: { requireNew?: boolean } = {}): Promise<ClimbingSession> {
    return this.mutations.run(async () => {
      const snapshot = await this.getSnapshot();
      const active = snapshot.sessions
        .filter((session) => !session.finishedAt)
        .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())[0];
      if (active) {
        if (options.requireNew) throw new Error('A climbing session is already active.');
        return active;
      }
      const session: ClimbingSession = {
        id: createId('session'),
        gymName: gymName.trim() || 'Unknown Gym',
        startedAt: new Date().toISOString(),
        boulders: [],
      };
      snapshot.sessions.unshift(session);
      await this.schema.writeSnapshot(snapshot, new Set(['sessions']));
      return session;
    }, 'session:create');
  }

  async addBoulderToSession(sessionId: string, input: BoulderInput): Promise<Boulder> {
    const normalized = normalizeBoulderInput(input);
    return this.mutations.run(async () => {
      const snapshot = await this.getSnapshot();
      const session = snapshot.sessions.find((item) => item.id === sessionId);
      if (!session) throw new Error('Session not found.');
      if (session.finishedAt) throw new Error('Cannot add a boulder to a finished session.');
      if (normalized.projectId) {
        const project = snapshot.projects.find((item) => item.id === normalized.projectId);
        if (!project) throw new Error('Linked project not found.');
        if (project.status === 'completed') throw new Error('Linked project is already completed.');
      }
      const boulder: Boulder = {
        id: createId('boulder'),
        sessionId,
        createdAt: new Date().toISOString(),
        ...normalized,
      };
      session.boulders.push(boulder);
      const reconciled = reconcileProjectsWithSessions(snapshot.projects, snapshot.sessions);
      snapshot.projects = reconciled.projects;
      await this.schema.writeSnapshot(snapshot, new Set(reconciled.changed ? ['sessions', 'projects'] : ['sessions']));
      return boulder;
    }, 'boulder:add');
  }

  async updateBoulder(sessionId: string, boulderId: string, input: BoulderInput): Promise<Boulder> {
    const normalized = normalizeBoulderInput(input);
    return this.mutations.run(async () => {
      const snapshot = await this.getSnapshot();
      const session = snapshot.sessions.find((item) => item.id === sessionId);
      if (!session) throw new Error('Session not found.');
      const index = session.boulders.findIndex((item) => item.id === boulderId);
      if (index < 0) throw new Error('Boulder not found.');
      const current = session.boulders[index];
      if (normalized.projectId) {
        const project = snapshot.projects.find((item) => item.id === normalized.projectId);
        if (!project) throw new Error('Linked project not found.');
        if (project.status === 'completed' && project.id !== current.projectId) throw new Error('Linked project is already completed.');
      }
      const updated: Boulder = { ...current, ...normalized, id: current.id, sessionId: current.sessionId, createdAt: current.createdAt };
      session.boulders[index] = updated;
      const affected = new Set([current.projectId, updated.projectId].filter((value): value is string => Boolean(value)));
      const reconciled = reconcileProjectsWithSessions(snapshot.projects, snapshot.sessions, { onlyProjectIds: affected });
      snapshot.projects = reconciled.projects;
      await this.schema.writeSnapshot(snapshot, new Set(reconciled.changed ? ['sessions', 'projects'] : ['sessions']));
      return updated;
    }, 'boulder:update');
  }

  async deleteBoulder(sessionId: string, boulderId: string): Promise<void> {
    await this.mutations.run(async () => {
      const snapshot = await this.getSnapshot();
      const session = snapshot.sessions.find((item) => item.id === sessionId);
      if (!session) throw new Error('Session not found.');
      const boulder = session.boulders.find((item) => item.id === boulderId);
      if (!boulder) throw new Error('Boulder not found.');
      session.boulders = session.boulders.filter((item) => item.id !== boulderId);
      const affected = new Set<string>();
      if (boulder.projectId) affected.add(boulder.projectId);
      const reconciled = reconcileProjectsWithSessions(snapshot.projects, snapshot.sessions, { onlyProjectIds: affected });
      snapshot.projects = reconciled.projects;
      await this.schema.writeSnapshot(snapshot, new Set(reconciled.changed ? ['sessions', 'projects'] : ['sessions']));
    }, 'boulder:delete');
  }

  async updateSession(sessionId: string, update: { gymName: string; startedAt: string; finishedAt?: string }): Promise<ClimbingSession> {
    return this.mutations.run(async () => {
      const snapshot = await this.getSnapshot();
      const index = snapshot.sessions.findIndex((session) => session.id === sessionId);
      if (index < 0) throw new Error('Session not found.');
      const current = snapshot.sessions[index];
      validateSessionUpdate(current, snapshot.sessions, update);
      const next = { ...current, gymName: update.gymName.trim(), startedAt: update.startedAt, finishedAt: update.finishedAt };
      snapshot.sessions[index] = next;
      await this.schema.writeSnapshot(snapshot, new Set(['sessions']));
      return next;
    }, 'session:update');
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.mutations.run(async () => {
      const snapshot = await this.getSnapshot();
      const session = snapshot.sessions.find((item) => item.id === sessionId);
      if (!session) throw new Error('Session not found.');
      const affected = new Set(session.boulders.map((boulder) => boulder.projectId).filter((value): value is string => Boolean(value)));
      snapshot.sessions = snapshot.sessions.filter((item) => item.id !== sessionId);
      const reconciled = reconcileProjectsWithSessions(snapshot.projects, snapshot.sessions, { onlyProjectIds: affected });
      snapshot.projects = reconciled.projects;
      await this.schema.writeSnapshot(snapshot, new Set(reconciled.changed ? ['sessions', 'projects'] : ['sessions']));
    }, 'session:delete');
  }

  async finishSession(sessionId: string): Promise<void> {
    await this.mutations.run(async () => {
      const snapshot = await this.getSnapshot();
      const session = snapshot.sessions.find((item) => item.id === sessionId);
      if (!session) throw new Error('Session not found.');
      if (session.finishedAt) return;
      const latest = session.boulders.reduce((time, boulder) => Math.max(time, new Date(boulder.createdAt).getTime()), new Date(session.startedAt).getTime());
      session.finishedAt = new Date(Math.max(Date.now(), latest)).toISOString();
      await this.schema.writeSnapshot(snapshot, new Set(['sessions']));
    }, 'session:finish');
  }

  async getGoals(): Promise<ClimbingGoal[]> { return (await this.getSnapshot()).goals; }

  async saveGoals(goals: ClimbingGoal[]): Promise<void> {
    goals.forEach(validateGoal);
    await this.mutations.run(async () => {
      const snapshot = await this.getSnapshot();
      if (!sameIds(snapshot.goals, goals)) throw new Error('Goal replacement was rejected because the saved goal set changed. Reload goals and try again.');
      snapshot.goals = goals.map((goal) => ({ ...goal }));
      await this.schema.writeSnapshot(snapshot, new Set(['goals']));
    }, 'goals:replace');
  }

  async createGoal(type: GoalType, title: string, target: number): Promise<ClimbingGoal> {
    validateGoalValues(type, title, target);
    return this.mutations.run(async () => {
      const snapshot = await this.getSnapshot();
      const goal: ClimbingGoal = { id: createId('goal'), type, title: title.trim(), target, createdAt: new Date().toISOString() };
      snapshot.goals.unshift(goal);
      await this.schema.writeSnapshot(snapshot, new Set(['goals']));
      return goal;
    }, 'goal:create');
  }

  async deleteGoal(goalId: string): Promise<void> {
    await this.mutations.run(async () => {
      const snapshot = await this.getSnapshot();
      if (!snapshot.goals.some((goal) => goal.id === goalId)) throw new Error('Goal not found.');
      snapshot.goals = snapshot.goals.filter((goal) => goal.id !== goalId);
      await this.schema.writeSnapshot(snapshot, new Set(['goals']));
    }, 'goal:delete');
  }

  async getProjects(): Promise<ClimbingProject[]> { return (await this.getSnapshot()).projects; }

  async createProject(name: string, gradeInput: string): Promise<ClimbingProject> {
    validateProjectValues(name, gradeInput);
    const grade = normalizeVGradeInput(gradeInput);
    if (!grade) throw new Error('Project grade must be a supported V grade or V-grade range.');
    return this.mutations.run(async () => {
      const snapshot = await this.getSnapshot();
      const now = new Date().toISOString();
      const project: ClimbingProject = { id: createId('project'), name: name.trim(), grade, status: 'active', createdAt: now, updatedAt: now, milestones: [], photos: [] };
      snapshot.projects.unshift(project);
      await this.schema.writeSnapshot(snapshot, new Set(['projects']));
      return project;
    }, 'project:create');
  }

  async updateProject(projectId: string, update: { name: string; grade: string; status: ProjectStatus }): Promise<ClimbingProject> {
    validateProjectValues(update.name, update.grade);
    const grade = normalizeVGradeInput(update.grade);
    if (!grade) throw new Error('Project grade must be a supported V grade or V-grade range.');
    return this.mutations.run(async () => {
      const snapshot = await this.getSnapshot();
      const index = snapshot.projects.findIndex((project) => project.id === projectId);
      if (index < 0) throw new Error('Project not found.');
      const current = snapshot.projects[index];
      if (update.status === 'active' && projectHasCompletionEvidence(projectId, snapshot.sessions)) throw new Error('This project has a Completed climbing entry. Edit that entry before reopening the project.');
      const now = new Date().toISOString();
      const changed = current.name !== update.name.trim() || current.grade !== grade || current.status !== update.status;
      snapshot.projects[index] = {
        ...current,
        name: update.name.trim(),
        grade,
        status: update.status,
        updatedAt: changed ? now : current.updatedAt,
        completedAt: update.status === 'completed' ? current.completedAt ?? now : undefined,
        completionSource: update.status === 'completed' ? (current.completionSource === 'boulder' ? 'boulder' : 'manual') : undefined,
      };
      const reconciled = reconcileProjectsWithSessions(snapshot.projects, snapshot.sessions, { onlyProjectIds: new Set([projectId]), now });
      snapshot.projects = reconciled.projects;
      await this.schema.writeSnapshot(snapshot, new Set(['projects']));
      return snapshot.projects[index];
    }, 'project:update');
  }

  async updateProjectDetails(projectId: string, update: { name: string; grade: string; notes?: string; beta?: string }): Promise<ClimbingProject> {
    validateProjectValues(update.name, update.grade);
    const grade = normalizeVGradeInput(update.grade);
    if (!grade) throw new Error('Project grade must be a supported V grade or V-grade range.');
    return this.mutations.run(async () => {
      const snapshot = await this.getSnapshot();
      const index = snapshot.projects.findIndex((project) => project.id === projectId);
      if (index < 0) throw new Error('Project not found.');
      const current = snapshot.projects[index];
      const notes = optionalString(update.notes); const beta = optionalString(update.beta);
      const changed = current.name !== update.name.trim() || current.grade !== grade || current.notes !== notes || current.beta !== beta;
      const next = { ...current, name: update.name.trim(), grade, notes, beta, updatedAt: changed ? new Date().toISOString() : current.updatedAt };
      snapshot.projects[index] = next;
      await this.schema.writeSnapshot(snapshot, new Set(['projects']));
      return next;
    }, 'project:details');
  }

  async addProjectMilestone(projectId: string, title: string, note?: string): Promise<ProjectMilestone> {
    const cleaned = title.trim(); if (!cleaned) throw new Error('Milestone title cannot be empty.');
    return this.mutations.run(async () => {
      const snapshot = await this.getSnapshot(); const project = snapshot.projects.find((item) => item.id === projectId);
      if (!project) throw new Error('Project not found.');
      const now = new Date().toISOString(); const milestone = { id: createId('milestone'), title: cleaned, note: optionalString(note), createdAt: now };
      project.milestones.push(milestone); project.updatedAt = now;
      await this.schema.writeSnapshot(snapshot, new Set(['projects'])); return milestone;
    }, 'project:milestone:add');
  }

  async deleteProjectMilestone(projectId: string, milestoneId: string): Promise<void> {
    await this.mutations.run(async () => {
      const snapshot = await this.getSnapshot(); const project = snapshot.projects.find((item) => item.id === projectId);
      if (!project) throw new Error('Project not found.');
      if (!project.milestones.some((item) => item.id === milestoneId)) throw new Error('Project milestone not found.');
      project.milestones = project.milestones.filter((item) => item.id !== milestoneId); project.updatedAt = new Date().toISOString();
      await this.schema.writeSnapshot(snapshot, new Set(['projects']));
    }, 'project:milestone:delete');
  }

  async addProjectPhoto(projectId: string, photo: ProjectPhoto): Promise<ClimbingProject> {
    validateProjectPhoto(photo);
    return this.mutations.run(async () => {
      const snapshot = await this.getSnapshot(); const project = snapshot.projects.find((item) => item.id === projectId);
      if (!project) throw new Error('Project not found.');
      if (!project.photos.some((item) => item.id === photo.id || item.uri === photo.uri)) {
        project.photos.push(photo); project.updatedAt = new Date().toISOString(); await this.schema.writeSnapshot(snapshot, new Set(['projects']));
      }
      return project;
    }, 'project:photo:add');
  }

  async removeProjectPhoto(projectId: string, photoId: string): Promise<ClimbingProject> {
    const id = photoId.trim(); if (!id) throw new Error('Project photo ID cannot be empty.');
    return this.mutations.run(async () => {
      const snapshot = await this.getSnapshot(); const project = snapshot.projects.find((item) => item.id === projectId);
      if (!project) throw new Error('Project not found.');
      const photos = project.photos.filter((item) => item.id !== id);
      if (photos.length !== project.photos.length) { project.photos = photos; project.updatedAt = new Date().toISOString(); await this.schema.writeSnapshot(snapshot, new Set(['projects'])); }
      return project;
    }, 'project:photo:remove');
  }

  async completeProject(projectId: string): Promise<void> {
    await this.mutations.run(async () => {
      const snapshot = await this.getSnapshot(); const project = snapshot.projects.find((item) => item.id === projectId);
      if (!project) throw new Error('Project not found.'); if (project.status === 'completed') return;
      const now = new Date().toISOString(); project.status = 'completed'; project.completedAt = now; project.completionSource = 'manual'; project.updatedAt = now;
      await this.schema.writeSnapshot(snapshot, new Set(['projects']));
    }, 'project:complete');
  }

  async deleteProject(projectId: string): Promise<void> {
    await this.mutations.run(async () => {
      const snapshot = await this.getSnapshot(); if (!snapshot.projects.some((project) => project.id === projectId)) throw new Error('Project not found.');
      snapshot.projects = snapshot.projects.filter((project) => project.id !== projectId);
      snapshot.sessions = snapshot.sessions.map((session) => ({ ...session, boulders: session.boulders.map((boulder) => boulder.projectId === projectId ? { ...boulder, projectId: undefined } : boulder) }));
      await this.schema.writeSnapshot(snapshot, new Set(['sessions', 'projects']));
    }, 'project:delete');
  }

  getMutationQueueSnapshot() { return this.mutations.snapshot(); }
}

export { calculateClimbingStats, getHighestGrade, gradeToNumber };
