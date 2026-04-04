import { query, queryOne } from '@/lib/db';
import type { GenerationOutput } from '@/agents/generation';
import type { StrategyResult } from '@/agents/schemas/strategy';
import type { TaskInput, TaskReferencesSelection } from '@/agents/strategy';
import type { TaskRuntimePayload } from '@/lib/generation-lifecycle';
import { imageGenerationRepository, type ImageGenerationJobRow, type ImagePlanDetail, type OutputVersionSummary } from '@/app/api/image-generation/repository';

type QueryResult<T> = Promise<T[]>;
type QueryOneResult<T> = Promise<T | null>;

type ImageGenerationRepositoryLike = Pick<
  typeof imageGenerationRepository,
  'listOutputVersions' | 'getLatestImagePlanForOutput' | 'getActiveImageJob'
>;

export interface TaskRow {
  id: string;
  topic: string;
  target_audience: string | null;
  goal: string | null;
  style_preference: string | null;
  persona_mode: string | null;
  need_cover_suggestion: boolean | null;
  style_profile_id: string | null;
  status: string;
  current_step: string | null;
  reference_mode: string | null;
  started_at: string | null;
  last_progress_at: string | null;
  last_heartbeat_at: string | null;
  stalled_at: string | null;
  failed_at: string | null;
  stalled_reason: string | null;
  failure_reason: string | null;
  created_at: string;
}

export interface UpdateTaskPatch {
  status?: string;
  currentStep?: string | null;
  referenceMode?: string | null;
  startedAt?: string | null;
  lastProgressAt?: string | null;
  lastHeartbeatAt?: string | null;
  stalledAt?: string | null;
  failedAt?: string | null;
  stalledReason?: string | null;
  failureReason?: string | null;
}

export interface GetTaskHistoryParams {
  page: number;
  limit: number;
}

export interface GenerationRepositoryDependencies {
  query: <T>(text: string, params?: unknown[]) => QueryResult<T>;
  queryOne: <T>(text: string, params?: unknown[]) => QueryOneResult<T>;
  imageGenerationRepository: ImageGenerationRepositoryLike;
}

interface TaskDeleteGuardRow {
  task_status: string;
  active_image_job_status: string | null;
}

type TaskHistorySummaryRow = Pick<
  TaskRow,
  'id' | 'topic' | 'status' | 'reference_mode' | 'created_at'
> & {
  can_delete: boolean;
};

export type HardDeleteTaskResult =
  | { code: 'deleted' }
  | { code: 'not_found' }
  | { code: 'task_active' }
  | { code: 'image_job_active' };

function createDefaultGenerationRepositoryDependencies(): GenerationRepositoryDependencies {
  return {
    query,
    queryOne,
    imageGenerationRepository,
  };
}

export async function createTask(input: TaskInput): Promise<{ id: string }> {
  const row = await queryOne<{ id: string }>(
    `
      INSERT INTO generation_tasks (
        topic,
        target_audience,
        goal,
        style_preference,
        persona_mode,
        need_cover_suggestion,
        style_profile_id,
        status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'queued')
      RETURNING id
    `,
    [
      input.topic,
      input.targetAudience ?? null,
      input.goal ?? null,
      input.stylePreference ?? null,
      input.personaMode ?? 'balanced',
      input.needCoverSuggestion ?? true,
      input.styleProfileId ?? null,
    ],
  );

  if (!row) {
    throw new Error('Failed to create generation task');
  }

  return row;
}

export async function updateTask(
  taskId: string,
  patch: UpdateTaskPatch,
): Promise<void> {
  const assignments: string[] = [];
  const values: unknown[] = [taskId];

  const appendAssignment = (column: string, value: unknown) => {
    values.push(value);
    assignments.push(`${column} = $${values.length}`);
  };

  if (patch.status !== undefined) {
    appendAssignment('status', patch.status);
  }

  if (patch.currentStep !== undefined) {
    appendAssignment('current_step', patch.currentStep);
  }

  if (patch.referenceMode !== undefined) {
    appendAssignment('reference_mode', patch.referenceMode);
  }

  if (patch.startedAt !== undefined) {
    appendAssignment('started_at', patch.startedAt);
  }

  if (patch.lastProgressAt !== undefined) {
    appendAssignment('last_progress_at', patch.lastProgressAt);
  }

  if (patch.lastHeartbeatAt !== undefined) {
    appendAssignment('last_heartbeat_at', patch.lastHeartbeatAt);
  }

  if (patch.stalledAt !== undefined) {
    appendAssignment('stalled_at', patch.stalledAt);
  }

  if (patch.failedAt !== undefined) {
    appendAssignment('failed_at', patch.failedAt);
  }

  if (patch.stalledReason !== undefined) {
    appendAssignment('stalled_reason', patch.stalledReason);
  }

  if (patch.failureReason !== undefined) {
    appendAssignment('failure_reason', patch.failureReason);
  }

  if (assignments.length === 0) {
    return;
  }

  await query(
    `
      UPDATE generation_tasks
      SET ${assignments.join(', ')}
      WHERE id = $1
    `,
    values,
  );
}

export async function saveTaskReferences(
  taskId: string,
  selection: TaskReferencesSelection,
): Promise<void> {
  await query(`DELETE FROM task_references WHERE task_id = $1`, [taskId]);

  for (const reference of selection.selected_references) {
    await query(
      `
        INSERT INTO task_references (task_id, sample_id, reference_type, reason)
        VALUES ($1, $2, $3, $4)
      `,
      [taskId, reference.sample_id, reference.reference_type, reference.reason],
    );
  }
}

export async function saveTaskStrategy(
  taskId: string,
  strategy: StrategyResult,
): Promise<void> {
  await query(
    `
      INSERT INTO task_strategy (
        task_id,
        strategy_summary,
        content_direction,
        title_strategy,
        opening_strategy,
        structure_strategy,
        cover_strategy,
        cta_strategy,
        warnings
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (task_id)
      DO UPDATE SET
        strategy_summary = EXCLUDED.strategy_summary,
        content_direction = EXCLUDED.content_direction,
        title_strategy = EXCLUDED.title_strategy,
        opening_strategy = EXCLUDED.opening_strategy,
        structure_strategy = EXCLUDED.structure_strategy,
        cover_strategy = EXCLUDED.cover_strategy,
        cta_strategy = EXCLUDED.cta_strategy,
        warnings = EXCLUDED.warnings
    `,
    [
      taskId,
      strategy.strategy_summary,
      strategy.content_direction,
      strategy.title_strategy,
      strategy.opening_strategy ?? null,
      strategy.structure_strategy,
      strategy.cover_strategy ?? null,
      strategy.cta_strategy ?? null,
      strategy.warnings ?? [],
    ],
  );
}

export async function saveTaskOutputs(
  taskId: string,
  output: GenerationOutput,
): Promise<void> {
  await query(
    `
      INSERT INTO generation_outputs (
        task_id,
        titles,
        openings,
        body_versions,
        cta_versions,
        cover_copies,
        hashtags,
        first_comment,
        image_suggestions,
        model_name
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `,
    [
      taskId,
      JSON.stringify(output.titles),
      JSON.stringify(output.openings),
      JSON.stringify(output.body_versions),
      JSON.stringify(output.cta_versions),
      JSON.stringify(output.cover_copies),
      output.hashtags,
      output.first_comment,
      output.image_suggestions,
      process.env.LLM_MODEL_GENERATION ?? 'gpt-4o',
    ],
  );
}

async function getTaskHistoryWith(
  dependencies: GenerationRepositoryDependencies,
  { page, limit }: GetTaskHistoryParams,
): Promise<{
  tasks: TaskHistorySummaryRow[];
  total: number;
}> {
  const offset = (page - 1) * limit;
  const totalRow = await dependencies.queryOne<{ total: number }>(
    `SELECT COUNT(*)::int AS total FROM generation_tasks`,
  );
  const tasks = await dependencies.query<TaskHistorySummaryRow>(
    `
      SELECT
        gt.id,
        gt.topic,
        gt.status,
        gt.reference_mode,
        gt.created_at,
        CASE
          WHEN gt.status NOT IN ('completed', 'failed') THEN FALSE
          WHEN EXISTS (
            SELECT 1
            FROM generation_outputs go
            INNER JOIN image_plans ip ON ip.output_id = go.id
            INNER JOIN image_generation_jobs jobs ON jobs.plan_id = ip.id
            WHERE go.task_id = gt.id
              AND jobs.status IN ('queued', 'running')
          ) THEN FALSE
          ELSE TRUE
        END AS can_delete
      FROM generation_tasks gt
      ORDER BY created_at DESC
      LIMIT $1 OFFSET $2
    `,
    [limit, offset],
  );

  return {
    tasks,
    total: totalRow?.total ?? 0,
  };
}

async function getTaskDetailWith(
  dependencies: GenerationRepositoryDependencies,
  taskId: string,
  options?: { selectedOutputId?: string | null },
): Promise<{
  task: TaskRow;
  runtime: TaskRuntimePayload;
  strategy: Record<string, unknown> | null;
  references: Array<Record<string, unknown>>;
  output_versions: OutputVersionSummary[];
  selected_output_id: string | null;
  outputs: Record<string, unknown> | null;
  latest_image_plan: ImagePlanDetail | null;
  active_image_job: ImageGenerationJobRow | null;
  reference_mode: string | null;
  feedback: Record<string, unknown> | null;
} | null> {
  const task = await dependencies.queryOne<TaskRow>(
    `
      SELECT
        id,
        topic,
        target_audience,
        goal,
        style_preference,
        persona_mode,
        need_cover_suggestion,
        style_profile_id,
        status,
        current_step,
        reference_mode,
        started_at,
        last_progress_at,
        last_heartbeat_at,
        stalled_at,
        failed_at,
        stalled_reason,
        failure_reason,
        created_at
      FROM generation_tasks
      WHERE id = $1
    `,
    [taskId],
  );

  if (!task) {
    return null;
  }

  const strategy = await dependencies.queryOne<Record<string, unknown>>(
    `
      SELECT
        strategy_summary,
        content_direction,
        title_strategy,
        opening_strategy,
        structure_strategy,
        cover_strategy,
        cta_strategy,
        warnings,
        created_at
      FROM task_strategy
      WHERE task_id = $1
    `,
    [taskId],
  );

  const references = await dependencies.query<Record<string, unknown>>(
    `
      SELECT
        tr.sample_id,
        s.title,
        tr.reference_type,
        tr.reason
      FROM task_references tr
      LEFT JOIN samples s ON s.id = tr.sample_id
      WHERE tr.task_id = $1
      ORDER BY tr.id ASC
    `,
    [taskId],
  );

  const outputVersions = await dependencies.imageGenerationRepository.listOutputVersions(taskId);
  const selectedOutputId = outputVersions.some((output) => output.id === options?.selectedOutputId)
    ? options?.selectedOutputId ?? null
    : outputVersions[0]?.id ?? null;

  const outputs = selectedOutputId
    ? await dependencies.queryOne<Record<string, unknown>>(
      `
        SELECT
          id,
          task_id,
          titles,
          openings,
          body_versions,
          cta_versions,
          cover_copies,
          hashtags,
          first_comment,
          image_suggestions,
          model_name,
          version,
          created_at
        FROM generation_outputs
        WHERE id = $1
      `,
      [selectedOutputId],
    )
    : null;

  const latestImagePlan = selectedOutputId
    ? await dependencies.imageGenerationRepository.getLatestImagePlanForOutput(selectedOutputId)
    : null;

  const activeImageJob = latestImagePlan
    ? await dependencies.imageGenerationRepository.getActiveImageJob(latestImagePlan.plan.id)
    : null;

  const feedback = await dependencies.queryOne<Record<string, unknown>>(
    `
      SELECT
        selected_title_index,
        selected_body_index,
        used_in_publish,
        publish_metrics,
        manual_feedback,
        created_at
      FROM task_feedback
      WHERE task_id = $1
      ORDER BY created_at DESC
      LIMIT 1
    `,
    [taskId],
  );

  const runtime: TaskRuntimePayload = {
    lifecycle_state: task.status as TaskRuntimePayload['lifecycle_state'],
    current_step: task.current_step as TaskRuntimePayload['current_step'],
    started_at: task.started_at,
    last_progress_at: task.last_progress_at,
    last_heartbeat_at: task.last_heartbeat_at,
    stalled_at: task.stalled_at,
    failed_at: task.failed_at,
    stalled_reason: task.stalled_reason,
    failure_reason: task.failure_reason,
  };

  return {
    task,
    runtime,
    strategy,
    references,
    output_versions: outputVersions,
    selected_output_id: selectedOutputId,
    outputs,
    latest_image_plan: latestImagePlan,
    active_image_job: activeImageJob,
    reference_mode: task.reference_mode,
    feedback,
  };
}

async function hardDeleteTaskWith(
  dependencies: GenerationRepositoryDependencies,
  taskId: string,
): Promise<HardDeleteTaskResult> {
  const guard = await dependencies.queryOne<TaskDeleteGuardRow>(
    `
      SELECT
        gt.status AS task_status,
        (
          SELECT jobs.status
          FROM generation_outputs go
          INNER JOIN image_plans ip ON ip.output_id = go.id
          INNER JOIN image_generation_jobs jobs ON jobs.plan_id = ip.id
          WHERE go.task_id = gt.id
            AND jobs.status IN ('queued', 'running')
          ORDER BY jobs.created_at DESC
          LIMIT 1
        ) AS active_image_job_status
      FROM generation_tasks gt
      WHERE gt.id = $1
    `,
    [taskId],
  );

  if (!guard) {
    return { code: 'not_found' };
  }

  if (!['completed', 'failed'].includes(guard.task_status)) {
    return { code: 'task_active' };
  }

  if (guard.active_image_job_status && ['queued', 'running'].includes(guard.active_image_job_status)) {
    return { code: 'image_job_active' };
  }

  const deleted = await dependencies.queryOne<{ id: string }>(
    `
      DELETE FROM generation_tasks
      WHERE id = $1
      RETURNING id
    `,
    [taskId],
  );

  return deleted ? { code: 'deleted' } : { code: 'not_found' };
}

export function createGenerationRepository(
  dependencies: GenerationRepositoryDependencies = createDefaultGenerationRepositoryDependencies(),
) {
  return {
    getTaskHistory(params: GetTaskHistoryParams) {
      return getTaskHistoryWith(dependencies, params);
    },
    getTaskDetail(taskId: string, options?: { selectedOutputId?: string | null }) {
      return getTaskDetailWith(dependencies, taskId, options);
    },
    hardDeleteTask(taskId: string) {
      return hardDeleteTaskWith(dependencies, taskId);
    },
  };
}

const generationRepository = createGenerationRepository();

export async function getTaskHistory(params: GetTaskHistoryParams) {
  return generationRepository.getTaskHistory(params);
}

export async function getTaskDetail(
  taskId: string,
  options?: { selectedOutputId?: string | null },
) {
  return generationRepository.getTaskDetail(taskId, options);
}

export async function hardDeleteTask(taskId: string) {
  return generationRepository.hardDeleteTask(taskId);
}
