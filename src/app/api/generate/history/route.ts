import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { getTaskHistory } from '../repository';

export interface GenerateHistoryDependencies {
  getTaskHistory: typeof getTaskHistory;
}

function createDefaultGenerateHistoryDependencies(): GenerateHistoryDependencies {
  return {
    getTaskHistory,
  };
}

export function createGenerateHistoryGetHandler(
  dependencies: GenerateHistoryDependencies = createDefaultGenerateHistoryDependencies(),
) {
  return async function GET(request: Request) {
    try {
      const { searchParams } = new URL(request.url);
      const page = parseInt(searchParams.get('page') || '1', 10);
      const limit = parseInt(searchParams.get('limit') || '20', 10);

      const payload = await dependencies.getTaskHistory({ page, limit });
      return NextResponse.json(payload);
    } catch (error) {
      logger.error({ error }, 'Failed to fetch generation history');
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  };
}

export const GET = createGenerateHistoryGetHandler();
