import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { getTaskDetail, hardDeleteTask } from '../repository';

export interface GenerateTaskDetailDependencies {
  getTaskDetail: typeof getTaskDetail;
  hardDeleteTask: typeof hardDeleteTask;
}

function createDefaultGenerateTaskDetailDependencies(): GenerateTaskDetailDependencies {
  return {
    getTaskDetail,
    hardDeleteTask,
  };
}

export function createGenerateTaskDetailGetHandler(
  dependencies: GenerateTaskDetailDependencies = createDefaultGenerateTaskDetailDependencies(),
) {
  return async function GET(
    request: Request,
    { params }: { params: Promise<{ taskId: string }> },
  ) {
    try {
      const { taskId } = await params;
      const outputId = new URL(request.url).searchParams.get('outputId');
      const detail = await dependencies.getTaskDetail(taskId, {
        selectedOutputId: outputId?.trim() || null,
      });

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

export function createGenerateTaskDetailDeleteHandler(
  dependencies: GenerateTaskDetailDependencies = createDefaultGenerateTaskDetailDependencies(),
) {
  return async function DELETE(
    _request: Request,
    { params }: { params: Promise<{ taskId: string }> },
  ) {
    try {
      const { taskId } = await params;
      const result = await dependencies.hardDeleteTask(taskId);

      switch (result.code) {
        case 'deleted':
          return new NextResponse(null, { status: 204 });
        case 'not_found':
          return NextResponse.json({ error: 'Task not found' }, { status: 404 });
        case 'task_active':
          return NextResponse.json({
            error: 'Task is still active and cannot be deleted',
          }, { status: 409 });
        case 'image_job_active':
          return NextResponse.json({
            error: 'Task still has active image jobs and cannot be deleted',
          }, { status: 409 });
      }
    } catch (error) {
      logger.error({ error }, 'Failed to delete generation task');
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  };
}

export const GET = createGenerateTaskDetailGetHandler();
export const DELETE = createGenerateTaskDetailDeleteHandler();
