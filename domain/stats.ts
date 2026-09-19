import { gradeToNumber } from './grades';
import { isAchievedResult } from './invariants';
import type { Boulder, ClimbingSession, ClimbingStats } from './models';

export function getHighestGrade(boulders: Boulder[]): string | null {
  const achieved = boulders.filter((boulder) => isAchievedResult(boulder.result));
  if (achieved.length === 0) return null;
  return achieved.reduce((best, current) => gradeToNumber(current.grade) > gradeToNumber(best.grade) ? current : best).grade;
}

export function calculateClimbingStats(sessions: ClimbingSession[]): ClimbingStats {
  const boulders = sessions.flatMap((session) => session.boulders);
  const flashes = boulders.filter((b) => b.result === 'Flash').length;
  const sends = boulders.filter((b) => b.result === 'Send').length;
  const projects = boulders.filter((b) => b.result === 'Project').length;
  const completed = boulders.filter((b) => b.result === 'Completed').length;
  const attempts = boulders.reduce((sum, boulder) => sum + boulder.attempts, 0);
  return {
    totalBoulders: boulders.length,
    totalSessions: sessions.length,
    flashes,
    sends,
    projects,
    completed,
    attempts,
    flashRate: boulders.length > 0 ? (flashes / boulders.length) * 100 : 0,
    highestGrade: getHighestGrade(boulders),
  };
}
