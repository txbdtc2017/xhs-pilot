import { formatSseEvent } from '@/lib/sse';
import { imageGenerationRepository } from '@/app/api/image-generation/repository';

export const dynamic = 'force-dynamic';

const TERMINAL_STATUSES = new Set(['completed', 'failed', 'partial_failed']);

export interface ImageJobEventsGetDependencies {
  getImageJobSnapshot: typeof imageGenerationRepository.getImageJobSnapshot;
  listImageJobEvents: typeof imageGenerationRepository.listImageJobEvents;
  pollIntervalMs?: number;
}

function createDefaultImageJobEventsGetDependencies(): ImageJobEventsGetDependencies {
  return {
    getImageJobSnapshot: imageGenerationRepository.getImageJobSnapshot,
    listImageJobEvents: imageGenerationRepository.listImageJobEvents,
    pollIntervalMs: 1000,
  };
}

export function createImageJobEventsGetHandler(
  dependencies: ImageJobEventsGetDependencies = createDefaultImageJobEventsGetDependencies(),
) {
  return async function GET(
    _request: Request,
    { params }: { params: Promise<{ jobId: string }> },
  ) {
    const { jobId } = await params;
    const snapshot = await dependencies.getImageJobSnapshot(jobId);

    if (!snapshot) {
      return new Response(JSON.stringify({ error: 'Image job not found' }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    let isClosed = false;
    const encoder = new TextEncoder();
    const pollIntervalMs = dependencies.pollIntervalMs ?? 1000;

    const stream = new ReadableStream({
      async start(controller) {
        const sendRows = async (afterId?: number): Promise<number | undefined> => {
          const rows = await dependencies.listImageJobEvents(jobId, afterId);
          let latestId = afterId;

          for (const row of rows) {
            latestId = row.id;
            controller.enqueue(encoder.encode(formatSseEvent(row.event_name, row.payload)));
          }

          return latestId;
        };

        let cursor = await sendRows();

        const loop = async () => {
          if (isClosed) {
            return;
          }

          const latestSnapshot = await dependencies.getImageJobSnapshot(jobId);
          cursor = await sendRows(cursor);

          if (!latestSnapshot || TERMINAL_STATUSES.has(latestSnapshot.job.status)) {
            isClosed = true;
            controller.close();
            return;
          }

          setTimeout(loop, pollIntervalMs);
        };

        if (TERMINAL_STATUSES.has(snapshot.job.status)) {
          isClosed = true;
          controller.close();
          return;
        }

        setTimeout(loop, pollIntervalMs);
      },
      cancel() {
        isClosed = true;
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    });
  };
}

export const GET = createImageJobEventsGetHandler();
