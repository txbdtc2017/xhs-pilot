'use client'

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import {
  buildCreateImagesHref,
  fetchHistoryTaskDetail,
  fetchHistoryTasks,
  normalizeHistoryTaskId,
} from '@/app/create/history';
import { ImageConfigForm, type ImageConfigFormClasses } from '@/app/create/image-config-form';
import {
  consumeImageJobEvents,
  createImageJob,
  createImagePlan,
  fetchImageProviders,
  selectImageAsset,
  updateImagePlan,
} from '@/app/create/image-api';
import { ImageWorkbench, type ImageWorkbenchClasses } from '@/app/create/image-workbench';
import type {
  HistoryTaskDetail,
  HistoryTaskSummary,
  ImageConfigValues,
  ImageProviderPayload,
} from '@/app/create/models';
import { StudioTabs, type StudioTabsClasses } from '@/app/create/studio-tabs';
import { TaskContextPicker, type TaskContextPickerClasses } from '@/app/create/task-context-picker';
import styles from '@/app/create/page.module.css';

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '请求失败';
}

function createDefaultImageConfig(): ImageConfigValues {
  return {
    provider: 'openai',
    visualDirectionOverride: '',
    bodyPageCap: 4,
    coverCandidateCount: 2,
    bodyCandidateCount: 1,
  };
}

function ImageStudioPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedTaskId = normalizeHistoryTaskId(searchParams.get('taskId'));
  const requestedOutputId = normalizeHistoryTaskId(searchParams.get('outputId'));
  const [tasks, setTasks] = useState<HistoryTaskSummary[]>([]);
  const [detail, setDetail] = useState<HistoryTaskDetail | null>(null);
  const [providers, setProviders] = useState<ImageProviderPayload[]>([]);
  const [imageConfig, setImageConfig] = useState<ImageConfigValues>(createDefaultImageConfig);
  const [hasLoadedTasks, setHasLoadedTasks] = useState(false);
  const [loadedDetailKey, setLoadedDetailKey] = useState<string | null>(null);
  const [isImageLoading, setIsImageLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resolvedOutputId = requestedOutputId ?? detail?.selected_output_id ?? detail?.outputs?.id ?? null;
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
    let isMounted = true;

    void fetchImageProviders()
      .then((payload) => {
        if (!isMounted) {
          return;
        }

        setProviders(payload.providers);
        if (payload.default_provider) {
          setImageConfig((current) => ({
            ...current,
            provider: payload.default_provider!,
          }));
        }
      })
      .catch((error) => {
        if (!isMounted) {
          return;
        }

        setError(getErrorMessage(error));
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

  useEffect(() => {
    const plan = detail?.latest_image_plan?.plan;
    if (!plan || plan.output_id !== resolvedOutputId) {
      return;
    }

    setImageConfig((current) => ({
      ...current,
      provider: plan.provider,
      visualDirectionOverride: plan.visual_direction_override ?? '',
      bodyPageCap: plan.body_page_cap ?? current.bodyPageCap,
      coverCandidateCount: plan.cover_candidate_count ?? current.coverCandidateCount,
      bodyCandidateCount: plan.body_candidate_count ?? current.bodyCandidateCount,
    }));
  }, [detail?.latest_image_plan?.plan, resolvedOutputId]);

  useEffect(() => {
    const imageJobId = detail?.active_image_job?.id;
    if (!imageJobId || !requestedTaskId) {
      return;
    }

    const controller = new AbortController();

    void consumeImageJobEvents(
      imageJobId,
      () => {
        void fetchHistoryTaskDetail(requestedTaskId, resolvedOutputId).then((payload) => {
          setDetail(payload);
        }).catch((error) => {
          setError(getErrorMessage(error));
        });
      },
      { signal: controller.signal },
    ).catch((error) => {
      setError(getErrorMessage(error));
    });

    return () => {
      controller.abort();
    };
  }, [detail?.active_image_job?.id, requestedTaskId, resolvedOutputId]);

  async function runImageAction(action: () => Promise<void>) {
    setIsImageLoading(true);
    setError(null);

    try {
      await action();
    } catch (error) {
      setError(getErrorMessage(error));
    } finally {
      setIsImageLoading(false);
    }
  }

  function handleOutputSelect(outputId: string) {
    if (!requestedTaskId) {
      return;
    }

    router.replace(buildCreateImagesHref(requestedTaskId, outputId), { scroll: false });
  }

  const currentTaskTopic = detail?.task.topic ?? tasks.find((task) => task.id === requestedTaskId)?.topic ?? '未选择任务';

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.hero}>
          <p className={styles.eyebrow}>Images</p>
          <h1 className={styles.title}>图片创作</h1>
          <p className={styles.subtitle}>文案和图片现在拆开处理：这里专门负责图片 provider、计划、整套生成、单页重生和选图。</p>
        </header>

        <StudioTabs
          activeTab="images"
          classes={styles as unknown as StudioTabsClasses}
          taskId={requestedTaskId}
          outputId={resolvedOutputId}
        />

        {requestedTaskId ? (
          <>
            <section className={styles.panel}>
              <div className={styles.panelHeader}>
                <div>
                  <div className={styles.panelTitle}>当前任务上下文</div>
                  <div className={styles.panelHint}>图片工作区会绑定当前 task 和输出版本；切换版本会同时切换对应的图片计划与选图摘要。</div>
                </div>
              </div>
              <div className={styles.kvList}>
                <div className={styles.kvItem}>
                  <div className={styles.kvLabel}>当前任务</div>
                  <div className={styles.kvValue}>{currentTaskTopic}</div>
                </div>
                <div className={styles.kvItem}>
                  <div className={styles.kvLabel}>当前输出版本</div>
                  <div className={styles.kvValue}>
                    {resolvedOutputId
                      ? `output ${resolvedOutputId}`
                      : '当前任务尚无可用文案版本'}
                  </div>
                </div>
              </div>
            </section>

            <div className={styles.workspaceGrid}>
              <div className={styles.list}>
                <ImageConfigForm
                  classes={styles as ImageConfigFormClasses}
                  config={imageConfig}
                  providers={providers}
                  onChange={(field, value) => {
                    setImageConfig((current) => ({
                      ...current,
                      [field]: value,
                    }));
                  }}
                />

                <TaskContextPicker
                  classes={styles as TaskContextPickerClasses}
                  title="切换任务"
                  hint="快速切到别的文案任务继续出图。"
                  emptyMessage="可以直接切换到最近任务，不需要回历史页。"
                  tasks={tasks}
                  selectedTaskId={requestedTaskId}
                  buildHref={(taskId) => buildCreateImagesHref(taskId)}
                />
              </div>

              {isLoadingDetail && !detail ? (
                <section className={styles.panel}>
                  <div className={styles.emptyState}>正在加载图片工作区…</div>
                </section>
              ) : (
                <ImageWorkbench
                  classes={styles as ImageWorkbenchClasses}
                  detail={detail}
                  selectedOutputId={resolvedOutputId}
                  imageConfig={imageConfig}
                  isLoading={isImageLoading}
                  error={visibleError}
                  onSelectOutputVersion={handleOutputSelect}
                  onCreatePlan={() => {
                    void runImageAction(async () => {
                      if (!resolvedOutputId || !requestedTaskId) {
                        return;
                      }

                      await createImagePlan(resolvedOutputId, imageConfig);
                      setDetail(await fetchHistoryTaskDetail(requestedTaskId, resolvedOutputId));
                    });
                  }}
                  onTogglePage={(pageId, isEnabled) => {
                    void runImageAction(async () => {
                      const planId = detail?.latest_image_plan?.plan.id;
                      if (!planId || !requestedTaskId) {
                        return;
                      }

                      await updateImagePlan(planId, {
                        pages: [{ id: pageId, isEnabled }],
                      });
                      setDetail(await fetchHistoryTaskDetail(requestedTaskId, resolvedOutputId));
                    });
                  }}
                  onRunFullJob={() => {
                    void runImageAction(async () => {
                      const planId = detail?.latest_image_plan?.plan.id;
                      if (!planId || !requestedTaskId) {
                        return;
                      }

                      await createImageJob(planId, { scope: 'full', planPageId: null });
                      setDetail(await fetchHistoryTaskDetail(requestedTaskId, resolvedOutputId));
                    });
                  }}
                  onRunPageJob={(pageId) => {
                    void runImageAction(async () => {
                      const planId = detail?.latest_image_plan?.plan.id;
                      if (!planId || !requestedTaskId) {
                        return;
                      }

                      await createImageJob(planId, { scope: 'page', planPageId: pageId });
                      setDetail(await fetchHistoryTaskDetail(requestedTaskId, resolvedOutputId));
                    });
                  }}
                  onSelectAsset={(assetId) => {
                    void runImageAction(async () => {
                      if (!requestedTaskId) {
                        return;
                      }

                      await selectImageAsset(assetId);
                      setDetail(await fetchHistoryTaskDetail(requestedTaskId, resolvedOutputId));
                    });
                  }}
                />
              )}
            </div>
          </>
        ) : (
          <TaskContextPicker
            classes={styles as TaskContextPickerClasses}
            title="选择任务"
            hint="图片创作只接收已经完成过文案生成的任务。"
            emptyMessage="先从文案创作生成一条结果，或手动选择已有任务。"
            tasks={tasks}
            selectedTaskId={null}
            buildHref={(taskId) => buildCreateImagesHref(taskId)}
          />
        )}

        {!requestedTaskId && isLoadingTasks ? (
          <section className={styles.panel}>
            <div className={styles.emptyState}>正在加载最近任务…</div>
          </section>
        ) : null}
      </div>
    </main>
  );
}

export default function ImageStudioPage() {
  return (
    <Suspense
      fallback={(
        <main className={styles.page}>
          <div className={styles.shell}>
            <header className={styles.hero}>
              <p className={styles.eyebrow}>Images</p>
              <h1 className={styles.title}>图片创作</h1>
              <p className={styles.subtitle}>正在加载图片工作区…</p>
            </header>
          </div>
        </main>
      )}
    >
      <ImageStudioPageClient />
    </Suspense>
  );
}
