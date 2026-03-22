import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { createStyleProfile, listStyleProfiles } from '@/lib/style-profiles';

export interface StyleProfilesDependencies {
  listStyleProfiles: typeof listStyleProfiles;
  createStyleProfile: typeof createStyleProfile;
}

function createDefaultStyleProfilesDependencies(): StyleProfilesDependencies {
  return {
    listStyleProfiles,
    createStyleProfile,
  };
}

function parseRequiredName(payload: Record<string, unknown>): string | null {
  if (typeof payload.name !== 'string') {
    return null;
  }

  const trimmed = payload.name.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseOptionalDescription(payload: Record<string, unknown>): string | null | undefined {
  if (!('description' in payload)) {
    return undefined;
  }

  if (typeof payload.description !== 'string') {
    return null;
  }

  const trimmed = payload.description.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function createStyleProfilesGetHandler(
  dependencies: Pick<StyleProfilesDependencies, 'listStyleProfiles'> =
    createDefaultStyleProfilesDependencies(),
) {
  return async function GET() {
    try {
      return NextResponse.json(await dependencies.listStyleProfiles());
    } catch (error) {
      logger.error({ error }, 'Failed to fetch style profiles');
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  };
}

export function createStyleProfilesPostHandler(
  dependencies: Pick<StyleProfilesDependencies, 'createStyleProfile'> =
    createDefaultStyleProfilesDependencies(),
) {
  return async function POST(request: Request) {
    try {
      const payload = (await request.json()) as Record<string, unknown>;
      const name = parseRequiredName(payload);

      if (!name) {
        return NextResponse.json({ error: 'name is required' }, { status: 400 });
      }

      const result = await dependencies.createStyleProfile({
        name,
        description: parseOptionalDescription(payload),
      });

      return NextResponse.json(result, { status: 201 });
    } catch (error) {
      logger.error({ error }, 'Failed to create style profile');
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  };
}

export const GET = createStyleProfilesGetHandler();
export const POST = createStyleProfilesPostHandler();
