'use client';

import { startTransition, useEffect, useEffectEvent } from 'react';
import { useRouter } from 'next/navigation';

const REFRESH_INTERVAL_MS = 2000;

export function SampleStatusAutoRefresh({
  isActive,
  intervalMs = REFRESH_INTERVAL_MS,
}: {
  isActive: boolean;
  intervalMs?: number;
}) {
  const router = useRouter();

  const refreshPage = useEffectEvent(() => {
    if (document.visibilityState === 'hidden') {
      return;
    }

    startTransition(() => {
      router.refresh();
    });
  });

  useEffect(() => {
    if (!isActive) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      refreshPage();
    }, intervalMs);

    return () => {
      window.clearInterval(timer);
    };
  }, [intervalMs, isActive]);

  return null;
}
