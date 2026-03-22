import type { HistoryTaskDetail, HistoryTaskSummary } from './state';

type FetchLike = typeof fetch;

export function normalizeHistoryTaskId(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function buildHistoryTaskHref(taskId: string): string {
  return `/create?taskId=${encodeURIComponent(taskId)}`;
}

export async function fetchHistoryTasks(
  fetchImpl: FetchLike = fetch,
): Promise<HistoryTaskSummary[]> {
  const response = await fetchImpl('/api/generate/history?page=1&limit=8');

  if (!response.ok) {
    throw new Error('Failed to load generation history');
  }

  const payload = await response.json() as { tasks?: HistoryTaskSummary[] };
  return payload.tasks ?? [];
}

export async function fetchHistoryTaskDetail(
  taskId: string,
  fetchImpl: FetchLike = fetch,
): Promise<HistoryTaskDetail> {
  const response = await fetchImpl(`/api/generate/${encodeURIComponent(taskId)}`);

  if (!response.ok) {
    throw new Error('Failed to load generation task detail');
  }

  return await response.json() as HistoryTaskDetail;
}
