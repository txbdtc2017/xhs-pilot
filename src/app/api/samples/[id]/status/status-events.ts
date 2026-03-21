export type SampleStatus = 'pending' | 'analyzing' | 'embedding' | 'completed' | 'failed';

export interface SampleStatusEventInput {
  status: SampleStatus;
  hasAnalysis?: boolean;
  hasEmbedding?: boolean;
}

export interface SampleStatusEvent {
  step: 'queued' | 'analysis' | 'embedding' | 'completed';
  status: SampleStatus;
  progress: 0 | 50 | 80 | 100;
}

export function buildSampleStatusEvent({
  status,
  hasAnalysis = false,
  hasEmbedding = false,
}: SampleStatusEventInput): SampleStatusEvent {
  switch (status) {
    case 'pending':
      return { step: 'queued', status, progress: 0 };
    case 'analyzing':
      return { step: 'analysis', status, progress: 50 };
    case 'embedding':
      return { step: 'embedding', status, progress: 80 };
    case 'completed':
      return { step: 'completed', status, progress: 100 };
    case 'failed':
      if (hasAnalysis || hasEmbedding) {
        return { step: 'embedding', status, progress: 80 };
      }

      return { step: 'analysis', status, progress: 50 };
  }
}

