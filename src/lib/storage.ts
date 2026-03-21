import fs from 'fs/promises';
import path from 'path';
import { logger } from './logger';

export interface StorageProvider {
  upload(file: Buffer, key: string): Promise<string>;
  getUrl(key: string): string;
  getBuffer(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}

class LocalStorage implements StorageProvider {
  private baseDir: string;
  private publicUrl: string;

  constructor() {
    this.baseDir = process.env.STORAGE_LOCAL_PATH || './uploads';
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

export const storage = new LocalStorage();
