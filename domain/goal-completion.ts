/**
 * Lifetime goals can already be met when they are created. Store the later
 * of the actual achievement date and goal creation date so completedAt
 * never precedes createdAt (which would invalidate persisted goals).
 */
export function clampGoalCompletionDateToCreation(createdAt: string, achievedAt: string): string {
  return new Date(achievedAt).getTime() < new Date(createdAt).getTime() ? createdAt : achievedAt;
}
