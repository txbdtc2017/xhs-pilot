import { NextResponse } from 'next/server';
import { generateImagePlan, type ImagePlanningConfig } from '@/agents/image-planning';
import { logger } from '@/lib/logger';
import {
  IMAGE_PROVIDER_IDS,
  resolveImageGenerationCapabilityStatus,
  type ImageProviderId,
} from '@/app/api/image-generation/capability';
import { imageGenerationRepository } from '@/app/api/image-generation/repository';

export const dynamic = 'force-dynamic';

function normalizeVisualDirectionOverride(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, 120) : null;
}

function resolvePlanConfig(body: Record<string, unknown>): (ImagePlanningConfig & {
  provider: ImageProviderId;
}) | null {
  const provider = typeof body.provider === 'string' && IMAGE_PROVIDER_IDS.includes(body.provider as ImageProviderId)
    ? body.provider as ImageProviderId
    : null;
  const bodyPageCap = body.bodyPageCap === undefined ? 4 : Number(body.bodyPageCap);
  const coverCandidateCount = body.coverCandidateCount === undefined ? 2 : Number(body.coverCandidateCount);
  const bodyCandidateCount = body.bodyCandidateCount === undefined ? 1 : Number(body.bodyCandidateCount);

  if (
    !provider ||
    !Number.isInteger(bodyPageCap) ||
    !Number.isInteger(coverCandidateCount) ||
    !Number.isInteger(bodyCandidateCount) ||
    bodyPageCap < 1 ||
    bodyPageCap > 8 ||
    coverCandidateCount < 1 ||
    coverCandidateCount > 4 ||
    bodyCandidateCount < 1 ||
    bodyCandidateCount > 3
  ) {
    return null;
  }

  return {
    provider,
    visualDirectionOverride: normalizeVisualDirectionOverride(body.visualDirectionOverride),
    bodyPageCap,
    coverCandidateCount,
    bodyCandidateCount,
  };
}

export interface GenerateOutputImagePlansPostDependencies {
  getImageCapabilityStatus: typeof resolveImageGenerationCapabilityStatus;
  getOutputPlanningContext: typeof imageGenerationRepository.getOutputPlanningContext;
  generateImagePlan: typeof generateImagePlan;
  replaceImagePlan: typeof imageGenerationRepository.replaceImagePlan;
}

function createDefaultGenerateOutputImagePlansPostDependencies(): GenerateOutputImagePlansPostDependencies {
  return {
    getImageCapabilityStatus: resolveImageGenerationCapabilityStatus,
    getOutputPlanningContext: imageGenerationRepository.getOutputPlanningContext,
    generateImagePlan,
    replaceImagePlan: imageGenerationRepository.replaceImagePlan,
  };
}

export function createGenerateOutputImagePlansPostHandler(
  dependencies: GenerateOutputImagePlansPostDependencies = createDefaultGenerateOutputImagePlansPostDependencies(),
) {
  return async function POST(
    request: Request,
    { params }: { params: Promise<{ outputId: string }> },
  ) {
    try {
      const body = await request.json().catch(() => ({})) as Record<string, unknown>;
      const config = resolvePlanConfig(body);
      if (!config) {
        return NextResponse.json({ error: 'Invalid image planning parameters' }, { status: 400 });
      }

      const capability = dependencies.getImageCapabilityStatus(process.env, config.provider);
      if (!capability.available) {
        return NextResponse.json(
          { error: capability.message, code: capability.code },
          { status: 409 },
        );
      }

      const { outputId } = await params;
      const context = await dependencies.getOutputPlanningContext(outputId);
      if (!context) {
        return NextResponse.json({ error: 'Output not found' }, { status: 404 });
      }

      const generated = await dependencies.generateImagePlan({
        context,
        config: {
          visualDirectionOverride: config.visualDirectionOverride,
          bodyPageCap: config.bodyPageCap,
          coverCandidateCount: config.coverCandidateCount,
          bodyCandidateCount: config.bodyCandidateCount,
        },
      });
      const detail = await dependencies.replaceImagePlan({
        outputId,
        provider: config.provider,
        providerModel: capability.model,
        visualDirectionOverride: config.visualDirectionOverride,
        bodyPageCap: config.bodyPageCap,
        coverCandidateCount: config.coverCandidateCount,
        bodyCandidateCount: config.bodyCandidateCount,
        systemDecisionSummary: generated.systemDecisionSummary,
        pages: generated.pages,
      });

      return NextResponse.json({
        plan: detail.plan,
        pages: detail.pages,
        selected_output: {
          id: String(context.output.id),
          task_id: String(context.output.task_id),
          version: Number(context.output.version),
          created_at: String(context.output.created_at),
        },
      });
    } catch (error) {
      logger.error({ error }, 'Failed to create image plan');
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  };
}

export const POST = createGenerateOutputImagePlansPostHandler();
