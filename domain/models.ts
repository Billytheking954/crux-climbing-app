export type BoulderResult = 'Flash' | 'Send' | 'Attempt' | 'Project' | 'Completed';

export type Boulder = {
  id: string;
  sessionId: string;
  projectId?: string;
  name?: string;
  grade: string;
  result: BoulderResult;
  attempts: number;
  terrain?: string;
  holdType?: string | string[];
  movementType?: string | string[];
  createdAt: string;
};

export type ClimbingSession = {
  id: string;
  gymName: string;
  startedAt: string;
  finishedAt?: string;
  boulders: Boulder[];
};

export type ClimbingStats = {
  totalBoulders: number;
  totalSessions: number;
  flashes: number;
  sends: number;
  projects: number;
  completed: number;
  attempts: number;
  flashRate: number;
  highestGrade: string | null;
};

export type GoalType = 'grade' | 'sessions' | 'boulders' | 'flashes' | 'sends';

export type ClimbingGoal = {
  id: string;
  type: GoalType;
  title: string;
  target: number;
  createdAt: string;
  completedAt?: string;
};

export type ProjectStatus = 'active' | 'completed';
export type ProjectCompletionSource = 'manual' | 'boulder';

export type ProjectPhoto = {
  id: string;
  uri: string;
  createdAt: string;
  sanitized: boolean;
  width?: number;
  height?: number;
  mimeType?: string;
  sizeBytes?: number;
};

export type ProjectMilestone = {
  id: string;
  title: string;
  note?: string;
  createdAt: string;
};

export type ClimbingProject = {
  id: string;
  name: string;
  grade: string;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  completionSource?: ProjectCompletionSource;
  notes?: string;
  beta?: string;
  milestones: ProjectMilestone[];
  photos: ProjectPhoto[];
};

export type CruxSnapshot = {
  sessions: ClimbingSession[];
  goals: ClimbingGoal[];
  projects: ClimbingProject[];
};
