import type {
  CreateFormValues,
  CreateLifecycleState,
  CreateStep,
  GenerationCompletePayload,
  GenerationLogEntry,
  GenerationLogSource,
  HistoryTaskDetail,
  HistoryTaskSummary,
  ImageAssetPayload,
  ImageConfigValues,
  ImageJobSnapshotPayload,
  ImagePlanPayload,
  ImageProvider,
  ImageProviderPayload,
  ReferencesPayload,
  RuntimeLogStep,
  StrategySnapshotPayload,
  TaskRuntimePayload,
  TaskUnderstandingPayload,
} from './models';

export type {
  CreateFormValues,
  CreateLifecycleState,
  CreateStep,
  GenerationCompletePayload,
  GenerationLogEntry,
  GenerationLogSource,
  HistoryTaskDetail,
  HistoryTaskSummary,
  ImageAssetPayload,
  ImageConfigValues,
  ImageJobSnapshotPayload,
  ImagePlanPayload,
  ImageProvider,
  ImageProviderPayload,
  ReferencesPayload,
  RuntimeLogStep,
  StrategySnapshotPayload,
  TaskRuntimePayload,
  TaskUnderstandingPayload,
};

export interface CreatePageState {
  form: CreateFormValues;
  imageConfig: ImageConfigValues;
  imageProviders: ImageProviderPayload[];
  defaultImageProvider: ImageProvider | null;
  isSubmitting: boolean;
  error: string | null;
  step: CreateStep;
  lifecycleState: CreateLifecycleState;
  taskId: string | null;
  runtime: TaskRuntimePayload | null;
  taskUnderstanding: TaskUnderstandingPayload | null;
  references: ReferencesPayload | null;
  strategySnapshot: StrategySnapshotPayload | null;
  generationText: string;
  outputs: GenerationCompletePayload | null;
  generationLogs: GenerationLogEntry[];
  lastServerEventAt: string | null;
  currentStepStartedAt: string | null;
  submitStartedAt: string | null;
  clockNow: string | null;
  idleWarningForStep: CreateStep | null;
  streamClosedUnexpectedly: boolean;
  isLogPanelExpanded: boolean;
  historyTasks: HistoryTaskSummary[];
  isHistoryLoading: boolean;
  historyError: string | null;
  selectedHistoryTaskId: string | null;
  selectedHistoryOutputId: string | null;
  selectedHistoryDetail: HistoryTaskDetail | null;
  isImageLoading: boolean;
  imageError: string | null;
}

export type CreateStreamEvent =
  | { event: 'task_created'; data: { task_id: string } }
  | { event: 'lifecycle'; data: TaskRuntimePayload & { task_id: string } }
  | { event: 'status'; data: { step: RuntimeLogStep; message: string } }
  | { event: 'task_understanding'; data: TaskUnderstandingPayload }
  | { event: 'references'; data: ReferencesPayload }
  | { event: 'strategy_snapshot'; data: StrategySnapshotPayload }
  | { event: 'generation_delta'; data: { text: string } }
  | { event: 'generation_complete'; data: GenerationCompletePayload }
  | { event: 'done'; data: { task_id: string } }
  | { event: 'error'; data: { message: string; step: string } };

export type CreatePageAction =
  | { type: 'form_changed'; field: keyof CreateFormValues; value: string | boolean }
  | { type: 'image_config_changed'; field: keyof ImageConfigValues; value: string | number }
  | { type: 'image_providers_loaded'; providers: ImageProviderPayload[]; defaultProvider: ImageProvider | null }
  | { type: 'submit_started'; now?: string }
  | { type: 'submit_failed'; message: string; now?: string }
  | { type: 'stream_event'; event: CreateStreamEvent['event']; data: CreateStreamEvent['data']; receivedAt?: string }
  | {
    type: 'log_appended';
    source: GenerationLogSource;
    event: string;
    message: string;
    at?: string;
    step?: RuntimeLogStep;
    detail?: string;
  }
  | { type: 'clock_ticked'; now?: string }
  | { type: 'idle_warning_triggered'; now?: string }
  | { type: 'stream_closed'; now?: string; expectedTerminal: boolean }
  | { type: 'log_panel_toggled' }
  | { type: 'copy_context_loaded'; detail: HistoryTaskDetail }
  | { type: 'history_list_requested' }
  | { type: 'history_list_loaded'; tasks: HistoryTaskSummary[] }
  | { type: 'history_detail_requested'; taskId: string; outputId?: string | null }
  | { type: 'history_detail_loaded'; taskId: string; outputId?: string | null; detail: HistoryTaskDetail }
  | { type: 'image_action_started' }
  | { type: 'image_plan_loaded'; taskId: string; outputId: string; plan: ImagePlanPayload }
  | { type: 'image_job_snapshot_loaded'; taskId: string; snapshot: ImageJobSnapshotPayload }
  | { type: 'image_asset_selected'; taskId: string; asset: ImageAssetPayload }
  | { type: 'image_failed'; message: string }
  | { type: 'history_failed'; message: string };

export function createInitialCreateState(): CreatePageState {
  return {
    form: {
      topic: '',
      targetAudience: '',
      goal: '',
      stylePreference: '',
      personaMode: 'balanced',
      needCoverSuggestion: true,
    },
    imageConfig: {
      provider: 'openai',
      visualDirectionOverride: '',
      bodyPageCap: 4,
      coverCandidateCount: 2,
      bodyCandidateCount: 1,
    },
    imageProviders: [],
    defaultImageProvider: null,
    isSubmitting: false,
    error: null,
    step: 'idle',
    lifecycleState: 'idle',
    taskId: null,
    runtime: null,
    taskUnderstanding: null,
    references: null,
    strategySnapshot: null,
    generationText: '',
    outputs: null,
    generationLogs: [],
    lastServerEventAt: null,
    currentStepStartedAt: null,
    submitStartedAt: null,
    clockNow: null,
    idleWarningForStep: null,
    streamClosedUnexpectedly: false,
    isLogPanelExpanded: false,
    historyTasks: [],
    isHistoryLoading: false,
    historyError: null,
    selectedHistoryTaskId: null,
    selectedHistoryOutputId: null,
    selectedHistoryDetail: null,
    isImageLoading: false,
    imageError: null,
  };
}

function createTimestamp(now?: string): string {
  return now ?? new Date().toISOString();
}

function appendGenerationLog(
  state: CreatePageState,
  params: {
    source: GenerationLogSource;
    event: string;
    message: string;
    at?: string;
    step?: RuntimeLogStep;
    detail?: string;
  },
): CreatePageState {
  const at = createTimestamp(params.at);

  return {
    ...state,
    generationLogs: [
      ...state.generationLogs,
      {
        id: `log-${state.generationLogs.length + 1}`,
        at,
        source: params.source,
        event: params.event,
        message: params.message,
        step: params.step,
        detail: params.detail,
      },
    ],
  };
}

function updateVisibleStep(
  state: CreatePageState,
  nextStep: CreateStep,
  at: string,
): CreatePageState {
  if (state.step === nextStep) {
    return {
      ...state,
      clockNow: at,
    };
  }

  return {
    ...state,
    step: nextStep,
    currentStepStartedAt: at,
    clockNow: at,
    idleWarningForStep: null,
  };
}

function applyServerEventMetadata(
  state: CreatePageState,
  at: string,
): CreatePageState {
  return {
    ...state,
    lastServerEventAt: at,
    clockNow: at,
  };
}

function mapRuntimeStepToVisibleStep(
  step: RuntimeLogStep,
  currentStep: CreateStep,
): CreateStep {
  switch (step) {
    case 'idle':
    case 'understanding':
    case 'searching':
    case 'strategizing':
    case 'generating':
    case 'completed':
    case 'failed':
      return step;
    case 'persisting':
      return currentStep;
  }
}

function markRuntimeProgress(
  state: CreatePageState,
  at: string,
  step: TaskRuntimePayload['current_step'],
): CreatePageState {
  if (!state.runtime) {
    return state;
  }

  return {
    ...state,
    runtime: {
      ...state.runtime,
      current_step: step,
      last_progress_at: at,
      last_heartbeat_at: state.runtime.last_heartbeat_at ?? at,
    },
  };
}

function mergeImageAssets(
  assets: ImageAssetPayload[],
  selectedAsset: ImageAssetPayload,
): { assets: ImageAssetPayload[]; selected_assets: ImageAssetPayload[] } {
  const nextAssets = assets.map((asset) => asset.plan_page_id === selectedAsset.plan_page_id
    ? { ...asset, is_selected: asset.id === selectedAsset.id }
    : asset);

  return {
    assets: nextAssets,
    selected_assets: nextAssets.filter((asset) => asset.is_selected),
  };
}

function mergeImageJobSnapshot(
  detail: HistoryTaskDetail,
  snapshot: ImageJobSnapshotPayload,
): HistoryTaskDetail {
  const latestImagePlan = detail.latest_image_plan && detail.latest_image_plan.plan.id === snapshot.plan.id
    ? {
      ...detail.latest_image_plan,
      assets: snapshot.assets,
      selected_assets: snapshot.selected_assets,
    }
    : detail.latest_image_plan;

  return {
    ...detail,
    latest_image_plan: latestImagePlan,
    active_image_job: ['queued', 'running'].includes(snapshot.job.status)
      ? snapshot.job
      : null,
  };
}

export function applyStreamEvent(
  state: CreatePageState,
  event: CreateStreamEvent,
  receivedAt = new Date().toISOString(),
): CreatePageState {
  const nextState = applyServerEventMetadata(state, receivedAt);

  switch (event.event) {
    case 'task_created':
      return appendGenerationLog({
        ...nextState,
        taskId: event.data.task_id,
      }, {
        source: 'server',
        event: 'task_created',
        message: '任务已创建，可通过 URL 继续查看',
        at: receivedAt,
        step: state.step === 'idle' ? 'understanding' : state.step,
      });
    case 'lifecycle': {
      const previousLifecycle = state.runtime?.lifecycle_state ?? state.lifecycleState;
      const nextLifecycle = event.data.lifecycle_state;
      const nextStep = event.data.current_step
        ? mapRuntimeStepToVisibleStep(event.data.current_step, nextState.step)
        : nextState.step;

      let withRuntime: CreatePageState = {
        ...nextState,
        lifecycleState: nextLifecycle,
        taskId: event.data.task_id,
        runtime: {
          lifecycle_state: event.data.lifecycle_state,
          current_step: event.data.current_step,
          started_at: event.data.started_at,
          last_progress_at: event.data.last_progress_at,
          last_heartbeat_at: event.data.last_heartbeat_at,
          stalled_at: event.data.stalled_at,
          failed_at: event.data.failed_at,
          stalled_reason: event.data.stalled_reason,
          failure_reason: event.data.failure_reason,
        },
      };

      if (nextLifecycle === 'failed') {
        withRuntime = {
          ...updateVisibleStep(withRuntime, 'failed', receivedAt),
          isSubmitting: false,
          error: event.data.failure_reason ?? state.error,
          isLogPanelExpanded: true,
        };
      } else if (nextLifecycle === 'completed') {
        withRuntime = {
          ...updateVisibleStep(withRuntime, 'completed', receivedAt),
          isSubmitting: false,
        };
      } else {
        withRuntime = updateVisibleStep(withRuntime, nextStep, receivedAt);
      }

      if (previousLifecycle !== 'stalled' && nextLifecycle === 'stalled') {
        return appendGenerationLog(withRuntime, {
          source: 'system',
          event: 'lifecycle_stalled',
          message: `任务进入 stalled：${event.data.stalled_reason ?? '当前阶段超过允许的无进展窗口'}`,
          at: receivedAt,
          step: event.data.current_step ?? undefined,
          detail: event.data.stalled_reason ?? undefined,
        });
      }

      if (previousLifecycle === 'stalled' && nextLifecycle === 'running') {
        return appendGenerationLog(withRuntime, {
          source: 'system',
          event: 'lifecycle_recovered',
          message: '任务已恢复运行',
          at: receivedAt,
          step: event.data.current_step ?? undefined,
        });
      }

      return withRuntime;
    }
    case 'status': {
      const visibleStep = mapRuntimeStepToVisibleStep(event.data.step, nextState.step);

      return appendGenerationLog(
        updateVisibleStep({
          ...nextState,
          lifecycleState: nextState.lifecycleState === 'idle' ? 'running' : nextState.lifecycleState,
        }, visibleStep, receivedAt),
        {
          source: 'server',
          event: 'status',
          message: event.data.message,
          at: receivedAt,
          step: event.data.step,
        },
      );
    }
    case 'task_understanding':
      return appendGenerationLog(markRuntimeProgress({
        ...updateVisibleStep(nextState, 'understanding', receivedAt),
        lifecycleState: nextState.lifecycleState === 'idle' ? 'running' : nextState.lifecycleState,
        taskUnderstanding: event.data,
      }, receivedAt, 'understanding'), {
        source: 'server',
        event: 'task_understanding',
        message: '任务理解完成',
        at: receivedAt,
        step: 'understanding',
      });
    case 'references':
      return appendGenerationLog(markRuntimeProgress({
        ...updateVisibleStep(nextState, 'searching', receivedAt),
        lifecycleState: nextState.lifecycleState === 'idle' ? 'running' : nextState.lifecycleState,
        references: event.data,
      }, receivedAt, 'searching'), {
        source: 'server',
        event: 'references',
        message: '参考检索完成',
        at: receivedAt,
        step: 'searching',
      });
    case 'strategy_snapshot': {
      const isFirstSnapshot = state.strategySnapshot == null;
      const becameFinal = Boolean(event.data.strategy_summary) && !state.strategySnapshot?.strategy_summary;
      let withSnapshot: CreatePageState = {
        ...markRuntimeProgress(updateVisibleStep(nextState, 'strategizing', receivedAt), receivedAt, 'strategizing'),
        lifecycleState: nextState.lifecycleState === 'idle' ? 'running' : nextState.lifecycleState,
        strategySnapshot: {
          ...state.strategySnapshot,
          ...event.data,
        },
      };

      if (isFirstSnapshot) {
        withSnapshot = appendGenerationLog(withSnapshot, {
          source: 'server',
          event: 'strategy_snapshot',
          message: '收到首个策略快照',
          at: receivedAt,
          step: 'strategizing',
        });
      }

      if (becameFinal) {
        withSnapshot = appendGenerationLog(withSnapshot, {
          source: 'server',
          event: 'strategy_snapshot_final',
          message: '策略已定稿',
          at: receivedAt,
          step: 'strategizing',
        });
      }

      return withSnapshot;
    }
    case 'generation_delta': {
      const shouldLogStart = state.step !== 'generating';
      let withText: CreatePageState = {
        ...markRuntimeProgress(updateVisibleStep(nextState, 'generating', receivedAt), receivedAt, 'generating'),
        lifecycleState: nextState.lifecycleState === 'idle' ? 'running' : nextState.lifecycleState,
        generationText: `${state.generationText}${event.data.text}`,
      };

      if (shouldLogStart) {
        withText = appendGenerationLog(withText, {
          source: 'server',
          event: 'generation_delta_start',
          message: '正文流已开始',
          at: receivedAt,
          step: 'generating',
        });
      }

      return withText;
    }
    case 'generation_complete':
      return appendGenerationLog({
        ...markRuntimeProgress(updateVisibleStep(nextState, 'completed', receivedAt), receivedAt, 'persisting'),
        lifecycleState: 'completed',
        isSubmitting: false,
        outputs: event.data,
      }, {
        source: 'server',
        event: 'generation_complete',
        message: '结构化结果已生成',
        at: receivedAt,
        step: 'persisting',
      });
    case 'done':
      return appendGenerationLog({
        ...updateVisibleStep(nextState, 'completed', receivedAt),
        isSubmitting: false,
        lifecycleState: 'completed',
        taskId: event.data.task_id,
        streamClosedUnexpectedly: false,
      }, {
        source: 'server',
        event: 'done',
        message: '任务完成',
        at: receivedAt,
        step: 'completed',
      });
    case 'error':
      return appendGenerationLog({
        ...updateVisibleStep(nextState, 'failed', receivedAt),
        isSubmitting: false,
        lifecycleState: 'failed',
        error: event.data.message,
        isLogPanelExpanded: true,
      }, {
        source: 'server',
        event: 'error',
        message: `生成失败：${event.data.message}`,
        at: receivedAt,
        step: event.data.step as RuntimeLogStep,
        detail: event.data.step,
      });
  }
}

export function createPageReducer(
  state: CreatePageState,
  action: CreatePageAction,
): CreatePageState {
  switch (action.type) {
    case 'form_changed':
      return {
        ...state,
        form: {
          ...state.form,
          [action.field]: action.value,
        },
      };
    case 'image_config_changed':
      return {
        ...state,
        imageConfig: {
          ...state.imageConfig,
          [action.field]: action.value,
        },
      };
    case 'image_providers_loaded': {
      const nextProvider = state.selectedHistoryDetail?.latest_image_plan?.plan.provider
        ?? action.defaultProvider
        ?? state.imageConfig.provider;

      return {
        ...state,
        imageProviders: action.providers,
        defaultImageProvider: action.defaultProvider,
        imageConfig: {
          ...state.imageConfig,
          provider: nextProvider,
        },
      };
    }
    case 'submit_started':
      return {
        ...state,
        isSubmitting: true,
        error: null,
        step: 'understanding',
        lifecycleState: 'queued',
        taskId: null,
        runtime: null,
        taskUnderstanding: null,
        references: null,
        strategySnapshot: null,
        generationText: '',
        outputs: null,
        generationLogs: [],
        lastServerEventAt: null,
        currentStepStartedAt: createTimestamp(action.now),
        submitStartedAt: createTimestamp(action.now),
        clockNow: createTimestamp(action.now),
        idleWarningForStep: null,
        streamClosedUnexpectedly: false,
        isLogPanelExpanded: true,
      };
    case 'submit_failed':
      return appendGenerationLog({
        ...state,
        isSubmitting: false,
        step: 'failed',
        lifecycleState: 'failed',
        error: action.message,
        clockNow: createTimestamp(action.now),
        isLogPanelExpanded: true,
      }, {
        source: 'system',
        event: 'submit_failed',
        message: `生成请求失败：${action.message}`,
        at: action.now,
        step: 'failed',
      });
    case 'log_appended':
      return appendGenerationLog(state, action);
    case 'clock_ticked':
      return {
        ...state,
        clockNow: createTimestamp(action.now),
      };
    case 'idle_warning_triggered':
      if (!state.isSubmitting || state.idleWarningForStep === state.step) {
        return state;
      }

      return appendGenerationLog({
        ...state,
        clockNow: createTimestamp(action.now),
        idleWarningForStep: state.step,
        isLogPanelExpanded: true,
      }, {
        source: 'system',
        event: 'idle_warning',
        message: '当前阶段长时间没有新的业务进展，仍在等待服务端返回',
        at: action.now,
        step: state.step,
      });
    case 'stream_closed':
      if (action.expectedTerminal) {
        return appendGenerationLog(state, {
          source: 'client',
          event: 'stream_closed',
          message: '事件流已正常关闭',
          at: action.now,
          step: state.step,
        });
      }

      return appendGenerationLog({
        ...state,
        isSubmitting: false,
        step: 'failed',
        lifecycleState: 'failed',
        error: state.error ?? '事件流已提前关闭，请查看运行日志。',
        streamClosedUnexpectedly: true,
        isLogPanelExpanded: true,
        clockNow: createTimestamp(action.now),
      }, {
        source: 'system',
        event: 'stream_closed_unexpectedly',
        message: '事件流已关闭，但未收到 done 或 error',
        at: action.now,
        step: state.step,
      });
    case 'log_panel_toggled':
      return {
        ...state,
        isLogPanelExpanded: !state.isLogPanelExpanded,
      };
    case 'copy_context_loaded': {
      const runtimeStep = action.detail.runtime.current_step
        ? mapRuntimeStepToVisibleStep(action.detail.runtime.current_step, state.step)
        : state.outputs
          ? 'completed'
          : 'idle';

      return {
        ...state,
        form: {
          ...state.form,
          topic: typeof action.detail.task.topic === 'string' ? action.detail.task.topic : state.form.topic,
          targetAudience: typeof action.detail.task.target_audience === 'string' ? action.detail.task.target_audience : state.form.targetAudience,
          goal: typeof action.detail.task.goal === 'string' ? action.detail.task.goal : state.form.goal,
          stylePreference: typeof action.detail.task.style_preference === 'string' ? action.detail.task.style_preference : state.form.stylePreference,
        },
        isSubmitting: false,
        error: action.detail.runtime.failure_reason,
        step: action.detail.outputs ? 'completed' : runtimeStep,
        lifecycleState: action.detail.outputs ? 'completed' : action.detail.runtime.lifecycle_state,
        taskId: action.detail.task.id,
        runtime: action.detail.runtime,
        strategySnapshot: action.detail.strategy as StrategySnapshotPayload | null,
        generationText: action.detail.outputs?.body_versions[0] ?? '',
        outputs: action.detail.outputs,
        submitStartedAt: action.detail.runtime.started_at ?? state.submitStartedAt,
        currentStepStartedAt: action.detail.runtime.last_progress_at
          ?? action.detail.runtime.started_at
          ?? state.currentStepStartedAt,
        clockNow: createTimestamp(),
      };
    }
    case 'history_list_requested':
      return {
        ...state,
        isHistoryLoading: true,
        historyError: null,
      };
    case 'history_list_loaded':
      return {
        ...state,
        historyTasks: action.tasks,
        isHistoryLoading: false,
        historyError: null,
      };
    case 'history_detail_requested':
      return {
        ...state,
        selectedHistoryTaskId: action.taskId,
        selectedHistoryOutputId: action.taskId === state.selectedHistoryTaskId
          ? action.outputId ?? state.selectedHistoryOutputId
          : action.outputId ?? null,
        isHistoryLoading: true,
        historyError: null,
      };
    case 'history_detail_loaded':
      return {
        ...state,
        selectedHistoryTaskId: action.taskId,
        selectedHistoryOutputId: action.outputId ?? action.detail.selected_output_id,
        selectedHistoryDetail: action.detail,
        imageConfig: {
          ...state.imageConfig,
          provider: action.detail.latest_image_plan?.plan.provider ?? state.defaultImageProvider ?? state.imageConfig.provider,
        },
        isHistoryLoading: false,
        historyError: null,
      };
    case 'image_action_started':
      return {
        ...state,
        isImageLoading: true,
        imageError: null,
      };
    case 'image_plan_loaded':
      return {
        ...state,
        isImageLoading: false,
        imageError: null,
        selectedHistoryOutputId: action.outputId,
        selectedHistoryDetail: state.selectedHistoryDetail?.task.id === action.taskId
          ? {
            ...state.selectedHistoryDetail,
            selected_output_id: action.outputId,
            latest_image_plan: action.plan,
            active_image_job: null,
          }
          : state.selectedHistoryDetail,
        imageConfig: {
          ...state.imageConfig,
          provider: action.plan.plan.provider,
        },
      };
    case 'image_job_snapshot_loaded':
      return {
        ...state,
        isImageLoading: false,
        imageError: null,
        selectedHistoryDetail: state.selectedHistoryDetail?.task.id === action.taskId
          ? mergeImageJobSnapshot(state.selectedHistoryDetail, action.snapshot)
          : state.selectedHistoryDetail,
      };
    case 'image_asset_selected':
      return {
        ...state,
        isImageLoading: false,
        imageError: null,
        selectedHistoryDetail: state.selectedHistoryDetail?.task.id === action.taskId &&
          state.selectedHistoryDetail.latest_image_plan
          ? {
            ...state.selectedHistoryDetail,
            latest_image_plan: {
              ...state.selectedHistoryDetail.latest_image_plan,
              ...mergeImageAssets(
                state.selectedHistoryDetail.latest_image_plan.assets,
                action.asset,
              ),
            },
          }
          : state.selectedHistoryDetail,
      };
    case 'image_failed':
      return {
        ...state,
        isImageLoading: false,
        imageError: action.message,
      };
    case 'history_failed':
      return {
        ...state,
        isHistoryLoading: false,
        historyError: action.message,
      };
    case 'stream_event':
      return applyStreamEvent(state, {
        event: action.event,
        data: action.data,
      } as CreateStreamEvent, action.receivedAt);
    default:
      return state;
  }
}
