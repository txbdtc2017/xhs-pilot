import { NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { logger } from '@/lib/logger';
import { storage } from '@/lib/storage';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    
    const sample = await queryOne('SELECT * FROM samples WHERE id = $1', [id]);
    if (!sample) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const images = await query('SELECT * FROM sample_images WHERE sample_id = $1 ORDER BY sort_order', [id]);
    const analysis = await queryOne('SELECT * FROM sample_analysis WHERE sample_id = $1', [id]);
    const visualAnalysis = await queryOne('SELECT * FROM sample_visual_analysis WHERE sample_id = $1', [id]);

    return NextResponse.json({ sample, analysis, visualAnalysis, images });
  } catch (error) {
    logger.error({ error }, 'Failed to fetch sample details');
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();

    const { is_high_value, is_reference_allowed, manual_tags, manual_notes } = body;

    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (is_high_value !== undefined) {
      fields.push(`is_high_value = $${idx++}`);
      values.push(is_high_value);
    }
    if (is_reference_allowed !== undefined) {
      fields.push(`is_reference_allowed = $${idx++}`);
      values.push(is_reference_allowed);
    }
    if (manual_tags !== undefined) {
      fields.push(`manual_tags = $${idx++}`);
      values.push(manual_tags);
    }
    if (manual_notes !== undefined) {
      fields.push(`manual_notes = $${idx++}`);
      values.push(manual_notes);
    }

    if (fields.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const result = await queryOne(`
      UPDATE samples
      SET ${fields.join(', ')}
      WHERE id = $${idx}
      RETURNING *
    `, values);

    if (!result) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({ sample: result });
  } catch (error) {
    logger.error({ error }, 'Failed to update sample');
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    
    // Fetch images to delete from storage
    const images = await query<{ storage_key: string }>('SELECT storage_key FROM sample_images WHERE sample_id = $1 AND storage_key IS NOT NULL', [id]);
    
    await query('DELETE FROM samples WHERE id = $1', [id]);

    for (const img of images) {
      if (img.storage_key) {
        await storage.delete(img.storage_key);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error({ error }, 'Failed to delete sample');
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
