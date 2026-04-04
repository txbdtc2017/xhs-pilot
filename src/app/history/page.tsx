'use client'

import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import {
  buildHistoryTaskHref,
  fetchHistoryTaskDetail,
  fetchHistoryTasks,
  normalizeHistoryTaskId,
} from '@/app/create/history';
import { HistoryDetailView, type HistoryDetailViewClasses } from '@/app/create/history-detail-view';
import type { HistoryTaskDetail, HistoryTaskSummary } from '@/app/create/models';
import { formatHistoryDate } from '@/app/create/view-helpers';
import styles from '@/app/create/page.module.css';

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '请求失败';
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
  const isLoadingTasks = !hasLoadedTasks && tasks.length === 0 && !error;

  useEffect(() => {
    let isMounted = true;

    void fetchHistoryTasks()
      .then((payload) => {
        if (!isMounted) {
          return;
        }

        setTasks(payload);
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

  const preferredTaskId = requestedTaskId ?? tasks[0]?.id ?? null;
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

  function handleTaskSelect(taskId: string) {
    router.replace(buildHistoryTaskHref(taskId), { scroll: false });
  }

  function handleOutputSelect(outputId: string) {
    if (!preferredTaskId) {
      return;
    }

    router.replace(buildHistoryTaskHref(preferredTaskId, outputId), { scroll: false });
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.hero}>
          <p className={styles.eyebrow}>History</p>
          <h1 className={styles.title}>历史任务</h1>
          <p className={styles.subtitle}>把任务输入、参考分配、策略快照、输出版本和图片摘要从工作台里拆出来，作为独立归档页查看。</p>
        </header>

        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <div className={styles.panelTitle}>归档入口</div>
              <div className={styles.panelHint}>这里是只读历史页；如果要继续创作或出图，回到工作台 tab。</div>
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
              <div className={styles.panelHint}>选择一条任务，右侧会展示完整链路。</div>
            </div>

            {visibleError ? <div className={styles.errorBox}>{visibleError}</div> : null}

            {tasks.length > 0 ? (
              <div className={styles.list}>
                {tasks.map((task) => {
                  const isActive = task.id === preferredTaskId;

                  return (
                    <button
                      key={task.id}
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
              <div className={styles.panelHint}>只读查看，不在这里继续出图或发布。</div>
            </div>

            {isLoadingDetail && !detail ? (
              <div className={styles.emptyState}>正在加载历史链路…</div>
            ) : (
              <HistoryDetailView
                classes={styles as HistoryDetailViewClasses}
                detail={detail}
                selectedOutputId={preferredOutputId ?? detail?.selected_output_id ?? null}
                onSelectOutputVersion={handleOutputSelect}
              />
            )}
          </section>
        </section>
      </div>
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
