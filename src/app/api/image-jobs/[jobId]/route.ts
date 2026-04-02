import { NextResponse } from 'next/server';
import { imageGenerationRepository } from '@/app/api/image-generation/repository';
import { logger } from '@/lib/logger';

export interface ImageJobGetDependencies {
  getImageJobSnapshot: typeof imageGenerationRepository.getImageJobSnapshot;
}

function createDefaultImageJobGetDependencies(): ImageJobGetDependencies {
  return {
    getImageJobSnapshot: imageGenerationRepository.getImageJobSnapshot,
  };
}

export function createImageJobGetHandler(
  dependencies: ImageJobGetDependencies = createDefaultImageJobGetDependencies(),
) {
  return async function GET(
    _request: Request,
    { params }: { params: Promise<{ jobId: string }> },
  ) {
    try {
      const { jobId } = await params;
      const snapshot = await dependencies.getImageJobSnapshot(jobId);

      if (!snapshot) {
        return NextResponse.json({ error: 'Image job not found' }, { status: 404 });
      }

      return NextResponse.json(snapshot);
    } catch (error) {
      logger.error({ error }, 'Failed to fetch image job snapshot');
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  };
}

export const GET = createImageJobGetHandler();
