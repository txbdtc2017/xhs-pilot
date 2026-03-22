import fs from 'fs/promises';
import path from 'path';
import { logger } from '@/lib/logger';
import { resolveUploadFilePath } from '@/lib/storage';

function getContentType(filePath: string): string {
  switch (path.extname(filePath).toLowerCase()) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.webp':
      return 'image/webp';
    default:
      return 'application/octet-stream';
  }
}

function getCacheControl(filePath: string): string {
  return /^\d{10,}-/.test(path.basename(filePath))
    ? 'public, max-age=31536000, immutable'
    : 'public, max-age=3600';
}

export interface UploadsGetDependencies {
  resolveUploadPath: (segments: string[]) => string;
  readFile: (resolvedPath: string) => Promise<Buffer>;
}

function createDefaultUploadsGetDependencies(): UploadsGetDependencies {
  return {
    resolveUploadPath: (segments) => resolveUploadFilePath(segments),
    readFile: (resolvedPath) => fs.readFile(resolvedPath),
  };
}

export function createUploadsGetHandler(
  dependencies: UploadsGetDependencies = createDefaultUploadsGetDependencies(),
) {
  return async function GET(
    _request: Request,
    { params }: { params: Promise<{ path?: string[] }> },
  ) {
    try {
      const resolvedParams = await params;
      const pathSegments = resolvedParams.path ?? [];
      const resolvedPath = dependencies.resolveUploadPath(pathSegments);
      const file = await dependencies.readFile(resolvedPath);
      const body = new ArrayBuffer(file.byteLength);
      new Uint8Array(body).set(file);

      return new Response(body, {
        headers: {
          'Content-Type': getContentType(resolvedPath),
          'Cache-Control': getCacheControl(resolvedPath),
        },
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'path traversal detected') {
        return Response.json({ error: 'Invalid upload path' }, { status: 400 });
      }

      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        return Response.json({ error: 'File not found' }, { status: 404 });
      }

      logger.error({ error }, 'Failed to read local upload');
      return Response.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  };
}

export const GET = createUploadsGetHandler();
