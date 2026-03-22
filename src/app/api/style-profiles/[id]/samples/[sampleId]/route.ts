import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { removeSampleFromStyleProfile } from '@/lib/style-profiles';

export interface StyleProfileSampleDeleteDependencies {
  removeSampleFromStyleProfile: typeof removeSampleFromStyleProfile;
}

function createDefaultStyleProfileSampleDeleteDependencies(): StyleProfileSampleDeleteDependencies {
  return {
    removeSampleFromStyleProfile,
  };
}

export function createStyleProfileSampleDeleteHandler(
  dependencies: StyleProfileSampleDeleteDependencies =
    createDefaultStyleProfileSampleDeleteDependencies(),
) {
  return async function DELETE(
    _request: Request,
    { params }: { params: Promise<{ id: string; sampleId: string }> },
  ) {
    try {
      const { id, sampleId } = await params;
      const result = await dependencies.removeSampleFromStyleProfile(id, sampleId);

      if (!result) {
        return NextResponse.json({ error: 'Style profile not found' }, { status: 404 });
      }

      return NextResponse.json(result);
    } catch (error) {
      logger.error({ error }, 'Failed to remove sample from style profile');
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  };
}

export const DELETE = createStyleProfileSampleDeleteHandler();
