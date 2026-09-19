import { StorageDataError } from '@/data/persistence/storage-errors';
import { cruxRepository } from '@/data/repositories';
import type { BoulderInput } from '@/data/repositories/crux-repository';
import { gradeToNumber, calculateClimbingStats, getHighestGrade } from '@/data/repositories/crux-repository';
import type {
  Boulder,
  BoulderResult,
  ClimbingGoal,
  ClimbingProject,
  ClimbingSession,
  ClimbingStats,
  GoalType,
  ProjectCompletionSource,
  ProjectMilestone,
  ProjectPhoto,
  ProjectStatus,
} from '@/domain/models';

export type { Boulder, BoulderResult, ClimbingGoal, ClimbingProject, ClimbingSession, ClimbingStats, GoalType, ProjectCompletionSource, ProjectMilestone, ProjectPhoto, ProjectStatus };
export { StorageDataError, gradeToNumber, calculateClimbingStats, getHighestGrade };

export const getCruxSnapshot = () => cruxRepository.getSnapshot();
export const resetStorageRuntimeState = () => cruxRepository.resetRuntimeState();
export const getSessions = () => cruxRepository.getSessions();
export const createSession = (gymName: string, options?: { requireNew?: boolean }) => cruxRepository.createSession(gymName, options);
export const addBoulderToSession = (sessionId: string, input: BoulderInput) => cruxRepository.addBoulderToSession(sessionId, input);
export const updateBoulder = (sessionId: string, boulderId: string, input: BoulderInput) => cruxRepository.updateBoulder(sessionId, boulderId, input);
export const deleteBoulder = (sessionId: string, boulderId: string) => cruxRepository.deleteBoulder(sessionId, boulderId);
export const updateSession = (sessionId: string, update: { gymName: string; startedAt: string; finishedAt?: string }) => cruxRepository.updateSession(sessionId, update);
export const deleteSession = (sessionId: string) => cruxRepository.deleteSession(sessionId);
export const finishSession = (sessionId: string) => cruxRepository.finishSession(sessionId);
export const getSessionById = (sessionId: string) => cruxRepository.getSessionById(sessionId);
export const getAllBoulders = () => cruxRepository.getAllBoulders();
export const getGoals = () => cruxRepository.getGoals();
export const saveGoals = (goals: ClimbingGoal[]) => cruxRepository.saveGoals(goals);
export const createGoal = (type: GoalType, title: string, target: number) => cruxRepository.createGoal(type, title, target);
export const deleteGoal = (goalId: string) => cruxRepository.deleteGoal(goalId);
export const getProjects = () => cruxRepository.getProjects();
export const createProject = (name: string, grade: string) => cruxRepository.createProject(name, grade);
export const updateProject = (projectId: string, update: { name: string; grade: string; status: ProjectStatus }) => cruxRepository.updateProject(projectId, update);
export const updateProjectDetails = (projectId: string, update: { name: string; grade: string; notes?: string; beta?: string }) => cruxRepository.updateProjectDetails(projectId, update);
export const addProjectMilestone = (projectId: string, title: string, note?: string) => cruxRepository.addProjectMilestone(projectId, title, note);
export const deleteProjectMilestone = (projectId: string, milestoneId: string) => cruxRepository.deleteProjectMilestone(projectId, milestoneId);
export const addProjectPhoto = (projectId: string, photo: ProjectPhoto) => cruxRepository.addProjectPhoto(projectId, photo);
export const removeProjectPhoto = (projectId: string, photoId: string) => cruxRepository.removeProjectPhoto(projectId, photoId);
export const completeProject = (projectId: string) => cruxRepository.completeProject(projectId);
export const deleteProject = (projectId: string) => cruxRepository.deleteProject(projectId);
export const getMutationQueueSnapshot = () => cruxRepository.getMutationQueueSnapshot();
