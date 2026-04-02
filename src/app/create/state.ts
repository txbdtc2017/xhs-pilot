export interface CreateFormValues {
  topic: string;
  targetAudience: string;
  goal: string;
  stylePreference: string;
  personaMode: 'balanced' | 'self' | 'strong_style';
  needCoverSuggestion: boolean;
}

export interface TaskUnderstandingPayload {
  task_type: string;
  suitable_structure?: string;
  reference_focus?: string[];
  notes?: string;
  search_filters: {
    track: string;
    content_type?: string[];
    title_pattern_hints?: string[];
  };
  rewritten_query: string;
  goal?: string;
}

export interface SelectedReferencePayload {
  sample_id: string;
  title: string;
  similarity: number;
  reference_type: 'title' | 'structure' | 'visual' | 'tone';
  reason: string;
}

export interface ReferencesPayload {
  search_mode: 'hybrid' | 'lexical-only' | 'misconfigured';
  search_mode_reason?: string | null;
  reference_mode: 'zero-shot' | 'referenced';
  candidate_count: number;
  selected_references: SelectedReferencePayload[];
}

export interface StrategySnapshotPayload {
  content_direction?: string;
  title_strategy?: string;
  opening_strategy?: string;
  structure_strategy?: string;
  cover_strategy?: string;
  cta_strategy?: string;
  warnings?: string[];
  strategy_summary?: string;
}

export interface GenerationCompletePayload {
  id?: string;
  task_id?: string;
  version?: number;
  model_name?: string | null;
  created_at?: string;
  titles: string[];
  openings: string[];
  body_versions: string[];
  cta_versions: string[];
  cover_copies: Array<{ main: string; sub?: string }>;
  hashtags: string[];
  first_comment: string;
  image_suggestions: string;
}

export type ImageProvider = 'openai' | 'google_vertex';

export interface ImageProviderPayload {
  provider: ImageProvider;
  label: string;
  available: boolean;
  model: string;
  code?: string;
  message?: string;
}

export interface ImageConfigValues {
  provider: ImageProvider;
  visualDirectionOverride: string;
  bodyPageCap: number;
  coverCandidateCount: number;
  bodyCandidateCount: number;
}

export interface OutputVersionPayload {
  id: string;
  version: number;
  model_name: string | null;
  created_at: string;
}

export interface ImagePlanPagePayload {
  id: string;
  plan_id: string;
  sort_order: number;
  page_role: string;
  is_enabled: boolean;
  content_purpose: string;
  source_excerpt: string;
  visual_type: string;
  style_reason: string;
  prompt_summary: string;
  prompt_text: string;
  candidate_count: number;
}

export interface ImageAssetPayload {
  id: string;
  plan_page_id: string;
  image_url: string | null;
  candidate_index: number;
  is_selected: boolean;
}

export interface ImagePlanPayload {
  plan: {
    id: string;
    output_id: string;
    status: string;
    provider: ImageProvider;
    provider_model: string;
    visual_direction_override?: string | null;
    body_page_cap?: number;
    cover_candidate_count?: number;
    body_candidate_count?: number;
    system_decision_summary?: string;
    created_at?: string;
    superseded_at?: string | null;
  };
  pages: ImagePlanPagePayload[];
  assets: ImageAssetPayload[];
  selected_assets: ImageAssetPayload[];
}

export interface ImageJobPayload {
  id: string;
  plan_id: string;
  scope: 'full' | 'page';
  plan_page_id: string | null;
  provider: ImageProvider;
  status: string;
  total_units: number;
  completed_units: number;
  error_message: string | null;
  model_name: string;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
}

export interface ImageJobSnapshotPayload {
  job: ImageJobPayload;
  plan: {
    id: string;
    output_id: string;
    status: string;
    provider: ImageProvider;
    provider_model: string;
  };
  pages: Array<Pick<ImagePlanPagePayload, 'id' | 'sort_order' | 'page_role' | 'is_enabled' | 'candidate_count'>>;
  assets: ImageAssetPayload[];
  selected_assets: ImageAssetPayload[];
}

export interface HistoryTaskSummary {
  id: string;
  topic: string;
  status: string;
  reference_mode: string | null;
  created_at: string;
}

export interface HistoryTaskDetail {
  task: {
    id: string;
    topic: string;
    status: string;
    reference_mode?: string | null;
    [key: string]: unknown;
  };
  strategy: Record<string, unknown> | null;
  references: Array<Record<string, unknown>>;
  output_versions: OutputVersionPayload[];
  selected_output_id: string | null;
  outputs: GenerationCompletePayload | null;
  latest_image_plan: ImagePlanPayload | null;
  active_image_job: ImageJobPayload | null;
  reference_mode: string | null;
  feedback: Record<string, unknown> | null;
}

export interface CreatePageState {
  form: CreateFormValues;
  imageConfig: ImageConfigValues;
  imageProviders: ImageProviderPayload[];
  defaultImageProvider: ImageProvider | null;
  isSubmitting: boolean;
  error: string | null;
  step: 'idle' | 'understanding' | 'searching' | 'strategizing' | 'generating' | 'completed' | 'failed';
  taskId: string | null;
  taskUnderstanding: TaskUnderstandingPayload | null;
  references: ReferencesPayload | null;
  strategySnapshot: StrategySnapshotPayload | null;
  generationText: string;
  outputs: GenerationCompletePayload | null;
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
  | { type: 'submit_started' }
  | { type: 'submit_failed'; message: string }
  | { type: 'stream_event'; event: CreateStreamEvent['event']; data: CreateStreamEvent['data'] }
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
    taskId: null,
    taskUnderstanding: null,
    references: null,
    strategySnapshot: null,
    generationText: '',
    outputs: null,
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
): CreatePageState {
  switch (event.event) {
    case 'task_understanding':
      return {
        ...state,
        step: 'understanding',
        taskUnderstanding: event.data,
      };
    case 'references':
      return {
        ...state,
        step: 'searching',
        references: event.data,
      };
    case 'strategy_snapshot':
      return {
        ...state,
        step: 'strategizing',
        strategySnapshot: {
          ...state.strategySnapshot,
          ...event.data,
        },
      };
    case 'generation_delta':
      return {
        ...state,
        step: 'generating',
        generationText: `${state.generationText}${event.data.text}`,
      };
    case 'generation_complete':
      return {
        ...state,
        step: 'completed',
        isSubmitting: false,
        outputs: event.data,
      };
    case 'done':
      return {
        ...state,
        step: 'completed',
        isSubmitting: false,
        taskId: event.data.task_id,
      };
    case 'error':
      return {
        ...state,
        step: 'failed',
        isSubmitting: false,
        error: event.data.message,
      };
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
        taskId: null,
        taskUnderstanding: null,
        references: null,
        strategySnapshot: null,
        generationText: '',
        outputs: null,
      };
    case 'submit_failed':
      return {
        ...state,
        isSubmitting: false,
        step: 'failed',
        error: action.message,
      };
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
      return applyStreamEvent(state, action as unknown as CreateStreamEvent);
  }
}
