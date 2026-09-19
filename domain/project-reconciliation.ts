import { resultSupportsProjectLink } from './invariants';
import type { ClimbingProject, ClimbingSession } from './models';

function getCompletionDates(sessions: ClimbingSession[]): Map<string, string> {
  const dates = new Map<string, string>();
  for (const session of sessions) {
    for (const boulder of session.boulders) {
      if (!boulder.projectId || boulder.result !== 'Completed') continue;
      const existing = dates.get(boulder.projectId);
      if (!existing || new Date(boulder.createdAt).getTime() < new Date(existing).getTime()) dates.set(boulder.projectId, boulder.createdAt);
    }
  }
  return dates;
}

export function sanitizeSessionProjectLinks(sessions: ClimbingSession[], projects: ClimbingProject[]): ClimbingSession[] {
  const ids = new Set(projects.map((project) => project.id));
  return sessions.map((session) => ({
    ...session,
    boulders: session.boulders.map((boulder) => boulder.projectId
      ? ids.has(boulder.projectId) && resultSupportsProjectLink(boulder.result) ? boulder : { ...boulder, projectId: undefined }
      : boulder),
  }));
}

export function projectHasCompletionEvidence(projectId: string, sessions: ClimbingSession[]): boolean {
  return sessions.some((session) => session.boulders.some((boulder) => boulder.projectId === projectId && boulder.result === 'Completed'));
}

export function reconcileProjectsWithSessions(
  projects: ClimbingProject[],
  sessions: ClimbingSession[],
  options?: { onlyProjectIds?: Set<string>; now?: string },
): { projects: ClimbingProject[]; changed: boolean } {
  const dates = getCompletionDates(sessions);
  const now = options?.now ?? new Date().toISOString();
  let changed = false;
  const next = projects.map((project) => {
    if (options?.onlyProjectIds && !options.onlyProjectIds.has(project.id)) return project;
    if (project.status === 'completed' && project.completionSource === 'manual') return project;
    const date = dates.get(project.id);
    if (date) {
      const candidateUpdated = Number.isFinite(new Date(project.updatedAt).getTime()) && new Date(project.updatedAt).getTime() > new Date(date).getTime() ? project.updatedAt : date;
      if (project.status === 'completed' && project.completionSource === 'boulder' && project.completedAt === date && project.updatedAt === candidateUpdated) return project;
      changed = true;
      return { ...project, status: 'completed' as const, completedAt: date, completionSource: 'boulder' as const, updatedAt: candidateUpdated };
    }
    if (project.completionSource === 'boulder') {
      changed = true;
      return { ...project, status: 'active' as const, completedAt: undefined, completionSource: undefined, updatedAt: now };
    }
    return project;
  });
  return { projects: next, changed };
}

export function projectCompletionStateMatchesSessions(projects: ClimbingProject[], sessions: ClimbingSession[]): boolean {
  const dates = getCompletionDates(sessions);
  for (const project of projects) {
    if (project.completionSource === 'manual') {
      if (project.status !== 'completed' || !project.completedAt) return false;
      continue;
    }
    const date = dates.get(project.id);
    if (date) {
      if (project.status !== 'completed' || project.completionSource !== 'boulder' || project.completedAt !== date) return false;
    } else if (project.status === 'completed' || project.completedAt || project.completionSource === 'boulder') return false;
  }
  return true;
}
