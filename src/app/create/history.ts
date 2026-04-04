import type { HistoryTaskDetail, HistoryTaskSummary } from './models';

type FetchLike = typeof fetch;

export function normalizeHistoryTaskId(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function buildTaskQuery(taskId?: string | null, outputId?: string | null): string {
  const params = new URLSearchParams();

  if (taskId?.trim()) {
    params.set('taskId', taskId.trim());
  }

  if (outputId?.trim()) {
    params.set('outputId', outputId.trim());
  }

  const query = params.toString();
  return query ? `?${query}` : '';
}

export function buildHistoryTaskHref(taskId: string, outputId?: string | null): string {
  return `/history${buildTaskQuery(taskId, outputId)}`;
}

export function buildCreateImagesHref(taskId?: string | null, outputId?: string | null): string {
  return `/create/images${buildTaskQuery(taskId, outputId)}`;
}

export function buildCreatePublishHref(taskId?: string | null, outputId?: string | null): string {
  return `/create/publish${buildTaskQuery(taskId, outputId)}`;
}

export function buildCreateCopyHref(taskId?: string | null, outputId?: string | null): string {
  return `/create${buildTaskQuery(taskId, outputId)}`;
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
  outputId?: string | null,
  fetchImpl: FetchLike = fetch,
): Promise<HistoryTaskDetail> {
  const query = outputId ? `?outputId=${encodeURIComponent(outputId)}` : '';
  const response = await fetchImpl(`/api/generate/${encodeURIComponent(taskId)}${query}`);

  if (!response.ok) {
    throw new Error('Failed to load generation task detail');
  }

  return await response.json() as HistoryTaskDetail;
}

export async function deleteHistoryTask(
  taskId: string,
  fetchImpl: FetchLike = fetch,
): Promise<void> {
  const response = await fetchImpl(`/api/generate/${encodeURIComponent(taskId)}`, {
    method: 'DELETE',
  });

  if (response.status === 204) {
    return;
  }

  const payload = await response.json().catch(() => null) as { error?: string } | null;
  throw new Error(payload?.error ?? 'Failed to delete generation task');
}
