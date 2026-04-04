import type { GenerationLifecycleState, TaskRuntimePayload } from '@/lib/generation-lifecycle';

export type { TaskRuntimePayload };

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
  can_delete: boolean;
}

export interface HistoryTaskDetail {
  task: {
    id: string;
    topic: string;
    status: string;
    reference_mode?: string | null;
    [key: string]: unknown;
  };
  runtime: TaskRuntimePayload;
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

export type CreateStep =
  | 'idle'
  | 'understanding'
  | 'searching'
  | 'strategizing'
  | 'generating'
  | 'completed'
  | 'failed';

export type RuntimeLogStep = CreateStep | 'persisting';
export type CreateLifecycleState = GenerationLifecycleState | 'idle';
export type GenerationLogSource = 'client' | 'server' | 'system';

export interface GenerationLogEntry {
  id: string;
  at: string;
  source: GenerationLogSource;
  event: string;
  message: string;
  step?: RuntimeLogStep;
  detail?: string;
}

export interface StudioTaskContext {
  taskId: string | null;
  outputId: string | null;
  detail: HistoryTaskDetail | null;
}
