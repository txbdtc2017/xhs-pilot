import { query, queryOne } from '@/lib/db';
import type { GenerationOutput } from '@/agents/generation';
import type { StrategyResult } from '@/agents/schemas/strategy';
import type { TaskInput, TaskReferencesSelection } from '@/agents/strategy';

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
  reference_mode: string | null;
  created_at: string;
}

export interface GetTaskHistoryParams {
  page: number;
  limit: number;
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
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
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
  patch: { status: string; referenceMode?: string },
): Promise<void> {
  await query(
    `
      UPDATE generation_tasks
      SET
        status = $2,
        reference_mode = COALESCE($3, reference_mode)
      WHERE id = $1
    `,
    [taskId, patch.status, patch.referenceMode ?? null],
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

export async function getTaskHistory({ page, limit }: GetTaskHistoryParams): Promise<{
  tasks: Array<Pick<TaskRow, 'id' | 'topic' | 'status' | 'reference_mode' | 'created_at'>>;
  total: number;
}> {
  const offset = (page - 1) * limit;
  const totalRow = await queryOne<{ total: number }>(
    `SELECT COUNT(*)::int AS total FROM generation_tasks`,
  );
  const tasks = await query<Pick<TaskRow, 'id' | 'topic' | 'status' | 'reference_mode' | 'created_at'>>(
    `
      SELECT id, topic, status, reference_mode, created_at
      FROM generation_tasks
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

export async function getTaskDetail(taskId: string): Promise<{
  task: TaskRow;
  strategy: Record<string, unknown> | null;
  references: Array<Record<string, unknown>>;
  outputs: Record<string, unknown> | null;
  reference_mode: string | null;
  feedback: Record<string, unknown> | null;
} | null> {
  const task = await queryOne<TaskRow>(
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
        reference_mode,
        created_at
      FROM generation_tasks
      WHERE id = $1
    `,
    [taskId],
  );

  if (!task) {
    return null;
  }

  const strategy = await queryOne<Record<string, unknown>>(
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

  const references = await query<Record<string, unknown>>(
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

  const outputs = await queryOne<Record<string, unknown>>(
    `
      SELECT
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
      WHERE task_id = $1
      ORDER BY version DESC, created_at DESC
      LIMIT 1
    `,
    [taskId],
  );

  const feedback = await queryOne<Record<string, unknown>>(
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

  return {
    task,
    strategy,
    references,
    outputs,
    reference_mode: task.reference_mode,
    feedback,
  };
}
