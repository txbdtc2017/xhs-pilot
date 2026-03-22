import fs from 'fs/promises';
import path from 'path';
import { logger } from './logger';

type StorageEnv = Record<string, string | undefined>;

export interface StorageProvider {
  upload(file: Buffer, key: string): Promise<string>;
  getUrl(key: string): string;
  getBuffer(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}

class LocalStorage implements StorageProvider {
  private baseDir: string;
  private publicUrl: string;

  constructor(baseDir: string) {
    this.baseDir = baseDir;
    this.publicUrl = '/uploads'; // This needs to be served by Next.js
  }

  async upload(file: Buffer, key: string): Promise<string> {
    const fullPath = path.join(this.baseDir, key);
    const dir = path.dirname(fullPath);
    
    try {
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(fullPath, file);
      logger.info({ key, fullPath }, 'File uploaded locally');
      return this.getUrl(key);
    } catch (err) {
      logger.error({ err, key }, 'Failed to upload file locally');
      throw err;
    }
  }

  getUrl(key: string): string {
    return `${this.publicUrl}/${key}`;
  }

  async getBuffer(key: string): Promise<Buffer> {
    const fullPath = path.join(this.baseDir, key);
    try {
      return await fs.readFile(fullPath);
    } catch (err) {
      logger.error({ err, key }, 'Failed to read file locally');
      throw err;
    }
  }

  async delete(key: string): Promise<void> {
    const fullPath = path.join(this.baseDir, key);
    try {
      await fs.unlink(fullPath);
      logger.info({ key, fullPath }, 'File deleted locally');
    } catch (err) {
      logger.error({ err, key }, 'Failed to delete file locally');
    }
  }
}

export function resolveLocalStorageBaseDir(env: StorageEnv = process.env): string {
  const configuredPath = env.STORAGE_LOCAL_PATH?.trim() || 'uploads';

  if (path.isAbsolute(configuredPath)) {
    return configuredPath;
  }

  return path.resolve(/* turbopackIgnore: true */ process.cwd(), configuredPath);
}

export function resolveUploadFilePath(
  pathSegments: string[],
  env: StorageEnv = process.env,
): string {
  if (pathSegments.length === 0) {
    throw new Error('upload path is empty');
  }

  const baseDir = resolveLocalStorageBaseDir(env);
  const sanitizedSegments = pathSegments.map((segment) => {
    const trimmed = segment.trim();
    if (!trimmed || trimmed === '.' || trimmed === '..' || trimmed.includes('\0')) {
      throw new Error('path traversal detected');
    }

    return trimmed;
  });

  const resolvedPath = path.resolve(baseDir, ...sanitizedSegments);
  const relativePath = path.relative(baseDir, resolvedPath);

  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new Error('path traversal detected');
  }

  return resolvedPath;
}

export function createStorageFromEnv(env: StorageEnv = process.env): StorageProvider {
  const provider = env.STORAGE_PROVIDER?.trim() || 'local';

  if (provider !== 'local') {
    throw new Error(`Unsupported STORAGE_PROVIDER "${provider}". Phase 6 only supports local storage.`);
  }

  return new LocalStorage(resolveLocalStorageBaseDir(env));
}

export const storage = createStorageFromEnv();
