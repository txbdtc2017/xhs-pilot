import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { redis } from '@/lib/redis';
import { logger } from '@/lib/logger';

export async function GET() {
  const status = {
    db: 'unknown',
    redis: 'unknown',
    timestamp: new Date().toISOString(),
  };

  try {
    // Check DB
    const dbRes = await pool.query('SELECT 1');
    if (dbRes.rowCount === 1) {
      status.db = 'ok';
    }
  } catch (err) {
    logger.error({ err }, 'Health check: DB failed');
    status.db = 'error';
  }

  try {
    // Check Redis
    const redisRes = await redis.ping();
    if (redisRes === 'PONG') {
      status.redis = 'ok';
    }
  } catch (err) {
    logger.error({ err }, 'Health check: Redis failed');
    status.redis = 'error';
  }

  const httpStatus = (status.db === 'ok' && status.redis === 'ok') ? 200 : 503;

  return NextResponse.json(status, { status: httpStatus });
}
