import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { storage } from '@/lib/storage';
import { deleteSample, getSampleDetail, updateSample } from '@/lib/samples';

export interface SampleDetailDependencies {
  getSampleDetail: typeof getSampleDetail;
}

export interface SamplePatchDependencies {
  updateSample: typeof updateSample;
}

export interface SampleDeleteDependencies {
  deleteSample: typeof deleteSample;
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
    deleteSample,
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
      const images = await dependencies.deleteSample(id);

      for (const image of images) {
        if (image.storage_key) {
          await dependencies.deleteStorageObject(image.storage_key);
        }
      }

      return NextResponse.json({ success: true });
    } catch (error) {
      logger.error({ error }, 'Failed to delete sample');
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  };
}

export const GET = createSampleDetailGetHandler();
export const PATCH = createSamplePatchHandler();
export const DELETE = createSampleDeleteHandler();
