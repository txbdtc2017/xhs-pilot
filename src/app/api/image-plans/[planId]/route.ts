import { NextResponse } from 'next/server';
import { generateImagePlan, type ImagePlanningConfig } from '@/agents/image-planning';
import { logger } from '@/lib/logger';
import { imageGenerationRepository } from '@/app/api/image-generation/repository';

function normalizeVisualDirectionOverride(value: unknown, fallback: string | null): string | null {
  if (value === undefined) {
    return fallback;
  }

  if (typeof value !== 'string') {
    return fallback;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, 120) : null;
}

function normalizePageToggles(value: unknown): Array<{ id: string; isEnabled: boolean }> | null {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    return null;
  }

  const toggles: Array<{ id: string; isEnabled: boolean }> = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') {
      return null;
    }

    const id = typeof (entry as { id?: unknown }).id === 'string'
      ? (entry as { id: string }).id.trim()
      : '';
    const isEnabled = (entry as { isEnabled?: unknown }).isEnabled;

    if (!id || typeof isEnabled !== 'boolean') {
      return null;
    }

    toggles.push({ id, isEnabled });
  }

  return toggles;
}

export interface ImagePlanPatchDependencies {
  getImagePlanDetail: typeof imageGenerationRepository.getImagePlanDetail;
  hasAnyJobsForPlan: typeof imageGenerationRepository.hasAnyJobsForPlan;
  getOutputPlanningContext: typeof imageGenerationRepository.getOutputPlanningContext;
  generateImagePlan: typeof generateImagePlan;
  updateImagePlan: typeof imageGenerationRepository.updateImagePlan;
  setImagePlanPageEnabledStates: typeof imageGenerationRepository.setImagePlanPageEnabledStates;
}

function createDefaultImagePlanPatchDependencies(): ImagePlanPatchDependencies {
  return {
    getImagePlanDetail: imageGenerationRepository.getImagePlanDetail,
    hasAnyJobsForPlan: imageGenerationRepository.hasAnyJobsForPlan,
    getOutputPlanningContext: imageGenerationRepository.getOutputPlanningContext,
    generateImagePlan,
    updateImagePlan: imageGenerationRepository.updateImagePlan,
    setImagePlanPageEnabledStates: imageGenerationRepository.setImagePlanPageEnabledStates,
  };
}

export function createImagePlanPatchHandler(
  dependencies: ImagePlanPatchDependencies = createDefaultImagePlanPatchDependencies(),
) {
  return async function PATCH(
    request: Request,
    { params }: { params: Promise<{ planId: string }> },
  ) {
    try {
      const { planId } = await params;
      const detail = await dependencies.getImagePlanDetail(planId);
      if (!detail) {
        return NextResponse.json({ error: 'Image plan not found' }, { status: 404 });
      }

      const hasJobs = await dependencies.hasAnyJobsForPlan(planId);
      if (hasJobs) {
        return NextResponse.json({ error: 'Image plan is locked after job creation' }, { status: 409 });
      }

      const body = await request.json().catch(() => ({})) as Record<string, unknown>;
      if (body.provider !== undefined) {
        return NextResponse.json({ error: 'Image plan provider cannot be changed' }, { status: 400 });
      }

      const pageToggles = normalizePageToggles(body.pages);
      if (!pageToggles) {
        return NextResponse.json({ error: 'Invalid image plan patch payload' }, { status: 400 });
      }

      const knownPageIds = new Set(detail.pages.map((page) => page.id));
      if (pageToggles.some((page) => !knownPageIds.has(page.id))) {
        return NextResponse.json({ error: 'Unknown image plan page id' }, { status: 400 });
      }

      const nextVisualDirectionOverride = normalizeVisualDirectionOverride(
        body.visualDirectionOverride,
        detail.plan.visual_direction_override,
      );
      const hasVisualDirectionChange = nextVisualDirectionOverride !== detail.plan.visual_direction_override;

      if (!hasVisualDirectionChange) {
        const updated = await dependencies.setImagePlanPageEnabledStates(planId, pageToggles);
        return NextResponse.json({
          plan: updated?.plan ?? detail.plan,
          pages: updated?.pages ?? detail.pages,
        });
      }

      const context = await dependencies.getOutputPlanningContext(detail.plan.output_id);
      if (!context) {
        return NextResponse.json({ error: 'Output not found' }, { status: 404 });
      }

      const togglesBySortOrder = new Map<number, boolean>();
      for (const page of detail.pages) {
        togglesBySortOrder.set(page.sort_order, page.is_enabled);
      }
      for (const toggle of pageToggles) {
        const page = detail.pages.find((entry) => entry.id === toggle.id);
        if (page) {
          togglesBySortOrder.set(page.sort_order, toggle.isEnabled);
        }
      }

      const config: ImagePlanningConfig = {
        visualDirectionOverride: nextVisualDirectionOverride,
        bodyPageCap: detail.plan.body_page_cap,
        coverCandidateCount: detail.plan.cover_candidate_count,
        bodyCandidateCount: detail.plan.body_candidate_count,
      };
      const generated = await dependencies.generateImagePlan({ context, config });
      const updated = await dependencies.updateImagePlan(planId, {
        visualDirectionOverride: nextVisualDirectionOverride,
        bodyPageCap: detail.plan.body_page_cap,
        coverCandidateCount: detail.plan.cover_candidate_count,
        bodyCandidateCount: detail.plan.body_candidate_count,
        systemDecisionSummary: generated.systemDecisionSummary,
        pages: generated.pages.map((page) => ({
          ...page,
          isEnabled: togglesBySortOrder.get(page.sortOrder) ?? page.isEnabled,
        })),
      });

      return NextResponse.json({
        plan: updated?.plan ?? detail.plan,
        pages: updated?.pages ?? detail.pages,
      });
    } catch (error) {
      logger.error({ error }, 'Failed to patch image plan');
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  };
}

export const PATCH = createImagePlanPatchHandler();
