import { NextResponse } from 'next/server';
import { resolveImageGenerationCapabilityStatus } from '@/app/api/image-generation/capability';
import { imageGenerationRepository } from '@/app/api/image-generation/repository';
import { enqueueImageGenerateJob } from '@/queues';
import { logger } from '@/lib/logger';

export interface ImagePlanJobsPostDependencies {
  getImageCapabilityStatus: typeof resolveImageGenerationCapabilityStatus;
  getImagePlanDetail: typeof imageGenerationRepository.getImagePlanDetail;
  getActiveImageJob: typeof imageGenerationRepository.getActiveImageJob;
  createImageJob: typeof imageGenerationRepository.createImageJob;
  appendImageJobEvent: typeof imageGenerationRepository.appendImageJobEvent;
  enqueueImageJob: (jobId: string) => Promise<void>;
}

function createDefaultImagePlanJobsPostDependencies(): ImagePlanJobsPostDependencies {
  return {
    getImageCapabilityStatus: resolveImageGenerationCapabilityStatus,
    getImagePlanDetail: imageGenerationRepository.getImagePlanDetail,
    getActiveImageJob: imageGenerationRepository.getActiveImageJob,
    createImageJob: imageGenerationRepository.createImageJob,
    appendImageJobEvent: imageGenerationRepository.appendImageJobEvent,
    enqueueImageJob: async (jobId) => {
      await enqueueImageGenerateJob(jobId);
    },
  };
}

function parseJobRequest(body: Record<string, unknown>): { scope: 'full' | 'page'; planPageId: string | null } | null {
  if (body.scope === 'full') {
    return { scope: 'full', planPageId: null };
  }

  if (body.scope === 'page' && typeof body.planPageId === 'string' && body.planPageId.trim()) {
    return { scope: 'page', planPageId: body.planPageId.trim() };
  }

  return null;
}

export function createImagePlanJobsPostHandler(
  dependencies: ImagePlanJobsPostDependencies = createDefaultImagePlanJobsPostDependencies(),
) {
  return async function POST(
    request: Request,
    { params }: { params: Promise<{ planId: string }> },
  ) {
    try {
      const { planId } = await params;
      const detail = await dependencies.getImagePlanDetail(planId);
      if (!detail) {
        return NextResponse.json({ error: 'Image plan not found' }, { status: 404 });
      }

      const capability = dependencies.getImageCapabilityStatus(process.env, detail.plan.provider);
      if (!capability.available) {
        return NextResponse.json(
          { error: capability.message, code: capability.code },
          { status: 409 },
        );
      }

      const activeJob = await dependencies.getActiveImageJob(planId);
      if (activeJob) {
        return NextResponse.json({ error: 'An image job is already active for this plan' }, { status: 409 });
      }

      const parsed = parseJobRequest(await request.json().catch(() => ({})) as Record<string, unknown>);
      if (!parsed) {
        return NextResponse.json({ error: 'Invalid image job payload' }, { status: 400 });
      }

      if (
        parsed.scope === 'page' &&
        !detail.pages.some((page) => page.id === parsed.planPageId)
      ) {
        return NextResponse.json({ error: 'Unknown image plan page id' }, { status: 400 });
      }

      const job = await dependencies.createImageJob({
        planId,
        scope: parsed.scope,
        planPageId: parsed.planPageId,
        provider: detail.plan.provider,
        modelName: detail.plan.provider_model,
      });

      await dependencies.appendImageJobEvent(job.id, 'job_queued', {
        job_id: job.id,
        scope: job.scope,
      });
      await dependencies.enqueueImageJob(job.id);

      return NextResponse.json({
        job: {
          id: job.id,
          plan_id: job.plan_id,
          scope: job.scope,
          plan_page_id: job.plan_page_id,
          status: job.status,
          total_units: job.total_units,
          completed_units: job.completed_units,
        },
        events_url: `/api/image-jobs/${job.id}/events`,
      });
    } catch (error) {
      logger.error({ error }, 'Failed to create image job');
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  };
}

export const POST = createImagePlanJobsPostHandler();
