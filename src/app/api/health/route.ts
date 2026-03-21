import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { redis } from '@/lib/redis';
import { logger } from '@/lib/logger';

async function withTimeout<T>(operation: Promise<T>, label: string, timeoutMs = 2000): Promise<T> {
  return Promise.race([
    operation,
    new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`${label} timed out`));
      }, timeoutMs);
    }),
  ]);
}

export async function GET() {
  let dbStatus: 'ok' | 'error' = 'ok';
  let redisStatus: 'ok' | 'error' = 'ok';

  try {
    const dbResult = await withTimeout(pool.query('SELECT 1'), 'Database health check');

    if (dbResult.rowCount !== 1) {
      dbStatus = 'error';
    }
  } catch (error) {
    logger.error({ error }, 'Health check: DB failed');
    dbStatus = 'error';
  }

  try {
    const redisResult = await withTimeout(redis.ping(), 'Redis health check');

    if (redisResult !== 'PONG') {
      redisStatus = 'error';
    }
  } catch (error) {
    logger.error({ error }, 'Health check: Redis failed');
    redisStatus = 'error';
  }

  const status = {
    db: dbStatus,
    redis: redisStatus,
  };

  return NextResponse.json(status, {
    status: dbStatus === 'ok' && redisStatus === 'ok' ? 200 : 503,
  });
}
