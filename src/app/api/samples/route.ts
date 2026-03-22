import { NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { logger } from '@/lib/logger';
import { processIngestionText, processIngestionImages, IngestionImage } from '@/agents/ingestion';
import { analyzeQueue } from '@/queues';
import { listSamples } from '@/lib/samples';
import { InvalidManualTagsError, parseManualTagsFromFormData } from './manual-tags';

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

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(parseInt(searchParams.get('page') || '1', 10), 1);
    const limit = Math.max(parseInt(searchParams.get('limit') || '20', 10), 1);
    const isHighValueParam = searchParams.get('is_high_value');

    return NextResponse.json(
      await listSamples({
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
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();

    const title = readRequiredTextField(formData, 'title');
    const bodyText = readRequiredTextField(formData, 'body_text');
    const sourceUrl = readOptionalTextField(formData, 'source_url');
    const manualTags = parseManualTagsFromFormData(formData);
    const files = formData.getAll('images') as File[];

    if (!title || !bodyText) {
      return NextResponse.json({ error: 'Missing title or body_text' }, { status: 400 });
    }

    if (sourceUrl) {
      const existing = await queryOne('SELECT id FROM samples WHERE source_url = $1', [sourceUrl]);
      if (existing) {
        return NextResponse.json({ error: 'Sample with this source_url already exists' }, { status: 409 });
      }
    }

    const cleanedBodyText = processIngestionText(bodyText);

    // Save to DB (samples)
    const sampleResult = await queryOne<{ id: string }>(`
      INSERT INTO samples (title, body_text, source_url, manual_tags, status)
      VALUES ($1, $2, $3, $4, 'pending')
      RETURNING id
    `, [title, cleanedBodyText, sourceUrl || null, manualTags]);

    const sampleId = sampleResult!.id;

    // Process images
    if (files && files.length > 0) {
      const ingestionImages: IngestionImage[] = await Promise.all(files.map(async file => {
        const arrayBuffer = await file.arrayBuffer();
        return {
          buffer: Buffer.from(arrayBuffer),
          mimeType: file.type,
          originalName: file.name
        };
      }));

      const ingestedImages = await processIngestionImages(ingestionImages);

      // Save images to DB
      for (const img of ingestedImages) {
        await query(`
          INSERT INTO sample_images (sample_id, image_type, image_url, storage_key, sort_order)
          VALUES ($1, $2, $3, $4, $5)
        `, [sampleId, img.imageType, img.imageUrl, img.storageKey, img.sortOrder]);
      }
    }

    // Trigger analysis
    await analyzeQueue.add('analyze', { sampleId });

    const newSample = await queryOne('SELECT * FROM samples WHERE id = $1', [sampleId]);

    return NextResponse.json({ sample: newSample }, { status: 201 });
  } catch (error) {
    if (error instanceof InvalidManualTagsError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    logger.error({ error }, 'Failed to create sample');
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
