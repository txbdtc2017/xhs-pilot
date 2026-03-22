import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { addSampleToStyleProfile } from '@/lib/style-profiles';

export interface StyleProfileSamplesDependencies {
  addSampleToStyleProfile: typeof addSampleToStyleProfile;
}

function createDefaultStyleProfileSamplesDependencies(): StyleProfileSamplesDependencies {
  return {
    addSampleToStyleProfile,
  };
}

export function createStyleProfileSamplesPostHandler(
  dependencies: StyleProfileSamplesDependencies = createDefaultStyleProfileSamplesDependencies(),
) {
  return async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> },
  ) {
    try {
      const { id } = await params;
      const payload = (await request.json()) as Record<string, unknown>;
      const sampleId = typeof payload.sampleId === 'string' ? payload.sampleId.trim() : '';

      if (!sampleId) {
        return NextResponse.json({ error: 'sampleId is required' }, { status: 400 });
      }

      const result = await dependencies.addSampleToStyleProfile(id, sampleId);
      if (!result) {
        return NextResponse.json({ error: 'Style profile or sample not found' }, { status: 404 });
      }

      return NextResponse.json(result);
    } catch (error) {
      logger.error({ error }, 'Failed to add sample to style profile');
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  };
}

export const POST = createStyleProfileSamplesPostHandler();
