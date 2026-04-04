export type GenerationStep =
  | 'understanding'
  | 'searching'
  | 'strategizing'
  | 'generating'
  | 'persisting';

export type GenerationLifecycleState =
  | 'queued'
  | 'running'
  | 'stalled'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface TaskRuntimePayload {
  lifecycle_state: GenerationLifecycleState;
  current_step: GenerationStep | null;
  started_at: string | null;
  last_progress_at: string | null;
  last_heartbeat_at: string | null;
  stalled_at: string | null;
  failed_at: string | null;
  stalled_reason: string | null;
  failure_reason: string | null;
}

export interface GenerationStepThresholds {
  quietWarningMs: number;
  stallMs: number;
  deadMs: number;
}

export interface GenerationLifecycleEvaluation {
  snapshot: TaskRuntimePayload;
  didWarn: boolean;
  stateChanged: boolean;
  shouldAbort: boolean;
}

const DEFAULT_STEP_THRESHOLDS: Record<GenerationStep, GenerationStepThresholds> = {
  understanding: {
    quietWarningMs: 15_000,
    stallMs: 45_000,
    deadMs: 90_000,
  },
  searching: {
    quietWarningMs: 15_000,
    stallMs: 45_000,
    deadMs: 90_000,
  },
  strategizing: {
    quietWarningMs: 20_000,
    stallMs: 60_000,
    deadMs: 180_000,
  },
  generating: {
    quietWarningMs: 20_000,
    stallMs: 60_000,
    deadMs: 180_000,
  },
  persisting: {
    quietWarningMs: 10_000,
    stallMs: 30_000,
    deadMs: 60_000,
  },
};

function elapsedMs(from: string | null, to: string): number {
  if (!from) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.max(0, Date.parse(to) - Date.parse(from));
}

export function getGenerationStepThresholds(step: GenerationStep): GenerationStepThresholds {
  return DEFAULT_STEP_THRESHOLDS[step];
}

export class GenerationLifecycleTracker {
  #snapshot: TaskRuntimePayload;
  #quietWarningIssuedForStep: GenerationStep | null = null;

  constructor(input: {
    currentStep: GenerationStep;
    now: string;
  }) {
    this.#snapshot = {
      lifecycle_state: 'running',
      current_step: input.currentStep,
      started_at: input.now,
      last_progress_at: input.now,
      last_heartbeat_at: input.now,
      stalled_at: null,
      failed_at: null,
      stalled_reason: null,
      failure_reason: null,
    };
  }

  get snapshot(): TaskRuntimePayload {
    return { ...this.#snapshot };
  }

  recordHeartbeat(now: string): TaskRuntimePayload {
    if (this.#isTerminal()) {
      return this.snapshot;
    }

    this.#snapshot.last_heartbeat_at = now;
    return this.snapshot;
  }

  recordProgress(input: {
    now: string;
    currentStep?: GenerationStep | null;
  }): TaskRuntimePayload {
    if (this.#isTerminal()) {
      return this.snapshot;
    }

    if (input.currentStep !== undefined) {
      this.#snapshot.current_step = input.currentStep;
    }

    this.#snapshot.lifecycle_state = 'running';
    this.#snapshot.last_progress_at = input.now;
    this.#snapshot.last_heartbeat_at = input.now;
    this.#snapshot.stalled_at = null;
    this.#snapshot.stalled_reason = null;
    this.#quietWarningIssuedForStep = null;
    return this.snapshot;
  }

  complete(now: string): TaskRuntimePayload {
    this.#snapshot.lifecycle_state = 'completed';
    this.#snapshot.last_progress_at = now;
    this.#snapshot.last_heartbeat_at = now;
    this.#snapshot.stalled_at = null;
    this.#snapshot.stalled_reason = null;
    return this.snapshot;
  }

  fail(now: string, reason: string): TaskRuntimePayload {
    this.#snapshot.lifecycle_state = 'failed';
    this.#snapshot.failed_at = now;
    this.#snapshot.failure_reason = reason;
    this.#snapshot.last_heartbeat_at = now;
    return this.snapshot;
  }

  evaluate(now: string): GenerationLifecycleEvaluation {
    const step = this.#snapshot.current_step;
    if (!step || this.#isTerminal()) {
      return {
        snapshot: this.snapshot,
        didWarn: false,
        stateChanged: false,
        shouldAbort: false,
      };
    }

    const thresholds = getGenerationStepThresholds(step);
    const quietElapsed = elapsedMs(this.#snapshot.last_progress_at ?? this.#snapshot.started_at, now);
    const heartbeatElapsed = elapsedMs(this.#snapshot.last_heartbeat_at ?? this.#snapshot.started_at, now);
    let didWarn = false;
    let stateChanged = false;

    if (heartbeatElapsed > thresholds.deadMs) {
      this.fail(now, `${step} 阶段超过心跳 dead threshold，未收到 heartbeat，任务已判定失败。`);
      return {
        snapshot: this.snapshot,
        didWarn: false,
        stateChanged: true,
        shouldAbort: true,
      };
    }

    if (quietElapsed > thresholds.quietWarningMs && this.#quietWarningIssuedForStep !== step) {
      this.#quietWarningIssuedForStep = step;
      didWarn = true;
    }

    if (this.#snapshot.lifecycle_state === 'stalled') {
      const stalledElapsed = elapsedMs(this.#snapshot.stalled_at, now);
      if (stalledElapsed > thresholds.deadMs) {
        this.fail(now, `${step} 阶段 stalled 持续超过 dead threshold，任务已判定失败。`);
        return {
          snapshot: this.snapshot,
          didWarn,
          stateChanged: true,
          shouldAbort: true,
        };
      }

      return {
        snapshot: this.snapshot,
        didWarn,
        stateChanged: false,
        shouldAbort: false,
      };
    }

    if (quietElapsed > thresholds.stallMs) {
      this.#snapshot.lifecycle_state = 'stalled';
      this.#snapshot.stalled_at = now;
      this.#snapshot.stalled_reason = `${step} 阶段超过允许的无进展窗口`;
      stateChanged = true;
    }

    return {
      snapshot: this.snapshot,
      didWarn,
      stateChanged,
      shouldAbort: false,
    };
  }

  #isTerminal(): boolean {
    return this.#snapshot.lifecycle_state === 'completed'
      || this.#snapshot.lifecycle_state === 'failed'
      || this.#snapshot.lifecycle_state === 'cancelled';
  }
}
