import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { updateStyleProfile } from '@/lib/style-profiles';

export interface StyleProfileByIdDependencies {
  updateStyleProfile: typeof updateStyleProfile;
}

function createDefaultStyleProfileByIdDependencies(): StyleProfileByIdDependencies {
  return {
    updateStyleProfile,
  };
}

export function createStyleProfilePatchHandler(
  dependencies: StyleProfileByIdDependencies = createDefaultStyleProfileByIdDependencies(),
) {
  return async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> },
  ) {
    try {
      const { id } = await params;
      const payload = (await request.json()) as Record<string, unknown>;
      const name =
        typeof payload.name === 'string' && payload.name.trim().length > 0
          ? payload.name.trim()
          : undefined;
      const description =
        typeof payload.description === 'string'
          ? payload.description.trim() || null
          : undefined;

      const result = await dependencies.updateStyleProfile(id, { name, description });
      if (!result) {
        return NextResponse.json({ error: 'Style profile not found' }, { status: 404 });
      }

      return NextResponse.json(result);
    } catch (error) {
      logger.error({ error }, 'Failed to update style profile');
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  };
}

export const PATCH = createStyleProfilePatchHandler();
