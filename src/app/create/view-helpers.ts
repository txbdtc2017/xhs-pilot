import type { ImageProvider } from './state';

export function readHistoryString(record: Record<string, unknown> | null | undefined, key: string): string {
  if (!record) {
    return '';
  }

  const value = record[key];
  return typeof value === 'string' ? value : '';
}

export function readHistoryBoolean(record: Record<string, unknown> | null | undefined, key: string): boolean {
  return Boolean(record?.[key]);
}

export function formatHistoryDate(value: string | null | undefined): string {
  if (!value) {
    return '未知时间';
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '未知时间' : date.toLocaleString('zh-CN');
}

export function formatImageProvider(provider: ImageProvider): string {
  switch (provider) {
    case 'google_vertex':
      return 'Google Banana';
    case 'openai':
      return 'OpenAI-Compatible';
  }
}
