'use client'

import type { CreateLifecycleState, CreateStep, GenerationLogEntry, TaskRuntimePayload } from './state';

export type GenerationLogPanelClassName =
  | 'panel'
  | 'panelHeader'
  | 'panelTitle'
  | 'panelHint'
  | 'logPanel'
  | 'logSummary'
  | 'logSummaryMeta'
  | 'logToggle'
  | 'logMetaGrid'
  | 'logMetaCard'
  | 'logMetaLabel'
  | 'logMetaValue'
  | 'logTimeline'
  | 'logRow'
  | 'logRowServer'
  | 'logRowClient'
  | 'logRowSystem'
  | 'logRowHeader'
  | 'logSource'
  | 'logEvent'
  | 'logTimestamp'
  | 'logMessage'
  | 'emptyState';

export type GenerationLogPanelClasses = Record<GenerationLogPanelClassName, string>;

interface GenerationLogPanelProps {
  classes: GenerationLogPanelClasses;
  isExpanded: boolean;
  taskId: string | null;
  lifecycleState: CreateLifecycleState;
  currentStep: CreateStep;
  runtime: TaskRuntimePayload | null;
  isSubmitting: boolean;
  submitStartedAt: string | null;
  currentStepStartedAt: string | null;
  clockNow: string | null;
  streamClosedUnexpectedly: boolean;
  logs: GenerationLogEntry[];
  onToggle: () => void;
}

function formatDuration(from: string | null, to: string | null): string {
  if (!from || !to) {
    return '未开始';
  }

  const deltaMs = Date.parse(to) - Date.parse(from);
  if (!Number.isFinite(deltaMs) || deltaMs < 0) {
    return '未开始';
  }

  return `${Math.floor(deltaMs / 1000)}s`;
}

function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleTimeString('zh-CN', {
    hour12: false,
  });
}

function sourceLabel(source: GenerationLogEntry['source']): string {
  switch (source) {
    case 'client':
      return '客户端';
    case 'server':
      return '服务端';
    case 'system':
      return '系统';
  }
}

export function GenerationLogPanel({
  classes,
  isExpanded,
  taskId,
  lifecycleState,
  currentStep,
  runtime,
  isSubmitting,
  submitStartedAt,
  currentStepStartedAt,
  clockNow,
  streamClosedUnexpectedly,
  logs,
  onToggle,
}: GenerationLogPanelProps) {
  const summaryText = lifecycleState === 'stalled'
    ? '任务 stalled'
    : lifecycleState === 'failed' || currentStep === 'failed'
      ? '任务失败'
      : lifecycleState === 'completed' || currentStep === 'completed'
        ? '任务完成'
        : lifecycleState === 'queued'
          ? '等待执行'
          : isSubmitting
            ? '生成进行中'
            : streamClosedUnexpectedly
              ? '流异常结束'
              : '等待新任务';

  return (
    <section className={`${classes.panel} ${classes.logPanel}`}>
      <div className={classes.panelHeader}>
        <div>
          <div className={classes.panelTitle}>运行日志</div>
          <div className={classes.panelHint}>把当前阶段、最近事件和时间线摊开，方便判断是等待、失败还是流已断开。</div>
        </div>
        <button className={classes.logToggle} type="button" onClick={onToggle}>
          {isExpanded ? '收起' : '展开'}
        </button>
      </div>

      <div className={classes.logSummary}>
        <div className={classes.logSummaryMeta}>
          {summaryText}
        </div>
      </div>

      {isExpanded ? (
        <>
          <div className={classes.logMetaGrid}>
            <div className={classes.logMetaCard}>
              <div className={classes.logMetaLabel}>Task ID</div>
              <div className={classes.logMetaValue}>{taskId ?? '尚未返回'}</div>
            </div>
            <div className={classes.logMetaCard}>
              <div className={classes.logMetaLabel}>生命周期</div>
              <div className={classes.logMetaValue}>{lifecycleState}</div>
            </div>
            <div className={classes.logMetaCard}>
              <div className={classes.logMetaLabel}>当前阶段</div>
              <div className={classes.logMetaValue}>{runtime?.current_step ?? currentStep}</div>
            </div>
            <div className={classes.logMetaCard}>
              <div className={classes.logMetaLabel}>当前阶段耗时</div>
              <div className={classes.logMetaValue}>{formatDuration(currentStepStartedAt, clockNow)}</div>
            </div>
            <div className={classes.logMetaCard}>
              <div className={classes.logMetaLabel}>本次任务耗时</div>
              <div className={classes.logMetaValue}>{formatDuration(submitStartedAt, clockNow)}</div>
            </div>
            <div className={classes.logMetaCard}>
              <div className={classes.logMetaLabel}>距上次业务进展</div>
              <div className={classes.logMetaValue}>{formatDuration(runtime?.last_progress_at ?? null, clockNow)}</div>
            </div>
            <div className={classes.logMetaCard}>
              <div className={classes.logMetaLabel}>距上次心跳</div>
              <div className={classes.logMetaValue}>{formatDuration(runtime?.last_heartbeat_at ?? null, clockNow)}</div>
            </div>
            {runtime?.stalled_reason || runtime?.failure_reason ? (
              <div className={classes.logMetaCard}>
                <div className={classes.logMetaLabel}>诊断</div>
                <div className={classes.logMetaValue}>{runtime.failure_reason ?? runtime.stalled_reason}</div>
              </div>
            ) : null}
            {runtime?.started_at ? (
              <div className={classes.logMetaCard}>
                <div className={classes.logMetaLabel}>启动时间</div>
                <div className={classes.logMetaValue}>{formatTimestamp(runtime.started_at)}</div>
              </div>
            ) : null}
            {runtime?.last_progress_at ? (
              <div className={classes.logMetaCard}>
                <div className={classes.logMetaLabel}>最近进展</div>
                <div className={classes.logMetaValue}>{formatTimestamp(runtime.last_progress_at)}</div>
              </div>
            ) : null}
            {runtime?.last_heartbeat_at ? (
              <div className={classes.logMetaCard}>
                <div className={classes.logMetaLabel}>最近心跳</div>
                <div className={classes.logMetaValue}>{formatTimestamp(runtime.last_heartbeat_at)}</div>
              </div>
            ) : null}
            {runtime?.failed_at ? (
              <div className={classes.logMetaCard}>
                <div className={classes.logMetaLabel}>失败时间</div>
                <div className={classes.logMetaValue}>{formatTimestamp(runtime.failed_at)}</div>
              </div>
            ) : null}
            {runtime?.stalled_at ? (
              <div className={classes.logMetaCard}>
                <div className={classes.logMetaLabel}>进入 stalled</div>
                <div className={classes.logMetaValue}>{formatTimestamp(runtime.stalled_at)}</div>
              </div>
            ) : null}
            {streamClosedUnexpectedly ? (
              <div className={classes.logMetaCard}>
                <div className={classes.logMetaLabel}>连接状态</div>
                <div className={classes.logMetaValue}>流异常结束</div>
              </div>
            ) : null}
          </div>

          {logs.length > 0 ? (
            <div className={classes.logTimeline}>
              {logs.map((entry) => (
                <article
                  key={entry.id}
                  className={`${classes.logRow} ${
                    entry.source === 'server'
                      ? classes.logRowServer
                      : entry.source === 'client'
                        ? classes.logRowClient
                        : classes.logRowSystem
                  }`}
                >
                  <div className={classes.logRowHeader}>
                    <span className={classes.logSource}>{sourceLabel(entry.source)}</span>
                    <span className={classes.logEvent}>{entry.event}</span>
                    <time className={classes.logTimestamp}>{formatTimestamp(entry.at)}</time>
                  </div>
                  <div className={classes.logMessage}>{entry.message}</div>
                </article>
              ))}
            </div>
          ) : (
            <div className={classes.emptyState}>提交生成后，这里会展示客户端动作和服务端返回的详细时间线。</div>
          )}
        </>
      ) : null}
    </section>
  );
}
