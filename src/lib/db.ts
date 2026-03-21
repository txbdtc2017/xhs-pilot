import { Pool } from 'pg';
import { resolveDatabaseUrl } from './env';
import { logger } from './logger';

export const pool = new Pool({
  connectionString: resolveDatabaseUrl(process.env),
});

pool.on('error', (err) => {
  logger.error({ err }, 'Unexpected error on idle client');
});

export async function query<T>(text: string, params?: unknown[]): Promise<T[]> {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    logger.debug({ text, duration, rows: res.rowCount }, 'Executed query');
    return res.rows;
  } catch (err) {
    logger.error({ err, text, params }, 'Query failed');
    throw err;
  }
}

export async function queryOne<T>(text: string, params?: unknown[]): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows.length > 0 ? rows[0] : null;
}
