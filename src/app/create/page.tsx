'use client'

import { startTransition, useDeferredValue, useReducer } from 'react';
import { createSseParser } from '@/lib/sse';
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

export default function CreatePage() {
  const [state, dispatch] = useReducer(createPageReducer, undefined, createInitialCreateState);
  const deferredGenerationText = useDeferredValue(state.generationText);

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
      </div>
    </main>
  );
}
