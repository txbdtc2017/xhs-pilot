'use client'

import { Suspense, startTransition, useDeferredValue, useEffect, useReducer } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createSseParser } from '@/lib/sse';
import {
  buildHistoryTaskHref,
  fetchHistoryTaskDetail,
  fetchHistoryTasks,
  normalizeHistoryTaskId,
} from './history';
import {
  createInitialCreateState,
  createPageReducer,
  type CreatePageAction,
  type CreateStreamEvent,
} from './state';
import styles from './page.module.css';

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '请求失败';
}

function renderPill(step: string, currentStep: string) {
  if (currentStep === 'failed') {
    return <span className={`${styles.pill} ${styles.pillError}`}>失败</span>;
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

function readHistoryString(record: Record<string, unknown> | null | undefined, key: string): string {
  if (!record) {
    return '';
  }

  const value = record[key];
  return typeof value === 'string' ? value : '';
}

function readHistoryBoolean(record: Record<string, unknown> | null | undefined, key: string): boolean {
  return Boolean(record?.[key]);
}

function formatHistoryDate(value: string | null | undefined): string {
  if (!value) {
    return '未知时间';
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '未知时间' : date.toLocaleString('zh-CN');
}

function CreatePageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [state, dispatch] = useReducer(createPageReducer, undefined, createInitialCreateState);
  const deferredGenerationText = useDeferredValue(state.generationText);
  const requestedHistoryTaskId = normalizeHistoryTaskId(searchParams.get('taskId'));

  useEffect(() => {
    let isMounted = true;

    dispatch({ type: 'history_list_requested' });
    void fetchHistoryTasks()
      .then((tasks) => {
        if (!isMounted) {
          return;
        }

        dispatch({ type: 'history_list_loaded', tasks });
      })
      .catch((error) => {
        if (!isMounted) {
          return;
        }

        dispatch({ type: 'history_failed', message: getErrorMessage(error) });
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const preferredHistoryTaskId =
    requestedHistoryTaskId ?? state.selectedHistoryTaskId ?? state.historyTasks[0]?.id ?? null;

  useEffect(() => {
    if (!preferredHistoryTaskId) {
      return;
    }

    if (state.selectedHistoryDetail?.task.id === preferredHistoryTaskId) {
      return;
    }

    let isMounted = true;
    dispatch({ type: 'history_detail_requested', taskId: preferredHistoryTaskId });

    void fetchHistoryTaskDetail(preferredHistoryTaskId)
      .then((detail) => {
        if (!isMounted) {
          return;
        }

        dispatch({
          type: 'history_detail_loaded',
          taskId: preferredHistoryTaskId,
          detail,
        });
      })
      .catch((error) => {
        if (!isMounted) {
          return;
        }

        dispatch({ type: 'history_failed', message: getErrorMessage(error) });
      });

    return () => {
      isMounted = false;
    };
  }, [preferredHistoryTaskId, state.selectedHistoryDetail?.task.id]);

  useEffect(() => {
    if (!state.taskId || requestedHistoryTaskId === state.taskId) {
      return;
    }

    router.replace(buildHistoryTaskHref(state.taskId));
  }, [requestedHistoryTaskId, router, state.taskId]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!state.form.topic.trim() || state.isSubmitting) {
      return;
    }

    dispatch({ type: 'submit_started' });

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
      const parser = createSseParser((streamEvent) => {
        startTransition(() => {
          dispatch({
            type: 'stream_event',
            event: streamEvent.event as CreateStreamEvent['event'],
            data: streamEvent.data as CreateStreamEvent['data'],
          } satisfies CreatePageAction);
        });
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
    } catch (error) {
      dispatch({
        type: 'submit_failed',
        message: getErrorMessage(error),
      });
    }
  }

  function handleHistorySelect(taskId: string) {
    router.replace(buildHistoryTaskHref(taskId));
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.hero}>
          <p className={styles.eyebrow}>Phase 4 Creation Studio</p>
          <h1 className={styles.title}>让策略可见，让生成可追踪。</h1>
          <p className={styles.subtitle}>
            左侧定义任务，中间实时观察 Agent 的理解、检索与策略过程，右侧接收流式生成内容并在完成后切换为结构化结果。
          </p>
        </header>

        <div className={styles.grid}>
          <form className={styles.panel} onSubmit={handleSubmit}>
            <div className={styles.panelHeader}>
              <div className={styles.panelTitle}>任务输入</div>
              <div className={styles.panelHint}>只保留 Phase 4 主链路需要的字段。</div>
            </div>

            <label className={styles.field}>
              <span className={styles.fieldLabel}>主题</span>
              <textarea
                className={styles.textarea}
                value={state.form.topic}
                onChange={(event) =>
                  dispatch({ type: 'form_changed', field: 'topic', value: event.target.value })
                }
                placeholder="例如：写一篇让人想收藏的职场复盘笔记"
              />
            </label>

            <label className={styles.field}>
              <span className={styles.fieldLabel}>目标人群</span>
              <input
                className={styles.input}
                value={state.form.targetAudience}
                onChange={(event) =>
                  dispatch({
                    type: 'form_changed',
                    field: 'targetAudience',
                    value: event.target.value,
                  })
                }
                placeholder="例如：3-5 年经验职场人"
              />
            </label>

            <label className={styles.field}>
              <span className={styles.fieldLabel}>目标效果</span>
              <input
                className={styles.input}
                value={state.form.goal}
                onChange={(event) =>
                  dispatch({ type: 'form_changed', field: 'goal', value: event.target.value })
                }
                placeholder="例如：收藏 / 评论 / 转化"
              />
            </label>

            <label className={styles.field}>
              <span className={styles.fieldLabel}>风格倾向</span>
              <input
                className={styles.input}
                value={state.form.stylePreference}
                onChange={(event) =>
                  dispatch({
                    type: 'form_changed',
                    field: 'stylePreference',
                    value: event.target.value,
                  })
                }
                placeholder="例如：专业直接、克制、有结论"
              />
            </label>

            <label className={styles.field}>
              <span className={styles.fieldLabel}>Persona Mode</span>
              <select
                className={styles.select}
                value={state.form.personaMode}
                onChange={(event) =>
                  dispatch({
                    type: 'form_changed',
                    field: 'personaMode',
                    value: event.target.value,
                  })
                }
              >
                <option value="balanced">balanced</option>
                <option value="self">self</option>
                <option value="strong_style">strong_style</option>
              </select>
            </label>

            <label className={styles.checkboxRow}>
              <input
                type="checkbox"
                checked={state.form.needCoverSuggestion}
                onChange={(event) =>
                  dispatch({
                    type: 'form_changed',
                    field: 'needCoverSuggestion',
                    value: event.target.checked,
                  })
                }
              />
              <span>需要封面建议</span>
            </label>

            <button
              className={styles.submitButton}
              type="submit"
              disabled={state.isSubmitting || !state.form.topic.trim()}
            >
              {state.isSubmitting ? '生成中...' : '生成'}
            </button>

            {state.error ? <div className={styles.errorBox}>{state.error}</div> : null}
          </form>

          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <div className={styles.panelTitle}>Agent 策略区</div>
              <div className={styles.panelHint}>展示任务理解、样本检索、策略快照和生成进度。</div>
            </div>

            <article className={styles.stepCard}>
              <div className={styles.stepHeader}>
                <div className={styles.stepTitle}>Step 1 · 任务理解</div>
                {renderPill('understanding', state.step)}
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
                <div className={styles.stepTitle}>Step 2 · 样本检索</div>
                {renderPill('searching', state.step)}
              </div>
              {state.references ? (
                <div className={styles.list}>
                  <div className={styles.kvItem}>
                    <div className={styles.kvLabel}>模式</div>
                    <div className={styles.kvValue}>{state.references.reference_mode}</div>
                  </div>
                  <div className={styles.kvItem}>
                    <div className={styles.kvLabel}>候选数量</div>
                    <div className={styles.kvValue}>{state.references.candidate_count}</div>
                  </div>
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
                    <div className={styles.emptyState}>本次任务进入 zero-shot 模式。</div>
                  )}
                </div>
              ) : (
                <div className={styles.emptyState}>等待检索结果。</div>
              )}
            </article>

            <article className={styles.stepCard}>
              <div className={styles.stepHeader}>
                <div className={styles.stepTitle}>Step 3 · 策略制定</div>
                {renderPill('strategizing', state.step)}
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
                <div className={styles.stepTitle}>Step 4 · 生成中</div>
                {renderPill(state.outputs ? 'completed' : 'generating', state.step)}
              </div>
              <div className={styles.kvItem}>
                <div className={styles.kvLabel}>状态</div>
                <div className={styles.kvValue}>
                  {state.outputs
                    ? '结构化结果已落地'
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

          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <div className={styles.panelTitle}>生成结果区</div>
              <div className={styles.panelHint}>先展示流式文本，完成后切换为结构化结果。</div>
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
              </div>
            ) : deferredGenerationText ? (
              <div className={styles.streamBox}>{deferredGenerationText}</div>
            ) : (
              <div className={styles.emptyState}>点击左侧“生成”后，这里会先出现流式文本，再切到结构化结果。</div>
            )}
          </section>
        </div>

        <section className={styles.historyGrid}>
          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <div className={styles.panelTitle}>历史任务</div>
              <div className={styles.panelHint}>复用现有生成历史 API，选中后在右侧查看完整链路。</div>
            </div>

            {state.historyError ? <div className={styles.errorBox}>{state.historyError}</div> : null}

            {state.historyTasks.length > 0 ? (
              <div className={styles.list}>
                {state.historyTasks.map((task) => {
                  const isActive = task.id === preferredHistoryTaskId;

                  return (
                    <button
                      key={task.id}
                      className={`${styles.historyTaskButton} ${isActive ? styles.historyTaskButtonActive : ''}`}
                      type="button"
                      onClick={() => handleHistorySelect(task.id)}
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
                {state.isHistoryLoading ? '正在加载历史任务…' : '还没有可查看的历史任务。'}
              </div>
            )}
          </section>

          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <div className={styles.panelTitle}>历史链路详情</div>
              <div className={styles.panelHint}>展示任务输入、参考模式、参考样本、策略、输出与反馈。</div>
            </div>

            {state.selectedHistoryDetail ? (
              <div className={styles.list}>
                <div className={styles.kvList}>
                  <div className={styles.kvItem}>
                    <div className={styles.kvLabel}>主题</div>
                    <div className={styles.kvValue}>{state.selectedHistoryDetail.task.topic}</div>
                  </div>
                  <div className={styles.kvItem}>
                    <div className={styles.kvLabel}>状态 / 参考模式</div>
                    <div className={styles.kvValue}>
                      {[state.selectedHistoryDetail.task.status, state.selectedHistoryDetail.reference_mode]
                        .filter(Boolean)
                        .join(' · ') || '未记录'}
                    </div>
                  </div>
                  <div className={styles.kvItem}>
                    <div className={styles.kvLabel}>目标人群 / 目标效果</div>
                    <div className={styles.kvValue}>
                      {[
                        readHistoryString(state.selectedHistoryDetail.task, 'target_audience'),
                        readHistoryString(state.selectedHistoryDetail.task, 'goal'),
                      ]
                        .filter(Boolean)
                        .join(' · ') || '未记录'}
                    </div>
                  </div>
                </div>

                <div className={styles.resultCard}>
                  <strong>参考样本</strong>
                  {state.selectedHistoryDetail.references.length > 0 ? (
                    state.selectedHistoryDetail.references.map((reference, index) => (
                      <div key={`${readHistoryString(reference, 'sample_id')}-${index}`}>
                        <strong>{readHistoryString(reference, 'title') || '未命名样本'}</strong>
                        <div className={styles.referenceMeta}>
                          <span>{readHistoryString(reference, 'reference_type') || 'unknown'}</span>
                          <span>{readHistoryString(reference, 'reason') || '未记录原因'}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className={styles.panelHint}>本次任务未引用样本，属于 zero-shot 或未记录场景。</div>
                  )}
                </div>

                <div className={styles.resultCard}>
                  <strong>策略摘要</strong>
                  <div className={styles.kvList}>
                    <div className={styles.kvItem}>
                      <div className={styles.kvLabel}>概览</div>
                      <div className={styles.kvValue}>
                        {readHistoryString(state.selectedHistoryDetail.strategy, 'strategy_summary') || '未记录'}
                      </div>
                    </div>
                    <div className={styles.kvItem}>
                      <div className={styles.kvLabel}>标题 / 结构 / CTA</div>
                      <div className={styles.kvValue}>
                        {[
                          readHistoryString(state.selectedHistoryDetail.strategy, 'title_strategy'),
                          readHistoryString(state.selectedHistoryDetail.strategy, 'structure_strategy'),
                          readHistoryString(state.selectedHistoryDetail.strategy, 'cta_strategy'),
                        ]
                          .filter(Boolean)
                          .join('\n') || '未记录'}
                      </div>
                    </div>
                  </div>
                </div>

                <div className={styles.resultCard}>
                  <strong>生成结果</strong>
                  {state.selectedHistoryDetail.outputs ? (
                    <div className={styles.list}>
                      <div>标题：{state.selectedHistoryDetail.outputs.titles.join(' / ') || '未记录'}</div>
                      <div>开头：{state.selectedHistoryDetail.outputs.openings.join(' / ') || '未记录'}</div>
                      <div>正文：{state.selectedHistoryDetail.outputs.body_versions[0] || '未记录'}</div>
                      <div>CTA：{state.selectedHistoryDetail.outputs.cta_versions.join(' / ') || '未记录'}</div>
                      <div>标签：{state.selectedHistoryDetail.outputs.hashtags.join(' ') || '未记录'}</div>
                      <div>首评：{state.selectedHistoryDetail.outputs.first_comment || '未记录'}</div>
                    </div>
                  ) : (
                    <div className={styles.panelHint}>当前任务还没有持久化的生成输出。</div>
                  )}
                </div>

                <div className={styles.resultCard}>
                  <strong>反馈</strong>
                  {state.selectedHistoryDetail.feedback ? (
                    <div className={styles.kvList}>
                      <div className={styles.kvItem}>
                        <div className={styles.kvLabel}>是否已发布</div>
                        <div className={styles.kvValue}>
                          {readHistoryBoolean(state.selectedHistoryDetail.feedback, 'used_in_publish') ? '已发布' : '未发布'}
                        </div>
                      </div>
                      <div className={styles.kvItem}>
                        <div className={styles.kvLabel}>主观反馈</div>
                        <div className={styles.kvValue}>
                          {readHistoryString(state.selectedHistoryDetail.feedback, 'manual_feedback') || '未填写'}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className={styles.panelHint}>当前任务还没有反馈数据。</div>
                  )}
                </div>
              </div>
            ) : (
              <div className={styles.emptyState}>
                {state.isHistoryLoading ? '正在加载历史链路…' : '从左侧选择一条历史任务查看完整链路。'}
              </div>
            )}
          </section>
        </section>
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
              <p className={styles.eyebrow}>Phase 4 Creation Studio</p>
              <h1 className={styles.title}>让策略可见，让生成可追踪。</h1>
              <p className={styles.subtitle}>正在加载创作工作台…</p>
            </header>
          </div>
        </main>
      )}
    >
      <CreatePageClient />
    </Suspense>
  );
}
