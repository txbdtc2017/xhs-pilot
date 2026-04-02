import { NextResponse } from 'next/server';
import { imageGenerationRepository } from '@/app/api/image-generation/repository';
import { logger } from '@/lib/logger';

export interface ImageAssetSelectPostDependencies {
  selectImageAsset: typeof imageGenerationRepository.selectImageAsset;
}

function createDefaultImageAssetSelectPostDependencies(): ImageAssetSelectPostDependencies {
  return {
    selectImageAsset: imageGenerationRepository.selectImageAsset,
  };
}

export function createImageAssetSelectPostHandler(
  dependencies: ImageAssetSelectPostDependencies = createDefaultImageAssetSelectPostDependencies(),
) {
  return async function POST(
    _request: Request,
    { params }: { params: Promise<{ assetId: string }> },
  ) {
    try {
      const { assetId } = await params;
      const asset = await dependencies.selectImageAsset(assetId);

      if (!asset) {
        return NextResponse.json({ error: 'Image asset not found' }, { status: 404 });
      }

      return NextResponse.json({ asset });
    } catch (error) {
      logger.error({ error }, 'Failed to select image asset');
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  };
}

export const POST = createImageAssetSelectPostHandler();
