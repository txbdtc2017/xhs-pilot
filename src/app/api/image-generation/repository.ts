import { query, queryOne } from '@/lib/db';
import type { ImageProviderId } from './capability';

type QueryResult<T> = Promise<T[]>;
type QueryOneResult<T> = Promise<T | null>;

export interface ImagePlanRow {
  id: string;
  output_id: string;
  status: string;
  provider: ImageProviderId;
  provider_model: string;
  visual_direction_override: string | null;
  body_page_cap: number;
  cover_candidate_count: number;
  body_candidate_count: number;
  system_decision_summary: string;
  created_at: string;
  superseded_at: string | null;
}

export interface ImagePlanPageRow {
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
  created_at?: string;
}

export interface ImageGenerationJobRow {
  id: string;
  plan_id: string;
  scope: 'full' | 'page';
  plan_page_id: string | null;
  provider: ImageProviderId;
  status: string;
  total_units: number;
  completed_units: number;
  error_message: string | null;
  model_name: string;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
}

export interface ImageAssetRow {
  id: string;
  plan_page_id: string;
  job_id?: string;
  image_url: string | null;
  candidate_index: number;
  is_selected: boolean;
}

export interface ImageJobEventRow {
  id: number;
  job_id: string;
  event_name: string;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface ImagePlanDetail {
  plan: ImagePlanRow;
  pages: ImagePlanPageRow[];
  assets: ImageAssetRow[];
  selected_assets: ImageAssetRow[];
}

export interface ImageJobSnapshot {
  job: ImageGenerationJobRow;
  plan: {
    id: string;
    output_id: string;
    status: string;
    provider: ImageProviderId;
    provider_model: string;
  };
  pages: Array<Pick<ImagePlanPageRow, 'id' | 'sort_order' | 'page_role' | 'is_enabled' | 'candidate_count'>>;
  assets: ImageAssetRow[];
  selected_assets: ImageAssetRow[];
}

export interface ImagePlanPageInput {
  sortOrder: number;
  pageRole: string;
  isEnabled: boolean;
  contentPurpose: string;
  sourceExcerpt: string;
  visualType: string;
  styleReason: string;
  promptSummary: string;
  promptText: string;
  candidateCount: number;
}

export interface ReplaceImagePlanInput {
  outputId: string;
  provider: ImageProviderId;
  providerModel: string;
  visualDirectionOverride: string | null;
  bodyPageCap: number;
  coverCandidateCount: number;
  bodyCandidateCount: number;
  systemDecisionSummary: string;
  pages: ImagePlanPageInput[];
}

export interface CreateImageJobInput {
  planId: string;
  scope: 'full' | 'page';
  planPageId: string | null;
  provider: ImageProviderId;
  modelName: string;
}

export interface CreateImageAssetInput {
  planPageId: string;
  jobId: string;
  candidateIndex: number;
  storageKey: string;
  imageUrl: string;
  mimeType: string;
  width: number | null;
  height: number | null;
  status?: string;
  isSelected?: boolean;
  promptTextSnapshot: string;
}

export interface OutputVersionSummary {
  id: string;
  version: number;
  model_name: string | null;
  created_at: string;
}

export interface ImagePlanningContext {
  task: {
    id: string;
    topic: string;
    target_audience: string | null;
    goal: string | null;
    style_preference: string | null;
    persona_mode: string | null;
    need_cover_suggestion: boolean | null;
  };
  strategy: Record<string, unknown> | null;
  references: Array<Record<string, unknown>>;
  output: Record<string, unknown>;
}

export interface ImageGenerationRepositoryDependencies {
  query: <T>(text: string, params?: unknown[]) => QueryResult<T>;
  queryOne: <T>(text: string, params?: unknown[]) => QueryOneResult<T>;
}

function createDefaultImageGenerationRepositoryDependencies(): ImageGenerationRepositoryDependencies {
  return {
    query,
    queryOne,
  };
}

function normalizeImagePlanDetail(plan: ImagePlanRow, pages: ImagePlanPageRow[], assets: ImageAssetRow[]): ImagePlanDetail {
  return {
    plan,
    pages,
    assets,
    selected_assets: assets.filter((asset) => asset.is_selected),
  };
}

export function createImageGenerationRepository(
  dependencies: ImageGenerationRepositoryDependencies = createDefaultImageGenerationRepositoryDependencies(),
) {
  const repository = {
    async getOutputPlanningContext(outputId: string): Promise<ImagePlanningContext | null> {
      const output = await dependencies.queryOne<Record<string, unknown>>(
        `
          SELECT
            go.id,
            go.task_id,
            go.version,
            go.titles,
            go.openings,
            go.body_versions,
            go.cta_versions,
            go.cover_copies,
            go.hashtags,
            go.first_comment,
            go.image_suggestions,
            go.model_name,
            go.created_at,
            gt.topic,
            gt.target_audience,
            gt.goal,
            gt.style_preference,
            gt.persona_mode,
            gt.need_cover_suggestion
          FROM generation_outputs go
          INNER JOIN generation_tasks gt ON gt.id = go.task_id
          WHERE go.id = $1
        `,
        [outputId],
      );

      if (!output) {
        return null;
      }

      const taskId = String(output.task_id);
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
            tr.reason,
            sa.reasoning_summary,
            sa.title_pattern_explanation,
            sa.opening_explanation,
            sa.structure_explanation,
            sva.cover_explanation,
            sva.cover_style_tag,
            sva.layout_type_tag,
            sva.text_density_tag,
            sva.visual_focus_tag
          FROM task_references tr
          LEFT JOIN samples s ON s.id = tr.sample_id
          LEFT JOIN sample_analysis sa ON sa.sample_id = tr.sample_id
          LEFT JOIN sample_visual_analysis sva ON sva.sample_id = tr.sample_id
          WHERE tr.task_id = $1
          ORDER BY tr.id ASC
        `,
        [taskId],
      );

      return {
        task: {
          id: taskId,
          topic: String(output.topic),
          target_audience: (output.target_audience as string | null) ?? null,
          goal: (output.goal as string | null) ?? null,
          style_preference: (output.style_preference as string | null) ?? null,
          persona_mode: (output.persona_mode as string | null) ?? null,
          need_cover_suggestion: (output.need_cover_suggestion as boolean | null) ?? null,
        },
        strategy,
        references,
        output,
      };
    },

    async replaceImagePlan(input: ReplaceImagePlanInput): Promise<ImagePlanDetail> {
      await dependencies.query(
        `
          UPDATE image_plans
          SET
            status = 'superseded',
            superseded_at = NOW()
          WHERE output_id = $1 AND superseded_at IS NULL
        `,
        [input.outputId],
      );

      const plan = await dependencies.queryOne<ImagePlanRow>(
        `
          INSERT INTO image_plans (
            output_id,
            status,
            provider,
            provider_model,
            visual_direction_override,
            body_page_cap,
            cover_candidate_count,
            body_candidate_count,
            system_decision_summary
          )
          VALUES ($1, 'ready', $2, $3, $4, $5, $6, $7, $8)
          RETURNING
            id,
            output_id,
            status,
            provider,
            provider_model,
            visual_direction_override,
            body_page_cap,
            cover_candidate_count,
            body_candidate_count,
            system_decision_summary,
            created_at,
            superseded_at
        `,
        [
          input.outputId,
          input.provider,
          input.providerModel,
          input.visualDirectionOverride,
          input.bodyPageCap,
          input.coverCandidateCount,
          input.bodyCandidateCount,
          input.systemDecisionSummary,
        ],
      );

      if (!plan) {
        throw new Error('Failed to create image plan');
      }

      const pages: ImagePlanPageRow[] = [];
      for (const page of input.pages) {
        const insertedPage = await dependencies.queryOne<ImagePlanPageRow>(
          `
            INSERT INTO image_plan_pages (
              plan_id,
              sort_order,
              page_role,
              is_enabled,
              content_purpose,
              source_excerpt,
              visual_type,
              style_reason,
              prompt_summary,
              prompt_text,
              candidate_count
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING
              id,
              plan_id,
              sort_order,
              page_role,
              is_enabled,
              content_purpose,
              source_excerpt,
              visual_type,
              style_reason,
              prompt_summary,
              prompt_text,
              candidate_count,
              created_at
          `,
          [
            plan.id,
            page.sortOrder,
            page.pageRole,
            page.isEnabled,
            page.contentPurpose,
            page.sourceExcerpt,
            page.visualType,
            page.styleReason,
            page.promptSummary,
            page.promptText,
            page.candidateCount,
          ],
        );

        if (insertedPage) {
          pages.push(insertedPage);
        }
      }

      return normalizeImagePlanDetail(plan, pages, []);
    },

    async updateImagePlan(
      planId: string,
      input: Omit<ReplaceImagePlanInput, 'outputId' | 'provider' | 'providerModel'>,
    ): Promise<ImagePlanDetail | null> {
      const existingPlan = await dependencies.queryOne<ImagePlanRow>(
        `
          SELECT
            id,
            output_id,
            status,
            provider,
            provider_model,
            visual_direction_override,
            body_page_cap,
            cover_candidate_count,
            body_candidate_count,
            system_decision_summary,
            created_at,
            superseded_at
          FROM image_plans
          WHERE id = $1
        `,
        [planId],
      );

      if (!existingPlan) {
        return null;
      }

      const plan = await dependencies.queryOne<ImagePlanRow>(
        `
          UPDATE image_plans
          SET
            visual_direction_override = $2,
            body_page_cap = $3,
            cover_candidate_count = $4,
            body_candidate_count = $5,
            system_decision_summary = $6
          WHERE id = $1
          RETURNING
            id,
            output_id,
            status,
            provider,
            provider_model,
            visual_direction_override,
            body_page_cap,
            cover_candidate_count,
            body_candidate_count,
            system_decision_summary,
            created_at,
            superseded_at
        `,
        [
          planId,
          input.visualDirectionOverride,
          input.bodyPageCap,
          input.coverCandidateCount,
          input.bodyCandidateCount,
          input.systemDecisionSummary,
        ],
      );

      await dependencies.query('DELETE FROM image_plan_pages WHERE plan_id = $1', [planId]);

      const pages: ImagePlanPageRow[] = [];
      for (const page of input.pages) {
        const insertedPage = await dependencies.queryOne<ImagePlanPageRow>(
          `
            INSERT INTO image_plan_pages (
              plan_id,
              sort_order,
              page_role,
              is_enabled,
              content_purpose,
              source_excerpt,
              visual_type,
              style_reason,
              prompt_summary,
              prompt_text,
              candidate_count
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING
              id,
              plan_id,
              sort_order,
              page_role,
              is_enabled,
              content_purpose,
              source_excerpt,
              visual_type,
              style_reason,
              prompt_summary,
              prompt_text,
              candidate_count,
              created_at
          `,
          [
            planId,
            page.sortOrder,
            page.pageRole,
            page.isEnabled,
            page.contentPurpose,
            page.sourceExcerpt,
            page.visualType,
            page.styleReason,
            page.promptSummary,
            page.promptText,
            page.candidateCount,
          ],
        );

        if (insertedPage) {
          pages.push(insertedPage);
        }
      }

      const assets = await repository.listImageAssetsForPlan(planId);
      return plan ? normalizeImagePlanDetail(plan, pages, assets) : null;
    },

    async setImagePlanPageEnabledStates(
      planId: string,
      states: Array<{ id: string; isEnabled: boolean }>,
    ): Promise<ImagePlanDetail | null> {
      for (const state of states) {
        await dependencies.query(
          `
            UPDATE image_plan_pages
            SET is_enabled = $2
            WHERE plan_id = $1 AND id = $3
          `,
          [planId, state.isEnabled, state.id],
        );
      }

      return repository.getImagePlanDetail(planId);
    },

    async getImagePlanDetail(planId: string): Promise<ImagePlanDetail | null> {
      const plan = await dependencies.queryOne<ImagePlanRow>(
        `
          SELECT
            id,
            output_id,
            status,
            provider,
            provider_model,
            visual_direction_override,
            body_page_cap,
            cover_candidate_count,
            body_candidate_count,
            system_decision_summary,
            created_at,
            superseded_at
          FROM image_plans
          WHERE id = $1
        `,
        [planId],
      );

      if (!plan) {
        return null;
      }

      const pages = await dependencies.query<ImagePlanPageRow>(
        `
          SELECT
            id,
            plan_id,
            sort_order,
            page_role,
            is_enabled,
            content_purpose,
            source_excerpt,
            visual_type,
            style_reason,
            prompt_summary,
            prompt_text,
            candidate_count,
            created_at
          FROM image_plan_pages
          WHERE plan_id = $1
          ORDER BY sort_order ASC
        `,
        [planId],
      );

      const assets = await repository.listImageAssetsForPlan(planId);
      return normalizeImagePlanDetail(plan, pages, assets);
    },

    async getLatestImagePlanForOutput(outputId: string): Promise<ImagePlanDetail | null> {
      const latestPlan = await dependencies.queryOne<{ id: string }>(
        `
          SELECT id
          FROM image_plans
          WHERE output_id = $1 AND superseded_at IS NULL
          ORDER BY created_at DESC
          LIMIT 1
        `,
        [outputId],
      );

      if (!latestPlan) {
        return null;
      }

      return repository.getImagePlanDetail(latestPlan.id);
    },

    async hasAnyJobsForPlan(planId: string): Promise<boolean> {
      const row = await dependencies.queryOne<{ id: string }>(
        `
          SELECT id
          FROM image_generation_jobs
          WHERE plan_id = $1
          LIMIT 1
        `,
        [planId],
      );

      return Boolean(row);
    },

    async getActiveImageJob(planId: string): Promise<ImageGenerationJobRow | null> {
      return dependencies.queryOne<ImageGenerationJobRow>(
        `
          SELECT
            id,
            plan_id,
            scope,
            plan_page_id,
            provider,
            status,
            total_units,
            completed_units,
            error_message,
            model_name,
            created_at,
            started_at,
            finished_at
          FROM image_generation_jobs
          WHERE plan_id = $1 AND status IN ('queued', 'running')
          ORDER BY created_at DESC
          LIMIT 1
        `,
        [planId],
      );
    },

    async createImageJob(input: CreateImageJobInput): Promise<ImageGenerationJobRow> {
      const row = await dependencies.queryOne<ImageGenerationJobRow>(
        `
          INSERT INTO image_generation_jobs (
            plan_id,
            scope,
            plan_page_id,
            provider,
            status,
            total_units,
            completed_units,
            model_name
          )
          VALUES ($1, $2, $3, $4, 'queued', 0, 0, $5)
          RETURNING
            id,
            plan_id,
            scope,
            plan_page_id,
            provider,
            status,
            total_units,
            completed_units,
            error_message,
            model_name,
            created_at,
            started_at,
            finished_at
        `,
        [input.planId, input.scope, input.planPageId, input.provider, input.modelName],
      );

      if (!row) {
        throw new Error('Failed to create image job');
      }

      return row;
    },

    async updateImageJob(
      jobId: string,
      patch: Partial<Pick<ImageGenerationJobRow, 'status' | 'total_units' | 'completed_units' | 'error_message'>> & {
        started_at?: string | null;
        finished_at?: string | null;
      },
    ): Promise<void> {
      await dependencies.query(
        `
          UPDATE image_generation_jobs
          SET
            status = COALESCE($2, status),
            total_units = COALESCE($3, total_units),
            completed_units = COALESCE($4, completed_units),
            error_message = COALESCE($5, error_message),
            started_at = COALESCE($6::timestamptz, started_at),
            finished_at = COALESCE($7::timestamptz, finished_at)
          WHERE id = $1
        `,
        [
          jobId,
          patch.status ?? null,
          patch.total_units ?? null,
          patch.completed_units ?? null,
          patch.error_message ?? null,
          patch.started_at ?? null,
          patch.finished_at ?? null,
        ],
      );
    },

    async appendImageJobEvent(
      jobId: string,
      eventName: string,
      payload: Record<string, unknown>,
    ): Promise<ImageJobEventRow> {
      const row = await dependencies.queryOne<ImageJobEventRow>(
        `
          INSERT INTO image_job_events (job_id, event_name, payload)
          VALUES ($1, $2, $3::jsonb)
          RETURNING
            id,
            job_id,
            event_name,
            payload,
            created_at
        `,
        [jobId, eventName, JSON.stringify(payload)],
      );

      if (!row) {
        throw new Error('Failed to append image job event');
      }

      return row;
    },

    async listImageJobEvents(jobId: string, afterId?: number): Promise<ImageJobEventRow[]> {
      if (typeof afterId === 'number') {
        return dependencies.query<ImageJobEventRow>(
          `
            SELECT
              id,
              job_id,
              event_name,
              payload,
              created_at
            FROM image_job_events
            WHERE job_id = $1 AND id > $2
            ORDER BY id ASC
          `,
          [jobId, afterId],
        );
      }

      return dependencies.query<ImageJobEventRow>(
        `
          SELECT
            id,
            job_id,
            event_name,
            payload,
            created_at
          FROM image_job_events
          WHERE job_id = $1
          ORDER BY id ASC
        `,
        [jobId],
      );
    },

    async getImageJobSnapshot(jobId: string): Promise<ImageJobSnapshot | null> {
      const row = await dependencies.queryOne<
        ImageGenerationJobRow & {
          output_id: string;
          plan_status: string;
          plan_provider: ImageProviderId;
          plan_provider_model: string;
        }
      >(
        `
          SELECT
            j.id,
            j.plan_id,
            j.scope,
            j.plan_page_id,
            j.provider,
            j.status,
            j.total_units,
            j.completed_units,
            j.error_message,
            j.model_name,
            j.created_at,
            j.started_at,
            j.finished_at,
            p.output_id,
            p.status AS plan_status,
            p.provider AS plan_provider,
            p.provider_model AS plan_provider_model
          FROM image_generation_jobs j
          INNER JOIN image_plans p ON p.id = j.plan_id
          WHERE j.id = $1
        `,
        [jobId],
      );

      if (!row) {
        return null;
      }

      const pages = await dependencies.query<
        Pick<ImagePlanPageRow, 'id' | 'sort_order' | 'page_role' | 'is_enabled' | 'candidate_count'>
      >(
        `
          SELECT
            id,
            sort_order,
            page_role,
            is_enabled,
            candidate_count
          FROM image_plan_pages
          WHERE plan_id = (SELECT plan_id FROM image_generation_jobs WHERE id = $1)
          ORDER BY sort_order ASC
        `,
        [jobId],
      );

      const assets = await dependencies.query<ImageAssetRow>(
        `
          SELECT
            a.id,
            a.plan_page_id,
            a.image_url,
            a.candidate_index,
            a.is_selected
          FROM image_assets a
          INNER JOIN image_plan_pages p ON p.id = a.plan_page_id
          WHERE p.plan_id = (SELECT plan_id FROM image_generation_jobs WHERE id = $1)
          ORDER BY p.sort_order ASC, a.candidate_index ASC, a.created_at ASC
        `,
        [jobId],
      );

      return {
        job: {
          id: row.id,
          plan_id: row.plan_id,
          scope: row.scope,
          plan_page_id: row.plan_page_id,
          provider: row.provider,
          status: row.status,
          total_units: row.total_units,
          completed_units: row.completed_units,
          error_message: row.error_message,
          model_name: row.model_name,
          created_at: row.created_at,
          started_at: row.started_at,
          finished_at: row.finished_at,
        },
        plan: {
          id: row.plan_id,
          output_id: row.output_id,
          status: row.plan_status,
          provider: row.plan_provider,
          provider_model: row.plan_provider_model,
        },
        pages,
        assets,
        selected_assets: assets.filter((asset) => asset.is_selected),
      };
    },

    async getSelectedAssetsForPlan(planId: string): Promise<ImageAssetRow[]> {
      const assets = await repository.listImageAssetsForPlan(planId);
      return assets.filter((asset) => asset.is_selected);
    },

    async listImageAssetsForPlan(planId: string): Promise<ImageAssetRow[]> {
      return dependencies.query<ImageAssetRow>(
        `
          SELECT
            a.id,
            a.plan_page_id,
            a.image_url,
            a.candidate_index,
            a.is_selected
          FROM image_assets a
          INNER JOIN image_plan_pages p ON p.id = a.plan_page_id
          WHERE p.plan_id = $1
          ORDER BY p.sort_order ASC, a.candidate_index ASC, a.created_at ASC
        `,
        [planId],
      );
    },

    async selectImageAsset(assetId: string): Promise<{
      id: string;
      plan_page_id: string;
      image_url: string | null;
      is_selected: boolean;
    } | null> {
      const target = await dependencies.queryOne<{ id: string; plan_page_id: string }>(
        `
          SELECT id, plan_page_id
          FROM image_assets
          WHERE id = $1
        `,
        [assetId],
      );

      if (!target) {
        return null;
      }

      await dependencies.query(
        `
          UPDATE image_assets
          SET is_selected = FALSE
          WHERE plan_page_id = $1
        `,
        [target.plan_page_id],
      );

      return dependencies.queryOne<{
        id: string;
        plan_page_id: string;
        image_url: string | null;
        is_selected: boolean;
      }>(
        `
          UPDATE image_assets
          SET is_selected = TRUE
          WHERE id = $1
          RETURNING
            id,
            plan_page_id,
            image_url,
            is_selected
        `,
        [assetId],
      );
    },

    async createImageAsset(input: CreateImageAssetInput): Promise<ImageAssetRow> {
      const row = await dependencies.queryOne<ImageAssetRow>(
        `
          INSERT INTO image_assets (
            plan_page_id,
            job_id,
            candidate_index,
            storage_key,
            image_url,
            mime_type,
            width,
            height,
            status,
            is_selected,
            prompt_text_snapshot
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          RETURNING
            id,
            plan_page_id,
            job_id,
            image_url,
            candidate_index,
            is_selected
        `,
        [
          input.planPageId,
          input.jobId,
          input.candidateIndex,
          input.storageKey,
          input.imageUrl,
          input.mimeType,
          input.width,
          input.height,
          input.status ?? 'generated',
          input.isSelected ?? false,
          input.promptTextSnapshot,
        ],
      );

      if (!row) {
        throw new Error('Failed to create image asset');
      }

      return row;
    },

    async getPlanExecutionPages(jobId: string): Promise<Array<{
      page: ImagePlanPageRow;
      selected_assets: ImageAssetRow[];
    }>> {
      const job = await dependencies.queryOne<ImageGenerationJobRow>(
        `
          SELECT
            id,
            plan_id,
            scope,
            plan_page_id,
            provider,
            status,
            total_units,
            completed_units,
            error_message,
            model_name,
            created_at,
            started_at,
            finished_at
          FROM image_generation_jobs
          WHERE id = $1
        `,
        [jobId],
      );

      if (!job) {
        return [];
      }

      const params: unknown[] = [job.plan_id];
      let whereSql = 'WHERE plan_id = $1 AND is_enabled = TRUE';

      if (job.scope === 'page' && job.plan_page_id) {
        params.push(job.plan_page_id);
        whereSql = 'WHERE plan_id = $1 AND id = $2';
      }

      const pages = await dependencies.query<ImagePlanPageRow>(
        `
          SELECT
            id,
            plan_id,
            sort_order,
            page_role,
            is_enabled,
            content_purpose,
            source_excerpt,
            visual_type,
            style_reason,
            prompt_summary,
            prompt_text,
            candidate_count,
            created_at
          FROM image_plan_pages
          ${whereSql}
          ORDER BY sort_order ASC
        `,
        params,
      );

      const results: Array<{ page: ImagePlanPageRow; selected_assets: ImageAssetRow[] }> = [];
      for (const page of pages) {
        const selectedAssets = await dependencies.query<ImageAssetRow>(
          `
            SELECT
              id,
              plan_page_id,
              image_url,
              candidate_index,
              is_selected
            FROM image_assets
            WHERE plan_page_id = $1 AND is_selected = TRUE
            ORDER BY created_at DESC
          `,
          [page.id],
        );

        results.push({
          page,
          selected_assets: selectedAssets,
        });
      }

      return results;
    },

    async listOutputVersions(taskId: string): Promise<OutputVersionSummary[]> {
      return dependencies.query<OutputVersionSummary>(
        `
          SELECT
            id,
            version,
            model_name,
            created_at
          FROM generation_outputs
          WHERE task_id = $1
          ORDER BY version DESC, created_at DESC
        `,
        [taskId],
      );
    },
  };

  return repository;
}

export const imageGenerationRepository = createImageGenerationRepository();
