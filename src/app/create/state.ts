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
  titles: string[];
  openings: string[];
  body_versions: string[];
  cta_versions: string[];
  cover_copies: Array<{ main: string; sub?: string }>;
  hashtags: string[];
  first_comment: string;
  image_suggestions: string;
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
  outputs: GenerationCompletePayload | null;
  reference_mode: string | null;
  feedback: Record<string, unknown> | null;
}

export interface CreatePageState {
  form: CreateFormValues;
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
  selectedHistoryDetail: HistoryTaskDetail | null;
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
  | { type: 'submit_started' }
  | { type: 'submit_failed'; message: string }
  | { type: 'stream_event'; event: CreateStreamEvent['event']; data: CreateStreamEvent['data'] }
  | { type: 'history_list_requested' }
  | { type: 'history_list_loaded'; tasks: HistoryTaskSummary[] }
  | { type: 'history_detail_requested'; taskId: string }
  | { type: 'history_detail_loaded'; taskId: string; detail: HistoryTaskDetail }
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
    selectedHistoryDetail: null,
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
        isHistoryLoading: true,
        historyError: null,
      };
    case 'history_detail_loaded':
      return {
        ...state,
        selectedHistoryTaskId: action.taskId,
        selectedHistoryDetail: action.detail,
        isHistoryLoading: false,
        historyError: null,
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
