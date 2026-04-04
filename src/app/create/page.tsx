'use client'

import Link from 'next/link';
import { Suspense, startTransition, useDeferredValue, useEffect, useReducer } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { getGenerationStepThresholds, type GenerationStep } from '@/lib/generation-lifecycle';
import { createSseParser } from '@/lib/sse';

import {
  buildCreateCopyHref,
  buildCreateImagesHref,
  buildCreatePublishHref,
  buildHistoryTaskHref,
  fetchHistoryTaskDetail,
  normalizeHistoryTaskId,
} from './history';
import {
  createInitialCreateState,
  createPageReducer,
  type CreatePageAction,
  type CreateStreamEvent,
} from './state';
import { createPageCopy } from './copy';
import { CreateComposerForm, type CreateComposerFormClasses } from './composer-form';
import { GenerationLogPanel, type GenerationLogPanelClasses } from './generation-log-panel';
import { StudioTabs, type StudioTabsClasses } from './studio-tabs';
import styles from './page.module.css';

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '请求失败';
}

function renderPill(step: string, currentStep: string, lifecycleState: string) {
  if (lifecycleState === 'failed' || currentStep === 'failed') {
    return <span className={`${styles.pill} ${styles.pillError}`}>失败</span>;
  }

  if (lifecycleState === 'stalled') {
    return <span className={`${styles.pill} ${styles.pillError}`}>stalled</span>;
  }

  if (step === currentStep) {
    return <span className={`${styles.pill} ${styles.pillActive}`}>进行中</span>;
  }

  const order = ['idle', 'understanding', 'searching', 'strategizing', 'generating', 'completed'];
  if (order.indexOf(currentStep) > order.indexOf(step)) {
    return <span className={`${styles.pill} ${styles.pillDone}`}>已完成</span>;
  }

  return <span className={`${styles.pill} ${styles.pillIdle}`}>待开始</span>;
}

function createTimestamp(): string {
  return new Date().toISOString();
}

function CreatePageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [state, dispatch] = useReducer(createPageReducer, undefined, createInitialCreateState);
  const deferredGenerationText = useDeferredValue(state.generationText);
  const requestedTaskId = normalizeHistoryTaskId(searchParams.get('taskId'));
  const requestedOutputId = normalizeHistoryTaskId(searchParams.get('outputId'));
  const contextTaskId = state.taskId ?? requestedTaskId;
  const contextOutputId = state.outputs?.id ?? requestedOutputId;

  useEffect(() => {
    if (!requestedTaskId || requestedOutputId) {
      return;
    }

    router.replace(buildHistoryTaskHref(requestedTaskId), { scroll: false });
  }, [requestedOutputId, requestedTaskId, router]);

  useEffect(() => {
    if (!requestedTaskId || !requestedOutputId || state.isSubmitting || state.taskId === requestedTaskId) {
      return;
    }

    let isMounted = true;

    void fetchHistoryTaskDetail(requestedTaskId, requestedOutputId)
      .then((detail) => {
        if (!isMounted) {
          return;
        }

        dispatch({
          type: 'copy_context_loaded',
          detail,
        });
      })
      .catch((error) => {
        if (!isMounted) {
          return;
        }

        dispatch({
          type: 'submit_failed',
          message: getErrorMessage(error),
          now: createTimestamp(),
        });
      });

    return () => {
      isMounted = false;
    };
  }, [requestedOutputId, requestedTaskId, state.isSubmitting, state.taskId]);

  useEffect(() => {
    if (!state.outputs?.id || !state.taskId) {
      return;
    }

    const nextHref = buildCreateCopyHref(state.taskId, state.outputs.id);
    const currentHref = buildCreateCopyHref(requestedTaskId, requestedOutputId);

    if (nextHref !== currentHref) {
      router.replace(nextHref, { scroll: false });
    }
  }, [requestedOutputId, requestedTaskId, router, state.outputs?.id, state.taskId]);

  useEffect(() => {
    if (!state.isSubmitting) {
      return;
    }

    const timer = window.setInterval(() => {
      dispatch({
        type: 'clock_ticked',
        now: createTimestamp(),
      });
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [state.isSubmitting]);

  useEffect(() => {
    if (!state.isSubmitting || state.idleWarningForStep === state.step) {
      return;
    }

    const quietStep = state.runtime?.current_step ?? (
      ['understanding', 'searching', 'strategizing', 'generating'].includes(state.step)
        ? state.step as GenerationStep
        : null
    );
    const referenceAt = state.runtime?.last_progress_at ?? state.submitStartedAt;
    if (!referenceAt || !quietStep) {
      return;
    }

    const quietThresholdMs = getGenerationStepThresholds(quietStep).quietWarningMs;
    const elapsedMs = Date.now() - Date.parse(referenceAt);
    const delayMs = Math.max(0, quietThresholdMs - elapsedMs);

    const timer = window.setTimeout(() => {
      dispatch({
        type: 'idle_warning_triggered',
        now: createTimestamp(),
      });
    }, delayMs);

    return () => {
      window.clearTimeout(timer);
    };
  }, [
    state.idleWarningForStep,
    state.isSubmitting,
    state.step,
    state.submitStartedAt,
    state.runtime?.current_step,
    state.runtime?.last_progress_at,
  ]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!state.form.topic.trim() || state.isSubmitting) {
      return;
    }

    const submittedAt = createTimestamp();
    dispatch({ type: 'submit_started', now: submittedAt });
    dispatch({
      type: 'log_appended',
      source: 'client',
      event: 'request_sent',
      message: '已发送生成请求',
      at: submittedAt,
      step: 'understanding',
    });

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          topic: state.form.topic,
          targetAudience: state.form.targetAudience || undefined,
          goal: state.form.goal || undefined,
          stylePreference: state.form.stylePreference || undefined,
          personaMode: state.form.personaMode,
          needCoverSuggestion: state.form.needCoverSuggestion,
        }),
      });

      dispatch({
        type: 'log_appended',
        source: 'client',
        event: 'response_headers',
        message: '已收到 SSE 响应头',
        at: createTimestamp(),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? '生成请求失败');
      }

      if (!response.headers.get('Content-Type')?.includes('text/event-stream')) {
        throw new Error('服务端没有返回 SSE 流');
      }

      if (!response.body) {
        throw new Error('服务端没有返回可读流');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let sawTerminalEvent = false;
      const parser = createSseParser((streamEvent) => {
        if (streamEvent.event === 'done' || streamEvent.event === 'error') {
          sawTerminalEvent = true;
        }

        startTransition(() => {
          dispatch({
            type: 'stream_event',
            event: streamEvent.event as CreateStreamEvent['event'],
            data: streamEvent.data as CreateStreamEvent['data'],
            receivedAt: createTimestamp(),
          } satisfies CreatePageAction);
        });
      });

      dispatch({
        type: 'log_appended',
        source: 'client',
        event: 'stream_attached',
        message: '已连接事件流',
        at: createTimestamp(),
      });

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        parser.push(decoder.decode(value, { stream: true }));
      }

      parser.push(decoder.decode());
      parser.flush();
      dispatch({
        type: 'stream_closed',
        now: createTimestamp(),
        expectedTerminal: sawTerminalEvent,
      });
    } catch (error) {
      dispatch({
        type: 'submit_failed',
        message: getErrorMessage(error),
        now: createTimestamp(),
      });
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.hero}>
          <p className={styles.eyebrow}>{createPageCopy.heroEyebrow}</p>
          <h1 className={styles.title}>{createPageCopy.heroTitle}</h1>
          <p className={styles.subtitle}>{createPageCopy.heroSubtitle}</p>
        </header>

        <StudioTabs
          activeTab="copy"
          classes={styles as unknown as StudioTabsClasses}
          taskId={contextTaskId}
          outputId={contextOutputId}
        />

        <CreateComposerForm
          classes={styles as CreateComposerFormClasses}
          form={state.form}
          isSubmitting={state.isSubmitting}
          error={state.error}
          onSubmit={handleSubmit}
          onFieldChange={(field, value) =>
            dispatch({ type: 'form_changed', field, value })
          }
        />

        <div className={styles.workspaceGrid}>
          <section className={`${styles.panel} ${styles.flowPanel}`}>
            <div className={styles.panelHeader}>
              <div className={styles.panelTitle}>生成过程</div>
              <div className={styles.panelHint}>查看任务理解、样本检索、策略生成和内容生成的过程。</div>
            </div>

            <article className={styles.stepCard}>
              <div className={styles.stepHeader}>
                <div className={styles.stepTitle}>01 · 任务理解</div>
                {renderPill('understanding', state.step, state.lifecycleState)}
              </div>
              {state.taskUnderstanding ? (
                <div className={styles.kvList}>
                  <div className={styles.kvItem}>
                    <div className={styles.kvLabel}>任务类型</div>
                    <div className={styles.kvValue}>{state.taskUnderstanding.task_type}</div>
                  </div>
                  <div className={styles.kvItem}>
                    <div className={styles.kvLabel}>建议结构</div>
                    <div className={styles.kvValue}>
                      {state.taskUnderstanding.suitable_structure ?? '未返回'}
                    </div>
                  </div>
                  <div className={styles.kvItem}>
                    <div className={styles.kvLabel}>注意事项</div>
                    <div className={styles.kvValue}>{state.taskUnderstanding.notes ?? '未返回'}</div>
                  </div>
                </div>
              ) : (
                <div className={styles.emptyState}>等待 Agent 解析任务。</div>
              )}
            </article>

            <article className={styles.stepCard}>
              <div className={styles.stepHeader}>
                <div className={styles.stepTitle}>02 · 参考检索</div>
                {renderPill('searching', state.step, state.lifecycleState)}
              </div>
              {state.references ? (
                <div className={styles.list}>
                  <div className={styles.kvItem}>
                    <div className={styles.kvLabel}>检索模式</div>
                    <div className={styles.kvValue}>{state.references.search_mode}</div>
                  </div>
                  <div className={styles.kvItem}>
                    <div className={styles.kvLabel}>参考模式</div>
                    <div className={styles.kvValue}>{state.references.reference_mode}</div>
                  </div>
                  <div className={styles.kvItem}>
                    <div className={styles.kvLabel}>候选数量</div>
                    <div className={styles.kvValue}>{state.references.candidate_count}</div>
                  </div>
                  {state.references.search_mode_reason ? (
                    <div className={styles.panelHint}>{state.references.search_mode_reason}</div>
                  ) : null}
                  {state.references.selected_references.length > 0 ? (
                    state.references.selected_references.map((reference) => (
                      <div className={styles.referenceItem} key={`${reference.sample_id}-${reference.reference_type}`}>
                        <strong>{reference.title}</strong>
                        <div className={styles.referenceMeta}>
                          <span>{reference.reference_type}</span>
                          <span>{reference.similarity.toFixed(2)}</span>
                        </div>
                        <div>{reference.reason}</div>
                      </div>
                    ))
                  ) : (
                    <div className={styles.emptyState}>
                      {state.references.search_mode === 'lexical-only'
                        ? '当前运行在 lexical-only 检索，未命中可用样本，已进入 zero-shot 模式。'
                        : '本次任务进入 zero-shot 模式。'}
                    </div>
                  )}
                </div>
              ) : (
                <div className={styles.emptyState}>等待检索结果。</div>
              )}
            </article>

            <article className={styles.stepCard}>
              <div className={styles.stepHeader}>
                <div className={styles.stepTitle}>03 · 策略形成</div>
                {renderPill('strategizing', state.step, state.lifecycleState)}
              </div>
              {state.strategySnapshot ? (
                <div className={styles.kvList}>
                  <div className={styles.kvItem}>
                    <div className={styles.kvLabel}>内容方向</div>
                    <div className={styles.kvValue}>
                      {state.strategySnapshot.content_direction ?? '生成中'}
                    </div>
                  </div>
                  <div className={styles.kvItem}>
                    <div className={styles.kvLabel}>标题策略</div>
                    <div className={styles.kvValue}>
                      {state.strategySnapshot.title_strategy ?? '生成中'}
                    </div>
                  </div>
                  <div className={styles.kvItem}>
                    <div className={styles.kvLabel}>结构策略</div>
                    <div className={styles.kvValue}>
                      {state.strategySnapshot.structure_strategy ?? '生成中'}
                    </div>
                  </div>
                  <div className={styles.kvItem}>
                    <div className={styles.kvLabel}>CTA 策略</div>
                    <div className={styles.kvValue}>
                      {state.strategySnapshot.cta_strategy ?? '生成中'}
                    </div>
                  </div>
                </div>
              ) : (
                <div className={styles.emptyState}>等待策略快照。</div>
              )}
            </article>

            <article className={styles.stepCard}>
              <div className={styles.stepHeader}>
                <div className={styles.stepTitle}>04 · 成稿生成</div>
                {renderPill(state.outputs ? 'completed' : 'generating', state.step, state.lifecycleState)}
              </div>
              <div className={styles.kvItem}>
                <div className={styles.kvLabel}>状态</div>
                <div className={styles.kvValue}>
                  {state.outputs
                    ? '结构化结果已落地'
                    : state.lifecycleState === 'stalled'
                      ? state.runtime?.stalled_reason ?? '当前阶段已进入 stalled'
                      : state.lifecycleState === 'failed'
                        ? state.error ?? '任务失败'
                        : state.isSubmitting
                          ? '正在消费 generation_delta'
                          : '等待开始'}
                </div>
              </div>
              {state.taskId ? (
                <div className={`${styles.kvItem} ${styles.mono}`}>
                  <div className={styles.kvLabel}>Task ID</div>
                  <div className={styles.kvValue}>{state.taskId}</div>
                </div>
              ) : null}
            </article>
          </section>

          <section className={`${styles.panel} ${styles.draftPanel}`}>
            <div className={styles.panelHeader}>
              <div className={styles.panelTitle}>生成结果</div>
              <div className={styles.panelHint}>这里现在只承接文案结果；图片创作已移到独立 tab。</div>
            </div>

            {state.outputs ? (
              <div className={styles.list}>
                <div className={styles.resultCard}>
                  <strong>标题候选</strong>
                  {state.outputs.titles.map((title) => (
                    <div key={title}>{title}</div>
                  ))}
                </div>
                <div className={styles.resultCard}>
                  <strong>开头候选</strong>
                  {state.outputs.openings.map((opening) => (
                    <div key={opening}>{opening}</div>
                  ))}
                </div>
                <div className={styles.resultCard}>
                  <strong>正文</strong>
                  <div className={styles.kvValue}>{state.outputs.body_versions[0]}</div>
                </div>
                <div className={styles.resultCard}>
                  <strong>CTA</strong>
                  {state.outputs.cta_versions.map((cta) => (
                    <div key={cta}>{cta}</div>
                  ))}
                </div>
                <div className={styles.resultCard}>
                  <strong>封面文案</strong>
                  {state.outputs.cover_copies.map((cover) => (
                    <div key={`${cover.main}-${cover.sub ?? ''}`}>
                      <div>{cover.main}</div>
                      <div className={styles.panelHint}>{cover.sub ?? '无副标题'}</div>
                    </div>
                  ))}
                </div>
                <div className={styles.resultCard}>
                  <strong>标签建议</strong>
                  <div>{state.outputs.hashtags.join(' ')}</div>
                </div>
                <div className={styles.resultCard}>
                  <strong>首评建议</strong>
                  <div>{state.outputs.first_comment}</div>
                </div>
                <div className={styles.resultCard}>
                  <strong>配图建议</strong>
                  <div>{state.outputs.image_suggestions}</div>
                </div>
                <div className={styles.ctaRow}>
                  <Link className={styles.secondaryButton} href={buildCreateImagesHref(state.taskId, state.outputs.id ?? null)}>
                    去图片创作
                  </Link>
                  <Link className={styles.secondaryButton} href={buildCreatePublishHref(state.taskId, state.outputs.id ?? null)}>
                    去发布
                  </Link>
                </div>
              </div>
            ) : deferredGenerationText ? (
              <div className={styles.streamBox}>{deferredGenerationText}</div>
            ) : (
              <div className={styles.emptyState}>点击上方“生成”后，这里会先出现流式文本，再切到结构化结果。</div>
            )}
          </section>
        </div>

        <GenerationLogPanel
          classes={styles as GenerationLogPanelClasses}
          isExpanded={state.isLogPanelExpanded}
          taskId={state.taskId}
          lifecycleState={state.lifecycleState}
          currentStep={state.step}
          runtime={state.runtime}
          isSubmitting={state.isSubmitting}
          submitStartedAt={state.submitStartedAt}
          currentStepStartedAt={state.currentStepStartedAt}
          clockNow={state.clockNow}
          streamClosedUnexpectedly={state.streamClosedUnexpectedly}
          logs={state.generationLogs}
          onToggle={() => dispatch({ type: 'log_panel_toggled' })}
        />
      </div>
    </main>
  );
}

export default function CreatePage() {
  return (
    <Suspense
      fallback={(
        <main className={styles.page}>
          <div className={styles.shell}>
            <header className={styles.hero}>
              <p className={styles.eyebrow}>{createPageCopy.heroEyebrow}</p>
              <h1 className={styles.title}>{createPageCopy.heroTitle}</h1>
              <p className={styles.subtitle}>{createPageCopy.fallbackSubtitle}</p>
            </header>
          </div>
        </main>
      )}
    >
      <CreatePageClient />
    </Suspense>
  );
}
