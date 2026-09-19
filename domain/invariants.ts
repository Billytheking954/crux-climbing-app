import { isSupportedVGradeValue } from './grades';
import type { BoulderResult, ClimbingGoal, ClimbingProject, ClimbingSession, GoalType, ProjectPhoto } from './models';

export const MAX_SUPPORTED_V_GRADE = 17;

export function isValidDateString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && Number.isFinite(new Date(value).getTime());
}

export function isBoulderResult(value: unknown): value is BoulderResult {
  return value === 'Flash' || value === 'Send' || value === 'Attempt' || value === 'Project' || value === 'Completed';
}

export function isGoalType(value: unknown): value is GoalType {
  return value === 'grade' || value === 'sessions' || value === 'boulders' || value === 'flashes' || value === 'sends';
}

export function resultSupportsProjectLink(result: BoulderResult): boolean {
  return result === 'Project' || result === 'Completed';
}

export function isAchievedResult(result: BoulderResult): boolean {
  return result === 'Flash' || result === 'Send' || result === 'Completed';
}

export function validateBoulderInput(input: {
  projectId?: string; grade: string; result: BoulderResult; attempts: number;
}): void {
  if (!input.grade.trim() || !isSupportedVGradeValue(input.grade)) {
    throw new Error('Boulder grade must be a supported V grade or V-grade range.');
  }
  if (!Number.isSafeInteger(input.attempts) || input.attempts < 1) {
    throw new Error('Boulder attempts must be a whole number of at least 1.');
  }
  if (input.result === 'Flash' && input.attempts !== 1) throw new Error('A flash must have exactly 1 attempt.');
  if (input.result === 'Send' && input.attempts < 2) throw new Error('A send must have at least 2 attempts.');
  if (input.projectId && !resultSupportsProjectLink(input.result)) {
    throw new Error('Only Project or Completed entries can link to a project.');
  }
}

export function validateSessionUpdate(
  current: ClimbingSession,
  sessions: ClimbingSession[],
  update: { gymName: string; startedAt: string; finishedAt?: string },
): void {
  if (!update.gymName.trim()) throw new Error('Gym name cannot be empty.');
  if (!isValidDateString(update.startedAt)) throw new Error('Invalid session start date.');
  if (update.finishedAt && !isValidDateString(update.finishedAt)) throw new Error('Invalid session finish date.');
  const start = new Date(update.startedAt).getTime();
  const finish = update.finishedAt ? new Date(update.finishedAt).getTime() : undefined;
  if (finish !== undefined && finish < start) throw new Error('Session finish time cannot be before the start time.');
  for (const boulder of current.boulders) {
    const at = new Date(boulder.createdAt).getTime();
    if (at < start) throw new Error('Session start time cannot be after a boulder that was logged in this session.');
    if (finish !== undefined && at > finish) throw new Error('Session finish time cannot be before a boulder that was logged in this session.');
  }
  if (!update.finishedAt && sessions.some((session) => session.id !== current.id && !session.finishedAt)) {
    throw new Error('Another climbing session is already active.');
  }
}

export function validateGoalValues(type: GoalType, title: string, target: number): void {
  if (!title.trim()) throw new Error('Goal title cannot be empty.');
  if (!Number.isSafeInteger(target)) throw new Error('Goal target must be a whole number.');
  if (type === 'grade') {
    if (target < 0 || target > MAX_SUPPORTED_V_GRADE) throw new Error(`Grade goal target must be between V0 and V${MAX_SUPPORTED_V_GRADE}.`);
  } else if (target <= 0) throw new Error('Goal target must be greater than zero.');
}

export function validateGoal(goal: ClimbingGoal): void {
  validateGoalValues(goal.type, goal.title, goal.target);
  if (!goal.id.trim()) throw new Error('Goal ID cannot be empty.');
  if (!isValidDateString(goal.createdAt)) throw new Error('Goal creation date is invalid.');
  if (goal.completedAt) {
    if (!isValidDateString(goal.completedAt)) throw new Error('Goal completion date is invalid.');
    if (new Date(goal.completedAt).getTime() < new Date(goal.createdAt).getTime()) throw new Error('Goal completion date cannot be before its creation date.');
  }
}

export function validateProjectValues(name: string, grade: string): void {
  if (!name.trim()) throw new Error('Project name cannot be empty.');
  if (!grade.trim() || !isSupportedVGradeValue(grade)) throw new Error('Project grade must be a supported V grade or V-grade range.');
}

export function validateProjectPhoto(photo: ProjectPhoto): void {
  if (!photo.id.trim()) throw new Error('Project photo ID cannot be empty.');
  if (!photo.uri.trim()) throw new Error('Project photo URI cannot be empty.');
  if (!isValidDateString(photo.createdAt)) throw new Error('Project photo creation date is invalid.');
  for (const dimension of [photo.width, photo.height]) {
    if (dimension !== undefined && (!Number.isFinite(dimension) || dimension <= 0)) throw new Error('Project photo dimensions must be positive finite numbers.');
  }
  if (photo.sizeBytes !== undefined && (!Number.isFinite(photo.sizeBytes) || photo.sizeBytes <= 0)) throw new Error('Project photo size must be a positive finite number.');
}

function assertUniqueIds(items: { id: string }[], label: string): void {
  const ids = new Set<string>();
  for (const item of items) {
    if (ids.has(item.id)) throw new Error(`Duplicate ${label} ID detected: ${item.id}`);
    ids.add(item.id);
  }
}

export function assertSnapshotIntegrity(sessions: ClimbingSession[], goals: ClimbingGoal[], projects: ClimbingProject[]): void {
  assertUniqueIds(sessions, 'session');
  assertUniqueIds(goals, 'goal');
  assertUniqueIds(projects, 'project');
  const boulders = sessions.flatMap((session) => session.boulders);
  assertUniqueIds(boulders, 'boulder');
  if (sessions.filter((session) => !session.finishedAt).length > 1) throw new Error('More than one active session exists.');
  const projectIds = new Set(projects.map((project) => project.id));
  for (const session of sessions) {
    const start = new Date(session.startedAt).getTime();
    const finish = session.finishedAt ? new Date(session.finishedAt).getTime() : undefined;
    if (finish !== undefined && finish < start) throw new Error(`Session ${session.id} finishes before it starts.`);
    for (const boulder of session.boulders) {
      if (boulder.sessionId !== session.id) throw new Error(`Boulder ${boulder.id} has an invalid session link.`);
      const at = new Date(boulder.createdAt).getTime();
      if (at < start || (finish !== undefined && at > finish)) throw new Error(`Boulder ${boulder.id} falls outside its session timeline.`);
      validateBoulderInput(boulder);
      if (boulder.projectId && !projectIds.has(boulder.projectId)) throw new Error(`Boulder ${boulder.id} references a missing project.`);
    }
  }
  goals.forEach(validateGoal);
  for (const project of projects) {
    validateProjectValues(project.name, project.grade);
    if (!isValidDateString(project.createdAt) || !isValidDateString(project.updatedAt)) throw new Error(`Project ${project.id} has an invalid timestamp.`);
    assertUniqueIds(project.milestones, `milestone in project ${project.id}`);
    assertUniqueIds(project.photos, `photo in project ${project.id}`);
    const uris = new Set<string>();
    for (const photo of project.photos) {
      validateProjectPhoto(photo);
      if (uris.has(photo.uri)) throw new Error(`Project ${project.id} contains a duplicate photo URI.`);
      uris.add(photo.uri);
    }
  }
}
