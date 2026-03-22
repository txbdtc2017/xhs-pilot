import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { getDashboardStats } from '@/lib/dashboard';

export interface DashboardStatsDependencies {
  getDashboardStats: typeof getDashboardStats;
}

function createDefaultDashboardStatsDependencies(): DashboardStatsDependencies {
  return {
    getDashboardStats,
  };
}

export function createDashboardStatsGetHandler(
  dependencies: DashboardStatsDependencies = createDefaultDashboardStatsDependencies(),
) {
  return async function GET() {
    try {
      return NextResponse.json(await dependencies.getDashboardStats());
    } catch (error) {
      logger.error({ error }, 'Failed to fetch dashboard stats');
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  };
}

export const GET = createDashboardStatsGetHandler();
