import { NextRequest } from 'next/server';
import { queryOne } from '@/lib/db';
import { buildSampleStatusEvent, type SampleStatus } from './status-events';

export const dynamic = 'force-dynamic';

interface SampleStatusRow {
  status: SampleStatus;
  has_analysis: boolean;
  has_embedding: boolean;
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let isClosed = false;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (data: unknown) => {
        if (!isClosed) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        }
      };

      const checkStatus = async () => {
        if (isClosed) return;

        try {
          const sample = await queryOne<SampleStatusRow>(
            `
              SELECT
                s.status,
                EXISTS(SELECT 1 FROM sample_analysis sa WHERE sa.sample_id = s.id) AS has_analysis,
                EXISTS(SELECT 1 FROM sample_embeddings se WHERE se.sample_id = s.id) AS has_embedding
              FROM samples s
              WHERE s.id = $1
            `,
            [id],
          );

          if (!sample) {
            sendEvent({ error: 'Sample not found' });
            controller.close();
            return;
          }

          sendEvent(
            buildSampleStatusEvent({
              status: sample.status,
              hasAnalysis: sample.has_analysis,
              hasEmbedding: sample.has_embedding,
            }),
          );

          if (sample.status === 'completed' || sample.status === 'failed') {
            isClosed = true;
            controller.close();
          } else {
            setTimeout(checkStatus, 2000);
          }
        } catch {
          isClosed = true;
          controller.close();
        }
      };

      await checkStatus();
    },
    cancel() {
      isClosed = true;
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    },
  });
}
