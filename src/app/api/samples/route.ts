import { NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { logger } from '@/lib/logger';
import { processIngestionText, processIngestionImages, IngestionImage } from '@/agents/ingestion';
import { listSamples, normalizeSampleListView } from '@/lib/samples';
import { InvalidManualTagsError, parseManualTagsFromFormData } from './manual-tags';

const ALLOWED_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_UPLOAD_IMAGES = 9;

function readRequiredTextField(formData: FormData, field: string): string | null {
  const value = formData.get(field);
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readOptionalTextField(formData: FormData, field: string): string | null {
  const value = formData.get(field);
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function formatMegabytes(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(6);
}

function getAllowedExtensionsForMimeType(mimeType: string): string[] {
  switch (mimeType) {
    case 'image/jpeg':
      return ['jpg', 'jpeg'];
    case 'image/png':
      return ['png'];
    case 'image/webp':
      return ['webp'];
    default:
      return [];
  }
}

function getMaxUploadSizeBytes(): number {
  const parsed = Number(process.env.MAX_UPLOAD_SIZE_MB || '10');
  const safeMegabytes = Number.isFinite(parsed) && parsed > 0 ? parsed : 10;
  return Math.round(safeMegabytes * 1024 * 1024);
}

function validateImageFiles(files: File[], maxUploadSizeBytes: number): string | null {
  if (files.length > MAX_UPLOAD_IMAGES) {
    return `You can upload at most ${MAX_UPLOAD_IMAGES} images per sample`;
  }

  for (const file of files) {
    if (!file.type || !ALLOWED_IMAGE_MIME_TYPES.has(file.type)) {
      return 'Only JPEG, PNG, and WebP images are allowed';
    }

    if (file.size <= 0) {
      return 'Uploaded images cannot be empty';
    }

    if (file.size > maxUploadSizeBytes) {
      return `Each image must be smaller than ${formatMegabytes(maxUploadSizeBytes)} MB`;
    }

    const extension = file.name.split('.').pop()?.toLowerCase();
    if (!extension || !getAllowedExtensionsForMimeType(file.type).includes(extension)) {
      return 'Image file extensions must match their MIME type';
    }
  }

  return null;
}

export interface SamplesPostDependencies {
  getMaxUploadSizeBytes: () => number;
  processIngestionText: typeof processIngestionText;
  parseManualTagsFromFormData: typeof parseManualTagsFromFormData;
  processIngestionImages: typeof processIngestionImages;
  query: typeof query;
  queryOne: typeof queryOne;
  listSamples?: typeof listSamples;
  addAnalyzeJob: (sampleId: string) => Promise<void>;
}

export interface SamplesGetDependencies {
  listSamples: typeof listSamples;
}

function createDefaultSamplesGetDependencies(): SamplesGetDependencies {
  return {
    listSamples,
  };
}

function createDefaultSamplesPostDependencies(): SamplesPostDependencies {
  return {
    getMaxUploadSizeBytes,
    processIngestionText,
    parseManualTagsFromFormData,
    processIngestionImages,
    query,
    queryOne,
    listSamples,
    addAnalyzeJob: async (sampleId) => {
      const { analyzeQueue } = await import('@/queues');
      await analyzeQueue.add('analyze', { sampleId });
    },
  };
}

export function createSamplesGetHandler(
  dependencies: SamplesGetDependencies = createDefaultSamplesGetDependencies(),
) {
  return async function GET(request: Request) {
    try {
      const { searchParams } = new URL(request.url);
      const page = Math.max(parseInt(searchParams.get('page') || '1', 10), 1);
      const limit = Math.max(parseInt(searchParams.get('limit') || '20', 10), 1);
      const isHighValueParam = searchParams.get('is_high_value');

      return NextResponse.json(
        await dependencies.listSamples({
          view: normalizeSampleListView(searchParams.get('view')),
          search: searchParams.get('search') || undefined,
          track: searchParams.get('track') || undefined,
          contentType: searchParams.get('content_type') || undefined,
          coverStyle: searchParams.get('cover_style') || undefined,
          isHighValue:
            isHighValueParam === 'true'
              ? true
              : isHighValueParam === 'false'
                ? false
                : undefined,
          dateFrom: searchParams.get('date_from') || undefined,
          dateTo: searchParams.get('date_to') || undefined,
          page,
          limit,
        }),
      );
    } catch (error) {
      logger.error({ error }, 'Failed to fetch samples');
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  };
}

export function createSamplesPostHandler(
  dependencies: SamplesPostDependencies = createDefaultSamplesPostDependencies(),
) {
  return async function POST(request: Request) {
    try {
      const formData = await request.formData();

      const title = readRequiredTextField(formData, 'title');
      const bodyText = readRequiredTextField(formData, 'body_text');
      const sourceUrl = readOptionalTextField(formData, 'source_url');
      const manualTags = dependencies.parseManualTagsFromFormData(formData);
      const files = formData.getAll('images');

      if (!title || !bodyText) {
        return NextResponse.json({ error: 'Missing title or body_text' }, { status: 400 });
      }

      if (!files.every((file): file is File => file instanceof File)) {
        return NextResponse.json({ error: 'Images must be uploaded as files' }, { status: 400 });
      }

      const uploadValidationError = validateImageFiles(
        files,
        dependencies.getMaxUploadSizeBytes(),
      );
      if (uploadValidationError) {
        return NextResponse.json({ error: uploadValidationError }, { status: 400 });
      }

      if (sourceUrl) {
        const existing = await dependencies.queryOne('SELECT id FROM samples WHERE source_url = $1', [sourceUrl]);
        if (existing) {
          return NextResponse.json({ error: 'Sample with this source_url already exists' }, { status: 409 });
        }
      }

      const cleanedBodyText = dependencies.processIngestionText(bodyText);

      const sampleResult = await dependencies.queryOne<{ id: string }>(`
      INSERT INTO samples (title, body_text, source_url, manual_tags, status)
      VALUES ($1, $2, $3, $4, 'pending')
      RETURNING id
    `, [title, cleanedBodyText, sourceUrl || null, manualTags]);

      const sampleId = sampleResult!.id;

      if (files.length > 0) {
        const ingestionImages: IngestionImage[] = await Promise.all(files.map(async (file) => {
          const arrayBuffer = await file.arrayBuffer();
          return {
            buffer: Buffer.from(arrayBuffer),
            mimeType: file.type,
            originalName: file.name,
          };
        }));

        const ingestedImages = await dependencies.processIngestionImages(ingestionImages);

        for (const img of ingestedImages) {
          await dependencies.query(`
          INSERT INTO sample_images (sample_id, image_type, image_url, storage_key, sort_order)
          VALUES ($1, $2, $3, $4, $5)
        `, [sampleId, img.imageType, img.imageUrl, img.storageKey, img.sortOrder]);
        }
      }

      await dependencies.addAnalyzeJob(sampleId);

      const newSample = await dependencies.queryOne('SELECT * FROM samples WHERE id = $1', [sampleId]);

      return NextResponse.json({ sample: newSample }, { status: 201 });
    } catch (error) {
      if (error instanceof InvalidManualTagsError) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      logger.error({ error }, 'Failed to create sample');
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  };
}

export const GET = createSamplesGetHandler();
export const POST = createSamplesPostHandler();
