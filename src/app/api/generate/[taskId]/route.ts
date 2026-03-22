import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { getTaskDetail } from '../repository';

export interface GenerateTaskDetailDependencies {
  getTaskDetail: typeof getTaskDetail;
}

function createDefaultGenerateTaskDetailDependencies(): GenerateTaskDetailDependencies {
  return {
    getTaskDetail,
  };
}

export function createGenerateTaskDetailGetHandler(
  dependencies: GenerateTaskDetailDependencies = createDefaultGenerateTaskDetailDependencies(),
) {
  return async function GET(
    _request: Request,
    { params }: { params: Promise<{ taskId: string }> },
  ) {
    try {
      const { taskId } = await params;
      const detail = await dependencies.getTaskDetail(taskId);

      if (!detail) {
        return NextResponse.json({ error: 'Task not found' }, { status: 404 });
      }

      return NextResponse.json(detail);
    } catch (error) {
      logger.error({ error }, 'Failed to fetch generation task detail');
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  };
}

export const GET = createGenerateTaskDetailGetHandler();
