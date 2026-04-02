import { NextResponse } from 'next/server';
import { listImageGenerationProviders } from '../capability';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export interface ImageGenerationProvidersGetDependencies {
  listProviders: typeof listImageGenerationProviders;
}

function createDefaultImageGenerationProvidersGetDependencies(): ImageGenerationProvidersGetDependencies {
  return {
    listProviders: listImageGenerationProviders,
  };
}

export function createImageGenerationProvidersGetHandler(
  dependencies: ImageGenerationProvidersGetDependencies = createDefaultImageGenerationProvidersGetDependencies(),
) {
  return async function GET() {
    try {
      const result = dependencies.listProviders(process.env);
      return NextResponse.json({
        providers: result.providers,
        default_provider: result.defaultProvider,
      });
    } catch (error) {
      logger.error({ error }, 'Failed to list image generation providers');
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  };
}

export const GET = createImageGenerationProvidersGetHandler();
