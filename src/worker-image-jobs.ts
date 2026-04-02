import path from 'node:path';
import { generatePlannedImages, type GeneratedImageArtifact } from '@/agents/image-generation';
import type {
  CreateImageAssetInput,
  ImageAssetRow,
  ImagePlanPageRow,
} from '@/app/api/image-generation/repository';
import { imageGenerationRepository } from '@/app/api/image-generation/repository';

export interface ImageGenerateJobLike {
  id?: string | number | undefined;
  data: {
    jobId: string;
  };
}

type LogMethod = (...args: unknown[]) => void;

interface ImageExecutionPage {
  page: ImagePlanPageRow;
  selected_assets: ImageAssetRow[];
}

export interface ImageGenerateJobDependencies {
  getImageJobSnapshot: typeof imageGenerationRepository.getImageJobSnapshot;
  getPlanExecutionPages: typeof imageGenerationRepository.getPlanExecutionPages;
  updateImageJob: typeof imageGenerationRepository.updateImageJob;
  appendImageJobEvent: typeof imageGenerationRepository.appendImageJobEvent;
  createImageAsset: typeof imageGenerationRepository.createImageAsset;
  selectImageAsset: typeof imageGenerationRepository.selectImageAsset;
  generateImages: typeof generatePlannedImages;
  storage: {
    upload: (file: Buffer, key: string) => Promise<string>;
  };
  logger: {
    info: LogMethod;
    warn: LogMethod;
    error: LogMethod;
  };
  now?: () => Date;
}

function nowIso(now: (() => Date) | undefined): string {
  return (now?.() ?? new Date()).toISOString();
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Image generation failed';
}

function resolveFileExtension(mimeType: string): string {
  if (mimeType === 'image/jpeg') {
    return 'jpg';
  }

  if (mimeType === 'image/webp') {
    return 'webp';
  }

  return 'png';
}

function createStorageKey(
  {
    planId,
    jobId,
    pageId,
    candidateIndex,
  }: {
    planId: string;
    jobId: string;
    pageId: string;
    candidateIndex: number;
  },
  artifact: GeneratedImageArtifact,
): string {
  return path.posix.join(
    'image-jobs',
    planId,
    jobId,
    pageId,
    `candidate-${candidateIndex + 1}.${resolveFileExtension(artifact.mimeType)}`,
  );
}

async function failImageJob(
  jobId: string,
  completedUnits: number,
  error: unknown,
  dependencies: ImageGenerateJobDependencies,
): Promise<never> {
  const message = toErrorMessage(error);
  const status = completedUnits > 0 ? 'partial_failed' : 'failed';
  const finishedAt = nowIso(dependencies.now);

  await dependencies.updateImageJob(jobId, {
    status,
    completed_units: completedUnits,
    error_message: message,
    finished_at: finishedAt,
  });
  await dependencies.appendImageJobEvent(jobId, 'job_failed', {
    job_id: jobId,
    status,
    completed_units: completedUnits,
    message,
  });

  throw error instanceof Error ? error : new Error(message);
}

async function createGeneratedAssetsForPage(
  {
    jobId,
    planId,
    provider,
    modelName,
    executionPage,
    dependencies,
  }: {
    jobId: string;
    planId: string;
    provider: NonNullable<Awaited<ReturnType<ImageGenerateJobDependencies['getImageJobSnapshot']>>>['job']['provider'];
    modelName: string;
    executionPage: ImageExecutionPage;
    dependencies: ImageGenerateJobDependencies;
  },
): Promise<number> {
  const {
    page,
    selected_assets: selectedAssets,
  } = executionPage;
  const shouldAutoSelectFirstAsset = selectedAssets.length === 0;
  const generatedArtifacts = await dependencies.generateImages({
    provider,
    promptText: page.prompt_text,
    candidateCount: page.candidate_count,
    modelName,
  });

  let completedCount = 0;
  for (const [candidateIndex, artifact] of generatedArtifacts.entries()) {
    const storageKey = createStorageKey(
      {
        planId,
        jobId,
        pageId: page.id,
        candidateIndex,
      },
      artifact,
    );
    const imageUrl = await dependencies.storage.upload(artifact.data, storageKey);
    const createdAsset = await dependencies.createImageAsset({
      planPageId: page.id,
      jobId,
      candidateIndex,
      storageKey,
      imageUrl,
      mimeType: artifact.mimeType,
      width: artifact.width,
      height: artifact.height,
      isSelected: false,
      promptTextSnapshot: page.prompt_text,
    } satisfies CreateImageAssetInput);

    let isSelected = createdAsset.is_selected;
    if (shouldAutoSelectFirstAsset && candidateIndex === 0) {
      await dependencies.selectImageAsset(createdAsset.id);
      isSelected = true;
    }

    completedCount += 1;
    await dependencies.appendImageJobEvent(jobId, 'asset_generated', {
      job_id: jobId,
      page_id: page.id,
      asset: {
        id: createdAsset.id,
        plan_page_id: createdAsset.plan_page_id,
        image_url: createdAsset.image_url,
        candidate_index: createdAsset.candidate_index,
        is_selected: isSelected,
      },
    });
  }

  return completedCount;
}

export async function processImageGenerateJob(
  job: ImageGenerateJobLike,
  dependencies: ImageGenerateJobDependencies,
): Promise<void> {
  const { jobId } = job.data;
  const snapshot = await dependencies.getImageJobSnapshot(jobId);

  if (!snapshot) {
    throw new Error(`Image job ${jobId} not found`);
  }

  if (['completed', 'failed', 'partial_failed'].includes(snapshot.job.status)) {
    dependencies.logger.info({ jobId, status: snapshot.job.status }, 'Skipping terminal image job');
    return;
  }

  const executionPages = await dependencies.getPlanExecutionPages(jobId);
  const totalUnits = executionPages.reduce((sum, entry) => sum + entry.page.candidate_count, 0);

  if (executionPages.length === 0 || totalUnits === 0) {
    await failImageJob(jobId, 0, new Error('No image plan pages available for generation'), dependencies);
  }

  const startedAt = nowIso(dependencies.now);
  await dependencies.updateImageJob(jobId, {
    status: 'running',
    total_units: totalUnits,
    completed_units: 0,
    started_at: startedAt,
  });
  await dependencies.appendImageJobEvent(jobId, 'job_started', {
    job_id: jobId,
    total_units: totalUnits,
    page_count: executionPages.length,
  });

  let completedUnits = 0;

  try {
    for (const executionPage of executionPages) {
      const { page } = executionPage;
      await dependencies.appendImageJobEvent(jobId, 'page_started', {
        job_id: jobId,
        page_id: page.id,
        sort_order: page.sort_order,
        page_role: page.page_role,
        candidate_count: page.candidate_count,
      });

      const generatedCount = await createGeneratedAssetsForPage({
        jobId,
        planId: snapshot.plan.id,
        provider: snapshot.job.provider,
        modelName: snapshot.job.model_name,
        executionPage,
        dependencies,
      });
      completedUnits += generatedCount;

      await dependencies.updateImageJob(jobId, {
        completed_units: completedUnits,
      });
      await dependencies.appendImageJobEvent(jobId, 'page_completed', {
        job_id: jobId,
        page_id: page.id,
        generated_count: generatedCount,
        completed_units: completedUnits,
      });
    }
  } catch (error) {
    await failImageJob(jobId, completedUnits, error, dependencies);
  }

  const finishedAt = nowIso(dependencies.now);
  await dependencies.updateImageJob(jobId, {
    status: 'completed',
    completed_units: completedUnits,
    finished_at: finishedAt,
  });
  await dependencies.appendImageJobEvent(jobId, 'job_completed', {
    job_id: jobId,
    status: 'completed',
    total_units: totalUnits,
    completed_units: completedUnits,
  });
}
