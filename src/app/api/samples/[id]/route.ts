import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { storage } from '@/lib/storage';
import {
  getSampleDetail,
  permanentlyDeleteSample,
  restoreSample,
  softDeleteSample,
  updateSample,
} from '@/lib/samples';

export interface SampleDetailDependencies {
  getSampleDetail: typeof getSampleDetail;
}

export interface SamplePatchDependencies {
  updateSample: typeof updateSample;
}

export interface SampleDeleteDependencies {
  softDeleteSample: typeof softDeleteSample;
}

export interface SampleRestoreDependencies {
  restoreSample: typeof restoreSample;
}

export interface SamplePermanentDeleteDependencies {
  permanentlyDeleteSample: typeof permanentlyDeleteSample;
  deleteStorageObject: (storageKey: string) => Promise<void>;
}

function createDefaultSampleDetailDependencies(): SampleDetailDependencies {
  return {
    getSampleDetail,
  };
}

function createDefaultSamplePatchDependencies(): SamplePatchDependencies {
  return {
    updateSample,
  };
}

function createDefaultSampleDeleteDependencies(): SampleDeleteDependencies {
  return {
    softDeleteSample,
  };
}

function createDefaultSampleRestoreDependencies(): SampleRestoreDependencies {
  return {
    restoreSample,
  };
}

function createDefaultSamplePermanentDeleteDependencies(): SamplePermanentDeleteDependencies {
  return {
    permanentlyDeleteSample,
    deleteStorageObject: (storageKey) => storage.delete(storageKey),
  };
}

export function createSampleDetailGetHandler(
  dependencies: SampleDetailDependencies = createDefaultSampleDetailDependencies(),
) {
  return async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
      const { id } = await params;
      const detail = await dependencies.getSampleDetail(id);
      if (!detail) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }

      return NextResponse.json(detail);
    } catch (error) {
      logger.error({ error }, 'Failed to fetch sample details');
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  };
}

export function createSamplePatchHandler(
  dependencies: SamplePatchDependencies = createDefaultSamplePatchDependencies(),
) {
  return async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> },
  ) {
    try {
      const { id } = await params;
      const body = (await request.json()) as Record<string, unknown>;
      const patch = {
        is_high_value:
          typeof body.is_high_value === 'boolean' ? body.is_high_value : undefined,
        is_reference_allowed:
          typeof body.is_reference_allowed === 'boolean' ? body.is_reference_allowed : undefined,
        manual_tags: Array.isArray(body.manual_tags)
          ? body.manual_tags.filter((value): value is string => typeof value === 'string')
          : undefined,
        manual_notes:
          typeof body.manual_notes === 'string'
            ? body.manual_notes
            : body.manual_notes === null
              ? null
              : undefined,
      };

      if (Object.values(patch).every((value) => value === undefined)) {
        return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
      }

      const result = await dependencies.updateSample(id, patch);

      if (result === null) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }

      return NextResponse.json({ sample: result });
    } catch (error) {
      logger.error({ error }, 'Failed to update sample');
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  };
}

export function createSampleDeleteHandler(
  dependencies: SampleDeleteDependencies = createDefaultSampleDeleteDependencies(),
) {
  return async function DELETE(
    _request: Request,
    { params }: { params: Promise<{ id: string }> },
  ) {
    try {
      const { id } = await params;
      const result = await dependencies.softDeleteSample(id);

      if ('error' in result) {
        if (result.error === 'not_found') {
          return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }

        return NextResponse.json({ error: 'Sample is already in trash' }, { status: 409 });
      }

      return NextResponse.json({ success: true });
    } catch (error) {
      logger.error({ error }, 'Failed to delete sample');
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  };
}

export function createSampleRestoreHandler(
  dependencies: SampleRestoreDependencies = createDefaultSampleRestoreDependencies(),
) {
  return async function POST(
    _request: Request,
    { params }: { params: Promise<{ id: string }> },
  ) {
    try {
      const { id } = await params;
      const result = await dependencies.restoreSample(id);

      if ('error' in result) {
        if (result.error === 'not_found') {
          return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }

        return NextResponse.json({ error: 'Sample is not in trash' }, { status: 409 });
      }

      return NextResponse.json({ success: true });
    } catch (error) {
      logger.error({ error }, 'Failed to restore sample');
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  };
}

export function createSamplePermanentDeleteHandler(
  dependencies: SamplePermanentDeleteDependencies = createDefaultSamplePermanentDeleteDependencies(),
) {
  return async function DELETE(
    _request: Request,
    { params }: { params: Promise<{ id: string }> },
  ) {
    try {
      const { id } = await params;
      const result = await dependencies.permanentlyDeleteSample(id);

      if ('error' in result) {
        if (result.error === 'not_found') {
          return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }

        return NextResponse.json({ error: 'Sample must be in trash before permanent deletion' }, { status: 409 });
      }

      for (const image of result.images) {
        if (image.storage_key) {
          await dependencies.deleteStorageObject(image.storage_key);
        }
      }

      return NextResponse.json({ success: true });
    } catch (error) {
      logger.error({ error }, 'Failed to permanently delete sample');
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  };
}

export const GET = createSampleDetailGetHandler();
export const PATCH = createSamplePatchHandler();
export const DELETE = createSampleDeleteHandler();
