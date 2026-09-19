import {
  addBoulderToSession,
  createSession,
  deleteBoulder,
  deleteSession,
  getCruxSnapshot,
  getMutationQueueSnapshot,
  getSessionById,
  updateBoulder,
} from '@/data/storage';

export type LifecycleStepStatus = 'waiting' | 'running' | 'passed' | 'failed' | 'skipped';

export type LifecycleStepResult = {
  step: number;
  label: string;
  status: LifecycleStepStatus;
  detail?: string;
};

export type DiagnosticError = {
  name: string;
  message: string;
  stack: string | null;
};

export type DiagnosticFailure = {
  step: number | null;
  stepLabel: string;
  error: DiagnosticError;
  storageState: unknown;
  cleanupError?: DiagnosticError;
};

export type LifecycleTestResult = {
  passed: boolean;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  sessionId: string | null;
  boulderId: string | null;
  steps: LifecycleStepResult[];
  failure?: DiagnosticFailure;
};

type ProgressCallback = (steps: LifecycleStepResult[]) => void;

const STEP_LABELS = [
  'Add Boulder',
  'Verify Boulder Saved',
  'Edit Boulder',
  'Verify Boulder Edit',
  'Delete Boulder',
  'Verify Boulder Deleted',
] as const;

const DIAGNOSTIC_GYM = 'CRUX Developer Diagnostics';
const DIAGNOSTIC_BOULDER = 'CRUX Lifecycle Fixture';

function initialSteps(): LifecycleStepResult[] {
  return STEP_LABELS.map((label, index) => ({ step: index + 1, label, status: 'waiting' }));
}

function cloneSteps(steps: LifecycleStepResult[]): LifecycleStepResult[] {
  return steps.map((step) => ({ ...step }));
}

function normalizeError(error: unknown): DiagnosticError {
  if (error instanceof Error) return { name: error.name, message: error.message, stack: error.stack ?? null };
  let message: string;
  try { message = typeof error === 'string' ? error : JSON.stringify(error); }
  catch { message = String(error); }
  return { name: 'UnknownError', message, stack: null };
}

async function captureRelevantStorageState(sessionId: string | null, boulderId: string | null): Promise<unknown> {
  try {
    const snapshot = await getCruxSnapshot();
    return {
      capturedAt: new Date().toISOString(),
      diagnosticIds: { sessionId, boulderId },
      counts: {
        sessions: snapshot.sessions.length,
        projects: snapshot.projects.length,
        goals: snapshot.goals.length,
      },
      activeSessionIds: snapshot.sessions.filter((session) => !session.finishedAt).map((session) => session.id),
      diagnosticSession: sessionId ? snapshot.sessions.find((session) => session.id === sessionId) ?? null : null,
      saveQueue: getMutationQueueSnapshot(),
    };
  } catch (error) {
    return {
      capturedAt: new Date().toISOString(),
      diagnosticIds: { sessionId, boulderId },
      snapshotCaptureFailed: true,
      error: normalizeError(error),
      saveQueue: getMutationQueueSnapshot(),
    };
  }
}

function boulderInput(grade: 'V2' | 'V3') {
  return {
    name: DIAGNOSTIC_BOULDER,
    grade,
    result: 'Send' as const,
    attempts: 2,
    terrain: 'Vertical',
    holdType: ['Jug'],
    movementType: ['Technical'],
  };
}

export async function runFullLifecycleTest(onProgress?: ProgressCallback): Promise<LifecycleTestResult> {
  const startedAt = new Date().toISOString();
  const startedMs = Date.now();
  const steps = initialSteps();
  let sessionId: string | null = null;
  let boulderId: string | null = null;
  let failure: DiagnosticFailure | undefined;

  const emit = () => onProgress?.(cloneSteps(steps));

  const recordFailure = async (step: number | null, stepLabel: string, error: unknown) => {
    failure = {
      step,
      stepLabel,
      error: normalizeError(error),
      storageState: await captureRelevantStorageState(sessionId, boulderId),
    };
  };

  const runStep = async (index: number, operation: () => Promise<string>): Promise<boolean> => {
    const step = steps[index];
    step.status = 'running'; emit();
    try {
      step.detail = await operation();
      step.status = 'passed'; emit();
      return true;
    } catch (error) {
      step.status = 'failed';
      step.detail = normalizeError(error).message;
      for (let later = index + 1; later < steps.length; later += 1) steps[later].status = 'skipped';
      emit();
      await recordFailure(step.step, step.label, error);
      return false;
    }
  };

  const finish = (): LifecycleTestResult => ({
    passed: !failure && steps.every((step) => step.status === 'passed'),
    startedAt,
    finishedAt: new Date().toISOString(),
    durationMs: Date.now() - startedMs,
    sessionId,
    boulderId,
    steps: cloneSteps(steps),
    failure,
  });

  const execute = async (): Promise<void> => {
    try {
      const before = await getCruxSnapshot();
      const active = before.sessions.find((session) => !session.finishedAt);
      if (active) {
        await recordFailure(null, 'Preflight: Active Session', new Error('Finish your current climbing session before running the storage lifecycle test. The diagnostic test will not touch a real active session.'));
        steps.forEach((step) => { step.status = 'skipped'; }); emit();
        return;
      }

      const diagnosticSession = await createSession(DIAGNOSTIC_GYM, { requireNew: true });
      sessionId = diagnosticSession.id;

      if (!await runStep(0, async () => {
        const boulder = await addBoulderToSession(diagnosticSession.id, boulderInput('V2'));
        boulderId = boulder.id;
        return `Created ${boulder.id} at V2.`;
      })) return;

      if (!await runStep(1, async () => {
        const session = await getSessionById(diagnosticSession.id);
        const boulder = session?.boulders.find((item) => item.id === boulderId);
        if (!boulder) throw new Error('The diagnostic Boulder was not found after saving.');
        if (boulder.grade !== 'V2') throw new Error(`Expected V2 after save but found ${boulder.grade}.`);
        return 'Read-back confirmed V2.';
      })) return;

      if (!await runStep(2, async () => {
        if (!boulderId) throw new Error('Diagnostic Boulder ID is unavailable.');
        await updateBoulder(diagnosticSession.id, boulderId, boulderInput('V3'));
        return 'Updated grade from V2 to V3.';
      })) return;

      if (!await runStep(3, async () => {
        const session = await getSessionById(diagnosticSession.id);
        const boulder = session?.boulders.find((item) => item.id === boulderId);
        if (!boulder) throw new Error('The diagnostic Boulder disappeared after editing.');
        if (boulder.grade !== 'V3') throw new Error(`Expected V3 after edit but found ${boulder.grade}.`);
        return 'Read-back confirmed V3.';
      })) return;

      if (!await runStep(4, async () => {
        if (!boulderId) throw new Error('Diagnostic Boulder ID is unavailable.');
        await deleteBoulder(diagnosticSession.id, boulderId);
        return 'Deleted diagnostic Boulder.';
      })) return;

      await runStep(5, async () => {
        const session = await getSessionById(diagnosticSession.id);
        if (!session) throw new Error('Diagnostic session disappeared before deletion verification.');
        if (session.boulders.some((item) => item.id === boulderId)) throw new Error('Deleted diagnostic Boulder still exists in storage.');
        return 'Read-back confirmed Boulder is absent.';
      });

      return;
    } catch (error) {
      if (!failure) await recordFailure(null, 'Diagnostic Runner', error);
      return;
    } finally {
      if (sessionId) {
        try {
          const session = await getSessionById(sessionId);
          if (session) await deleteSession(sessionId);
        } catch (cleanupError) {
          const normalized = normalizeError(cleanupError);
          if (failure) failure.cleanupError = normalized;
          else {
            failure = {
              step: null,
              stepLabel: 'Cleanup: Remove Diagnostic Session',
              error: normalized,
              storageState: await captureRelevantStorageState(sessionId, boulderId),
            };
          }
        }
      }
    }
  };
  await execute();
  return finish();
}

export function formatAiDiagnosticsReport(result: LifecycleTestResult): string {
  const lines = [
    'CRUX AI DIAGNOSTICS REPORT',
    '',
    'Test: Full Boulder Lifecycle',
    `Status: ${result.passed ? 'PASSED' : 'FAILED'}`,
    `Started: ${result.startedAt}`,
    `Finished: ${result.finishedAt}`,
    `Duration: ${result.durationMs} ms`,
  ];

  if (!result.failure) return lines.join('\n');
  const failure = result.failure;
  lines.push(
    '',
    `Failed step: ${failure.step === null ? failure.stepLabel : `Step ${failure.step}: ${failure.stepLabel}`}`,
    '',
    'ERROR',
    `Name: ${failure.error.name}`,
    `Message: ${failure.error.message}`,
    '',
    'STACK TRACE',
    failure.error.stack ?? 'No stack trace was available.',
    '',
    'DIAGNOSTIC IDS',
    JSON.stringify({ sessionId: result.sessionId, boulderId: result.boulderId }, null, 2),
    '',
    'RELEVANT STORAGE STATE',
    JSON.stringify(failure.storageState, null, 2),
  );

  if (failure.cleanupError) {
    lines.push('', 'CLEANUP ERROR', `Name: ${failure.cleanupError.name}`, `Message: ${failure.cleanupError.message}`, '', 'CLEANUP STACK TRACE', failure.cleanupError.stack ?? 'No cleanup stack trace was available.');
  }
  return lines.join('\n');
}
