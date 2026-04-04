'use client'

import Link from 'next/link';
import { Suspense, useEffect, useMemo, useReducer, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import {
  buildHistoryTaskHref,
  deleteHistoryTask,
  fetchHistoryTaskDetail,
  fetchHistoryTasks,
  normalizeHistoryTaskId,
} from '@/app/create/history';
import { HistoryDetailView, type HistoryDetailViewClasses } from '@/app/create/history-detail-view';
import type { HistoryTaskDetail, HistoryTaskSummary } from '@/app/create/models';
import { formatHistoryDate } from '@/app/create/view-helpers';
import { ConfirmationDialog } from '@/components/confirmation-dialog';
import {
  applyHistoryTaskDeletion,
  createInitialHistoryDeleteState,
  reduceHistoryDeleteState,
} from './delete-flow';
import styles from '@/app/create/page.module.css';

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '请求失败';
}

function buildHistoryPageHref(taskId?: string | null, outputId?: string | null): string {
  return taskId ? buildHistoryTaskHref(taskId, outputId) : '/history';
}

function HistoryPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedTaskId = normalizeHistoryTaskId(searchParams.get('taskId'));
  const requestedOutputId = normalizeHistoryTaskId(searchParams.get('outputId'));
  const [tasks, setTasks] = useState<HistoryTaskSummary[]>([]);
  const [detail, setDetail] = useState<HistoryTaskDetail | null>(null);
  const [hasLoadedTasks, setHasLoadedTasks] = useState(false);
  const [loadedDetailKey, setLoadedDetailKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleteState, dispatchDelete] = useReducer(
    reduceHistoryDeleteState,
    undefined,
    createInitialHistoryDeleteState,
  );
  const isLoadingTasks = !hasLoadedTasks && tasks.length === 0 && !error;

  useEffect(() => {
    let isMounted = true;

    void fetchHistoryTasks()
      .then((payload) => {
        if (!isMounted) {
          return;
        }

        setTasks(payload);
        setError(null);
      })
      .catch((error) => {
        if (!isMounted) {
          return;
        }

        setError(getErrorMessage(error));
      })
      .finally(() => {
        if (isMounted) {
          setHasLoadedTasks(true);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const hasRequestedTask = requestedTaskId
    ? tasks.some((task) => task.id === requestedTaskId)
    : false;
  const preferredTaskId = requestedTaskId && hasRequestedTask
    ? requestedTaskId
    : tasks[0]?.id ?? null;
  const preferredOutputId = requestedTaskId === preferredTaskId ? requestedOutputId : null;
  const preferredDetailKey = `${preferredTaskId ?? ''}:${preferredOutputId ?? ''}`;
  const isLoadingDetail = Boolean(preferredTaskId) && loadedDetailKey !== preferredDetailKey && !error;
  const visibleError = preferredTaskId
    ? (loadedDetailKey === preferredDetailKey ? error : null)
    : error;

  useEffect(() => {
    if (!preferredTaskId) {
      return;
    }

    let isMounted = true;

    void fetchHistoryTaskDetail(preferredTaskId, preferredOutputId)
      .then((payload) => {
        if (!isMounted) {
          return;
        }

        setDetail(payload);
        setError(null);
        setLoadedDetailKey(preferredDetailKey);
      })
      .catch((error) => {
        if (!isMounted) {
          return;
        }

        setError(getErrorMessage(error));
        setLoadedDetailKey(preferredDetailKey);
      });

    return () => {
      isMounted = false;
    };
  }, [preferredDetailKey, preferredOutputId, preferredTaskId]);

  const visibleDetail = preferredTaskId ? detail : null;

  const modalTask = useMemo(
    () => tasks.find((task) => task.id === deleteState.modalTaskId) ?? null,
    [deleteState.modalTaskId, tasks],
  );

  function handleTaskSelect(taskId: string) {
    router.replace(buildHistoryPageHref(taskId), { scroll: false });
  }

  function handleOutputSelect(outputId: string) {
    if (!preferredTaskId) {
      return;
    }

    router.replace(buildHistoryPageHref(preferredTaskId, outputId), { scroll: false });
  }

  function handleDeleteArm(taskId: string) {
    dispatchDelete({
      type: 'delete_armed',
      taskId,
    });
  }

  function handleDeleteCancel() {
    dispatchDelete({ type: 'delete_cancelled' });
  }

  function handleDeleteModalOpen(taskId: string) {
    dispatchDelete({
      type: 'delete_modal_opened',
      taskId,
    });
  }

  async function handleDeleteConfirm() {
    if (!deleteState.modalTaskId) {
      return;
    }

    const taskId = deleteState.modalTaskId;
    dispatchDelete({
      type: 'delete_requested',
      taskId,
    });

    try {
      await deleteHistoryTask(taskId);

      const nextState = applyHistoryTaskDeletion({
        tasks,
        selectedTaskId: preferredTaskId,
        deletedTaskId: taskId,
      });

      setTasks(nextState.tasks);
      dispatchDelete({ type: 'delete_succeeded' });

      if (preferredTaskId === taskId) {
        setDetail(null);
        setLoadedDetailKey(null);
        router.replace(buildHistoryPageHref(nextState.nextSelectedTaskId), { scroll: false });
      }
    } catch (error) {
      dispatchDelete({
        type: 'delete_failed',
        taskId,
        message: getErrorMessage(error),
      });
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.hero}>
          <p className={styles.eyebrow}>History</p>
          <h1 className={styles.title}>历史任务</h1>
          <p className={styles.subtitle}>把任务输入、参考分配、策略快照、输出版本和图片摘要独立归档，支持永久删除低价值历史记录。</p>
        </header>

        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <div className={styles.panelTitle}>归档入口</div>
              <div className={styles.panelHint}>这里只做回看和清理；继续创作请回到工作台。</div>
            </div>
            <Link className={styles.secondaryButton} href="/create">
              回到创作工作台
            </Link>
          </div>
        </section>

        <section className={styles.historyGrid}>
          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <div className={styles.panelTitle}>历史任务</div>
              <div className={styles.panelHint}>先在列表中定位目标任务，再决定是否永久删除。</div>
            </div>

            {visibleError ? <div className={styles.errorBox}>{visibleError}</div> : null}

            {tasks.length > 0 ? (
              <div className={styles.list}>
                {tasks.map((task) => {
                  const isActive = task.id === preferredTaskId;
                  const isArmed = task.id === deleteState.armedTaskId;
                  const isPendingDelete = task.id === deleteState.pendingTaskId;

                  return (
                    <article key={task.id} className={styles.historyTaskCard}>
                      <button
                        className={`${styles.historyTaskButton} ${isActive ? styles.historyTaskButtonActive : ''}`}
                        type="button"
                        onClick={() => handleTaskSelect(task.id)}
                      >
                        <div className={styles.historyTaskHeader}>
                          <strong>{task.topic}</strong>
                          <span className={styles.historyTaskStatus}>{task.status}</span>
                        </div>
                        <div className={styles.historyTaskMeta}>
                          <span>{task.reference_mode ?? '未记录参考模式'}</span>
                          <span>{formatHistoryDate(task.created_at)}</span>
                        </div>
                      </button>

                      {isArmed ? (
                        <div className={styles.deleteInlineWarning}>
                          <div>删除后会立即移除该任务及其所有文案版本、图片计划、图片资产和相关记录。</div>
                          <div className={styles.historyTaskActions}>
                            <button
                              type="button"
                              className={styles.subtleButton}
                              onClick={handleDeleteCancel}
                              disabled={Boolean(deleteState.pendingTaskId)}
                            >
                              取消
                            </button>
                            <button
                              type="button"
                              className={styles.dangerButton}
                              onClick={() => handleDeleteModalOpen(task.id)}
                              disabled={Boolean(deleteState.pendingTaskId)}
                            >
                              {isPendingDelete ? '删除中…' : '继续删除'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className={styles.historyTaskActions}>
                          <button
                            type="button"
                            className={styles.deleteButton}
                            onClick={() => handleDeleteArm(task.id)}
                            disabled={!task.can_delete || Boolean(deleteState.pendingTaskId)}
                            title={task.can_delete ? '永久删除该任务' : '当前任务不可删除'}
                          >
                            删除任务
                          </button>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className={styles.emptyState}>
                {isLoadingTasks ? '正在加载历史任务…' : '还没有可查看的历史任务。'}
              </div>
            )}
          </section>

          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <div className={styles.panelTitle}>历史详情</div>
              <div className={styles.panelHint}>只读查看任务链路，不在这里继续出图或发布。</div>
            </div>

            {isLoadingDetail && !detail ? (
              <div className={styles.emptyState}>正在加载历史链路…</div>
            ) : (
              <HistoryDetailView
                classes={styles as HistoryDetailViewClasses}
                detail={visibleDetail}
                selectedOutputId={preferredOutputId ?? visibleDetail?.selected_output_id ?? null}
                onSelectOutputVersion={handleOutputSelect}
              />
            )}
          </section>
        </section>
      </div>

      <ConfirmationDialog
        open={Boolean(modalTask)}
        title="永久删除任务"
        description={modalTask ? (
          <div className={styles.modalCopy}>
            <p><strong>{modalTask.topic}</strong></p>
            <p>该任务及其所有生成版本、图片计划、图片资产和事件记录都会被彻底移除。</p>
            <p>这是不可撤销操作，请确认你要继续。</p>
            {deleteState.errorMessage ? (
              <span className={styles.errorBox}>{deleteState.errorMessage}</span>
            ) : null}
          </div>
        ) : undefined}
        confirmLabel="确认永久删除"
        cancelLabel="取消"
        isConfirming={Boolean(deleteState.pendingTaskId)}
        onCancel={handleDeleteCancel}
        onConfirm={() => {
          void handleDeleteConfirm();
        }}
        classes={{
          backdrop: styles.modalBackdrop,
          dialog: styles.modalCard,
          body: styles.modalBody,
          actions: styles.modalActions,
          cancelButton: styles.subtleButton,
          confirmButton: styles.dangerButton,
        }}
      />
    </main>
  );
}

export default function HistoryPage() {
  return (
    <Suspense
      fallback={(
        <main className={styles.page}>
          <div className={styles.shell}>
            <header className={styles.hero}>
              <p className={styles.eyebrow}>History</p>
              <h1 className={styles.title}>历史任务</h1>
              <p className={styles.subtitle}>正在加载历史任务…</p>
            </header>
          </div>
        </main>
      )}
    >
      <HistoryPageClient />
    </Suspense>
  );
}
