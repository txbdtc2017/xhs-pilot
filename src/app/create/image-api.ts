'use client'

import { createSseParser } from '@/lib/sse';
import type {
  ImageAssetPayload,
  ImageConfigValues,
  ImageJobSnapshotPayload,
  ImagePlanPayload,
  ImageProviderPayload,
} from './models';

type FetchLike = typeof fetch;

function buildJsonRequest(body: Record<string, unknown>): RequestInit {
  return {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  };
}

export async function createImagePlan(
  outputId: string,
  config: ImageConfigValues,
  fetchImpl: FetchLike = fetch,
): Promise<{
  plan: ImagePlanPayload['plan'];
  pages: ImagePlanPayload['pages'];
  selected_output: {
    id: string;
    task_id: string;
    version: number;
    created_at: string;
  };
}> {
  const response = await fetchImpl(
    `/api/generate/outputs/${encodeURIComponent(outputId)}/image-plans`,
    buildJsonRequest({
      provider: config.provider,
      visualDirectionOverride: config.visualDirectionOverride || undefined,
      bodyPageCap: config.bodyPageCap,
      coverCandidateCount: config.coverCandidateCount,
      bodyCandidateCount: config.bodyCandidateCount,
    }),
  );

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error ?? 'Failed to create image plan');
  }

  return await response.json() as {
    plan: ImagePlanPayload['plan'];
    pages: ImagePlanPayload['pages'];
    selected_output: {
      id: string;
      task_id: string;
      version: number;
      created_at: string;
    };
  };
}

export async function fetchImageProviders(
  fetchImpl: FetchLike = fetch,
): Promise<{
  providers: ImageProviderPayload[];
  default_provider: ImageConfigValues['provider'] | null;
}> {
  const response = await fetchImpl('/api/image-generation/providers');

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error ?? 'Failed to load image providers');
  }

  return await response.json() as {
    providers: ImageProviderPayload[];
    default_provider: ImageConfigValues['provider'] | null;
  };
}

export async function updateImagePlan(
  planId: string,
  patch: {
    visualDirectionOverride?: string;
    pages?: Array<{ id: string; isEnabled: boolean }>;
  },
  fetchImpl: FetchLike = fetch,
): Promise<{
  plan: ImagePlanPayload['plan'];
  pages: ImagePlanPayload['pages'];
}> {
  const response = await fetchImpl(`/api/image-plans/${encodeURIComponent(planId)}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      visualDirectionOverride: patch.visualDirectionOverride,
      pages: patch.pages,
    }),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error ?? 'Failed to update image plan');
  }

  return await response.json() as {
    plan: ImagePlanPayload['plan'];
    pages: ImagePlanPayload['pages'];
  };
}

export async function createImageJob(
  planId: string,
  request: { scope: 'full' | 'page'; planPageId?: string | null },
  fetchImpl: FetchLike = fetch,
): Promise<{
  job: {
    id: string;
    plan_id: string;
    scope: 'full' | 'page';
    plan_page_id: string | null;
    status: string;
    total_units: number;
    completed_units: number;
  };
  events_url: string;
}> {
  const response = await fetchImpl(
    `/api/image-plans/${encodeURIComponent(planId)}/jobs`,
    buildJsonRequest({
      scope: request.scope,
      planPageId: request.planPageId ?? undefined,
    }),
  );

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error ?? 'Failed to create image job');
  }

  return await response.json() as {
    job: {
      id: string;
      plan_id: string;
      scope: 'full' | 'page';
      plan_page_id: string | null;
      status: string;
      total_units: number;
      completed_units: number;
    };
    events_url: string;
  };
}

export async function fetchImageJobSnapshot(
  jobId: string,
  fetchImpl: FetchLike = fetch,
): Promise<ImageJobSnapshotPayload> {
  const response = await fetchImpl(`/api/image-jobs/${encodeURIComponent(jobId)}`);

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error ?? 'Failed to load image job snapshot');
  }

  return await response.json() as ImageJobSnapshotPayload;
}

export async function selectImageAsset(
  assetId: string,
  fetchImpl: FetchLike = fetch,
): Promise<ImageAssetPayload> {
  const response = await fetchImpl(
    `/api/image-assets/${encodeURIComponent(assetId)}/select`,
    { method: 'POST' },
  );

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error ?? 'Failed to select image asset');
  }

  const payload = await response.json() as { asset: ImageAssetPayload };
  return payload.asset;
}

export async function consumeImageJobEvents(
  jobId: string,
  onEvent: (event: { event: string; data: unknown }) => void,
  options?: {
    signal?: AbortSignal;
    fetchImpl?: FetchLike;
  },
): Promise<void> {
  const fetchImpl = options?.fetchImpl ?? fetch;
  const response = await fetchImpl(`/api/image-jobs/${encodeURIComponent(jobId)}/events`, {
    headers: {
      Accept: 'text/event-stream',
    },
    signal: options?.signal,
  });

  if (!response.ok) {
    const payload = await response.text().catch(() => '');
    throw new Error(payload || 'Failed to subscribe to image job events');
  }

  if (!response.body) {
    throw new Error('Image job events stream is unavailable');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const parser = createSseParser(onEvent);

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      parser.push(decoder.decode(value, { stream: true }));
    }

    parser.push(decoder.decode());
    parser.flush();
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      return;
    }

    throw error;
  }
}
