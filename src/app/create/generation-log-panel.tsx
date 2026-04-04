'use client'

import type { CreateStep, GenerationLogEntry } from './state';

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
  currentStep: CreateStep;
  isSubmitting: boolean;
  submitStartedAt: string | null;
  currentStepStartedAt: string | null;
  lastServerEventAt: string | null;
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
  currentStep,
  isSubmitting,
  submitStartedAt,
  currentStepStartedAt,
  lastServerEventAt,
  clockNow,
  streamClosedUnexpectedly,
  logs,
  onToggle,
}: GenerationLogPanelProps) {
  const summaryText = isSubmitting
    ? '生成进行中'
    : currentStep === 'failed'
      ? '任务失败'
      : currentStep === 'completed'
        ? '任务完成'
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
              <div className={classes.logMetaLabel}>当前阶段</div>
              <div className={classes.logMetaValue}>{currentStep}</div>
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
              <div className={classes.logMetaLabel}>距上次服务端事件</div>
              <div className={classes.logMetaValue}>{formatDuration(lastServerEventAt, clockNow)}</div>
            </div>
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
