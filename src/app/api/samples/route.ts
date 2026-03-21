import { NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { logger } from '@/lib/logger';
import { processIngestionText, processIngestionImages, IngestionImage } from '@/agents/ingestion';
import { analyzeQueue } from '@/queues';
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
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const track = searchParams.get('track');
    const contentType = searchParams.get('content_type');
    const isHighValue = searchParams.get('is_high_value');
    const search = searchParams.get('search');

    const offset = (page - 1) * limit;
    
    const whereClauses: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    const fromClause = 'samples s LEFT JOIN sample_analysis sa ON s.id = sa.sample_id';

    if (track) {
      whereClauses.push(`sa.track = $${paramIndex++}`);
      params.push(track);
    }
    
    if (contentType) {
      whereClauses.push(`sa.content_type = $${paramIndex++}`);
      params.push(contentType);
    }

    if (isHighValue === 'true') {
      whereClauses.push(`s.is_high_value = true`);
    } else if (isHighValue === 'false') {
      whereClauses.push(`s.is_high_value = false`);
    }

    if (search) {
      whereClauses.push(`(s.title ILIKE $${paramIndex} OR s.body_text ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    const whereStr = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const totalQuery = `SELECT COUNT(*)::int as total FROM ${fromClause} ${whereStr}`;
    const totalResult = await queryOne<{ total: number }>(totalQuery, params);
    const total = totalResult?.total || 0;

    const samplesQuery = `
      SELECT s.*, 
             sa.track, sa.content_type, sa.title_pattern_tags, 
             sa.emotion_level, sa.reasoning_summary,
             (SELECT image_url FROM sample_images si WHERE si.sample_id = s.id AND si.image_type = 'cover' LIMIT 1) as cover_url
      FROM ${fromClause} 
      ${whereStr} 
      ORDER BY s.created_at DESC 
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;
    const samples = await query(samplesQuery, [...params, limit, offset]);

    return NextResponse.json({ samples, total });
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
