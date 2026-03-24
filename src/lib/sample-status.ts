const ACTIVE_SAMPLE_STATUSES = new Set(['pending', 'analyzing', 'embedding']);

export function isActiveSampleStatus(status: string | null | undefined): boolean {
  return typeof status === 'string' && ACTIVE_SAMPLE_STATUSES.has(status);
}

export function hasActiveSampleStatuses(statuses: Array<string | null | undefined>): boolean {
  return statuses.some((status) => isActiveSampleStatus(status));
}
