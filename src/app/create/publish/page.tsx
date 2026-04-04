'use client'

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import {
  buildCreatePublishHref,
  fetchHistoryTaskDetail,
  fetchHistoryTasks,
  normalizeHistoryTaskId,
} from '@/app/create/history';
import type { HistoryTaskDetail, HistoryTaskSummary } from '@/app/create/models';
import { PublishWorkbench, type PublishWorkbenchClasses } from '@/app/create/publish-workbench';
import { StudioTabs, type StudioTabsClasses } from '@/app/create/studio-tabs';
import { TaskContextPicker, type TaskContextPickerClasses } from '@/app/create/task-context-picker';
import styles from '@/app/create/page.module.css';

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '请求失败';
}

function PublishStudioPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedTaskId = normalizeHistoryTaskId(searchParams.get('taskId'));
  const requestedOutputId = normalizeHistoryTaskId(searchParams.get('outputId'));
  const [tasks, setTasks] = useState<HistoryTaskSummary[]>([]);
  const [detail, setDetail] = useState<HistoryTaskDetail | null>(null);
  const [hasLoadedTasks, setHasLoadedTasks] = useState(false);
  const [loadedDetailKey, setLoadedDetailKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const detailRequestKey = `${requestedTaskId ?? ''}:${requestedOutputId ?? ''}`;
  const isLoadingTasks = !hasLoadedTasks && tasks.length === 0 && !error;
  const isLoadingDetail = Boolean(requestedTaskId) && loadedDetailKey !== detailRequestKey && !error;
  const visibleError = requestedTaskId
    ? (loadedDetailKey === detailRequestKey ? error : null)
    : error;

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

  useEffect(() => {
    if (!requestedTaskId) {
      return;
    }

    let isMounted = true;

    void fetchHistoryTaskDetail(requestedTaskId, requestedOutputId)
      .then((payload) => {
        if (!isMounted) {
          return;
        }

        setDetail(payload);
        setLoadedDetailKey(detailRequestKey);
      })
      .catch((error) => {
        if (!isMounted) {
          return;
        }

        setError(getErrorMessage(error));
        setLoadedDetailKey(detailRequestKey);
      })

    return () => {
      isMounted = false;
    };
  }, [detailRequestKey, requestedOutputId, requestedTaskId]);

  function handleOutputSelect(outputId: string) {
    if (!requestedTaskId) {
      return;
    }

    router.replace(buildCreatePublishHref(requestedTaskId, outputId), { scroll: false });
  }

  const resolvedOutputId = requestedOutputId ?? detail?.selected_output_id ?? detail?.outputs?.id ?? null;
  const currentTaskTopic = detail?.task.topic ?? tasks.find((task) => task.id === requestedTaskId)?.topic ?? '未选择任务';

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.hero}>
          <p className={styles.eyebrow}>Publish</p>
          <h1 className={styles.title}>发布</h1>
          <p className={styles.subtitle}>这一段只负责整理当前任务的发布包预览，把文案和已选图片收成清晰的发布准备台。</p>
        </header>

        <StudioTabs
          activeTab="publish"
          classes={styles as unknown as StudioTabsClasses}
          taskId={requestedTaskId}
          outputId={resolvedOutputId}
        />

        {requestedTaskId ? (
          <div className={styles.workspaceGrid}>
            <div className={styles.list}>
              <section className={styles.panel}>
                <div className={styles.panelHeader}>
                  <div className={styles.panelTitle}>当前任务上下文</div>
                  <div className={styles.panelHint}>发布页只读消费当前 task 和 output，不修改文案或图片数据。</div>
                </div>
                <div className={styles.kvList}>
                  <div className={styles.kvItem}>
                    <div className={styles.kvLabel}>当前任务</div>
                    <div className={styles.kvValue}>{currentTaskTopic}</div>
                  </div>
                  <div className={styles.kvItem}>
                    <div className={styles.kvLabel}>当前输出版本</div>
                    <div className={styles.kvValue}>
                      {resolvedOutputId ? `output ${resolvedOutputId}` : '当前任务尚无可用文案版本'}
                    </div>
                  </div>
                </div>
              </section>

              <TaskContextPicker
                classes={styles as TaskContextPickerClasses}
                title="切换任务"
                hint="可以直接切到别的任务整理发布包。"
                emptyMessage="最近任务会出现在这里，便于快速切换。"
                tasks={tasks}
                selectedTaskId={requestedTaskId}
                buildHref={(taskId) => buildCreatePublishHref(taskId)}
              />
            </div>

            {isLoadingDetail && !detail ? (
              <section className={styles.panel}>
                <div className={styles.emptyState}>正在加载发布预览…</div>
              </section>
            ) : (
              <PublishWorkbench
                classes={styles as PublishWorkbenchClasses}
                detail={detail}
                selectedOutputId={resolvedOutputId}
                onSelectOutputVersion={handleOutputSelect}
              />
            )}
          </div>
        ) : (
          <TaskContextPicker
            classes={styles as TaskContextPickerClasses}
            title="选择任务"
            hint="发布页只消费已经存在的文案和选图结果。"
            emptyMessage="先完成文案或图片创作，再整理发布包。"
            tasks={tasks}
            selectedTaskId={null}
            buildHref={(taskId) => buildCreatePublishHref(taskId)}
          />
        )}

        {visibleError ? <section className={styles.errorBox}>{visibleError}</section> : null}

        {!requestedTaskId && isLoadingTasks ? (
          <section className={styles.panel}>
            <div className={styles.emptyState}>正在加载最近任务…</div>
          </section>
        ) : null}
      </div>
    </main>
  );
}

export default function PublishStudioPage() {
  return (
    <Suspense
      fallback={(
        <main className={styles.page}>
          <div className={styles.shell}>
            <header className={styles.hero}>
              <p className={styles.eyebrow}>Publish</p>
              <h1 className={styles.title}>发布</h1>
              <p className={styles.subtitle}>正在加载发布准备台…</p>
            </header>
          </div>
        </main>
      )}
    >
      <PublishStudioPageClient />
    </Suspense>
  );
}
