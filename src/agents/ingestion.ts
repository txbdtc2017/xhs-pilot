import { storage } from '@/lib/storage';

export interface IngestionImage {
  buffer: Buffer;
  mimeType: string;
  originalName: string;
}

export interface IngestedImage {
  storageKey: string;
  imageUrl: string;
  imageType: 'cover' | 'content';
  sortOrder: number;
}

export function processIngestionText(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export async function processIngestionImages(images: IngestionImage[]): Promise<IngestedImage[]> {
  const results: IngestedImage[] = [];
  
  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    const ext = img.originalName.split('.').pop()?.toLowerCase() || 'jpg';
    
    // 生成带时间戳和随机后缀的文件名
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const key = `samples/${Date.now()}-${randomSuffix}.${ext}`;
    
    const imageUrl = await storage.upload(img.buffer, key);
    
    results.push({
      storageKey: key,
      imageUrl: imageUrl,
      imageType: i === 0 ? 'cover' : 'content', // 第一张默认为封面
      sortOrder: i
    });
  }
  
  return results;
}
