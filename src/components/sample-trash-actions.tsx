'use client';

import { useState } from 'react';
import type { SampleListView } from '@/lib/samples';

type SampleTrashActionsProps = {
  sampleId: string;
  view: SampleListView;
  context: 'list' | 'detail';
};

function resolveSuccessNavigation(
  view: SampleListView,
  context: 'list' | 'detail',
  action: 'trash' | 'restore' | 'permanent',
) {
  if (typeof window === 'undefined') {
    return;
  }

  if (context === 'list') {
    window.location.reload();
    return;
  }

  if (action === 'trash') {
    window.location.assign('/samples?view=trash');
    return;
  }

  if (action === 'restore') {
    window.location.assign('/samples');
    return;
  }

  window.location.assign('/samples?view=trash');
}

export function SampleTrashActions({
  sampleId,
  view,
  context,
}: SampleTrashActionsProps) {
  const [pendingAction, setPendingAction] = useState<'trash' | 'restore' | 'permanent' | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function runAction(
    action: 'trash' | 'restore' | 'permanent',
    request: { method: 'DELETE' | 'POST'; url: string; confirmMessage?: string },
  ) {
    if (request.confirmMessage && !window.confirm(request.confirmMessage)) {
      return;
    }

    setPendingAction(action);
    setMessage(null);

    try {
      const response = await fetch(request.url, { method: request.method });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? '操作失败');
      }

      resolveSuccessNavigation(view, context, action);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '操作失败');
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <div className="sampleActionStack">
      <div className="sampleActionGroup">
        {view === 'active' ? (
          <button
            className="buttonDanger"
            disabled={pendingAction !== null}
            type="button"
            onClick={() =>
              runAction('trash', {
                method: 'DELETE',
                url: `/api/samples/${sampleId}`,
                confirmMessage: '确认将该样本移入回收站吗？',
              })
            }
          >
            {pendingAction === 'trash' ? '处理中...' : '移入回收站'}
          </button>
        ) : (
          <>
            <button
              className="buttonSecondary"
              disabled={pendingAction !== null}
              type="button"
              onClick={() =>
                runAction('restore', {
                  method: 'POST',
                  url: `/api/samples/${sampleId}/restore`,
                })
              }
            >
              {pendingAction === 'restore' ? '处理中...' : '恢复'}
            </button>
            <button
              className="buttonDanger"
              disabled={pendingAction !== null}
              type="button"
              onClick={() =>
                runAction('permanent', {
                  method: 'DELETE',
                  url: `/api/samples/${sampleId}/permanent`,
                  confirmMessage: '确认彻底删除该样本吗？此操作不可恢复。',
                })
              }
            >
              {pendingAction === 'permanent' ? '处理中...' : '彻底删除'}
            </button>
          </>
        )}
      </div>

      {message ? <div className="helperText">{message}</div> : null}
    </div>
  );
}
