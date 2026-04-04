import type { HistoryTaskDetail } from './models';
import {
  formatHistoryDate,
  formatImageProvider,
  readHistoryBoolean,
  readHistoryString,
} from './view-helpers';

export type HistoryDetailViewClassName =
  | 'list'
  | 'kvList'
  | 'kvItem'
  | 'kvLabel'
  | 'kvValue'
  | 'panelHint'
  | 'resultCard'
  | 'referenceMeta'
  | 'versionTabs'
  | 'versionButton'
  | 'versionButtonActive'
  | 'emptyState';

export type HistoryDetailViewClasses = Record<HistoryDetailViewClassName, string>;

interface HistoryDetailViewProps {
  classes: HistoryDetailViewClasses;
  detail: HistoryTaskDetail | null;
  selectedOutputId: string | null;
  onSelectOutputVersion: (outputId: string) => void;
}

export function HistoryDetailView({
  classes,
  detail,
  selectedOutputId,
  onSelectOutputVersion,
}: HistoryDetailViewProps) {
  if (!detail) {
    return <div className={classes.emptyState}>从左侧选择一条历史任务查看完整链路。</div>;
  }

  return (
    <div className={classes.list}>
      {detail.output_versions.length > 0 ? (
        <div className={classes.versionTabs}>
          {detail.output_versions.map((outputVersion) => {
            const isActive = outputVersion.id === (selectedOutputId ?? detail.selected_output_id);
            return (
              <button
                key={outputVersion.id}
                type="button"
                className={`${classes.versionButton} ${isActive ? classes.versionButtonActive : ''}`}
                onClick={() => onSelectOutputVersion(outputVersion.id)}
              >
                v{outputVersion.version}
              </button>
            );
          })}
        </div>
      ) : null}

      <div className={classes.kvList}>
        <div className={classes.kvItem}>
          <div className={classes.kvLabel}>主题</div>
          <div className={classes.kvValue}>{detail.task.topic}</div>
        </div>
        <div className={classes.kvItem}>
          <div className={classes.kvLabel}>状态 / 参考模式</div>
          <div className={classes.kvValue}>
            {[detail.task.status, detail.reference_mode].filter(Boolean).join(' · ') || '未记录'}
          </div>
        </div>
        <div className={classes.kvItem}>
          <div className={classes.kvLabel}>当前阶段 / 最近进展</div>
          <div className={classes.kvValue}>
            {[
              detail.runtime.current_step ?? '未记录阶段',
              formatHistoryDate(detail.runtime.last_progress_at),
            ].join(' · ')}
          </div>
        </div>
        <div className={classes.kvItem}>
          <div className={classes.kvLabel}>最近心跳 / 异常原因</div>
          <div className={classes.kvValue}>
            {[
              formatHistoryDate(detail.runtime.last_heartbeat_at),
              detail.runtime.failure_reason ?? detail.runtime.stalled_reason ?? '未记录',
            ].join(' · ')}
          </div>
        </div>
        <div className={classes.kvItem}>
          <div className={classes.kvLabel}>目标人群 / 目标效果</div>
          <div className={classes.kvValue}>
            {[
              readHistoryString(detail.task, 'target_audience'),
              readHistoryString(detail.task, 'goal'),
            ]
              .filter(Boolean)
              .join(' · ') || '未记录'}
          </div>
        </div>
      </div>

      <div className={classes.resultCard}>
        <strong>参考样本</strong>
        {detail.references.length > 0 ? (
          detail.references.map((reference, index) => (
            <div key={`${readHistoryString(reference, 'sample_id')}-${index}`}>
              <strong>{readHistoryString(reference, 'title') || '未命名样本'}</strong>
              <div className={classes.referenceMeta}>
                <span>{readHistoryString(reference, 'reference_type') || 'unknown'}</span>
                <span>{readHistoryString(reference, 'reason') || '未记录原因'}</span>
              </div>
            </div>
          ))
        ) : (
          <div className={classes.panelHint}>本次任务未引用样本，属于 zero-shot 或未记录场景。</div>
        )}
      </div>

      <div className={classes.resultCard}>
        <strong>策略摘要</strong>
        <div className={classes.kvList}>
          <div className={classes.kvItem}>
            <div className={classes.kvLabel}>概览</div>
            <div className={classes.kvValue}>
              {readHistoryString(detail.strategy, 'strategy_summary') || '未记录'}
            </div>
          </div>
          <div className={classes.kvItem}>
            <div className={classes.kvLabel}>标题 / 结构 / CTA</div>
            <div className={classes.kvValue}>
              {[
                readHistoryString(detail.strategy, 'title_strategy'),
                readHistoryString(detail.strategy, 'structure_strategy'),
                readHistoryString(detail.strategy, 'cta_strategy'),
              ]
                .filter(Boolean)
                .join('\n') || '未记录'}
            </div>
          </div>
        </div>
      </div>

      <div className={classes.resultCard}>
        <strong>生成结果</strong>
        {detail.outputs ? (
          <div className={classes.list}>
            <div>标题：{detail.outputs.titles.join(' / ') || '未记录'}</div>
            <div>开头：{detail.outputs.openings.join(' / ') || '未记录'}</div>
            <div>正文：{detail.outputs.body_versions[0] || '未记录'}</div>
            <div>CTA：{detail.outputs.cta_versions.join(' / ') || '未记录'}</div>
            <div>标签：{detail.outputs.hashtags.join(' ') || '未记录'}</div>
            <div>首评：{detail.outputs.first_comment || '未记录'}</div>
          </div>
        ) : (
          <div className={classes.panelHint}>当前任务还没有持久化的生成输出。</div>
        )}
      </div>

      <div className={classes.resultCard}>
        <strong>图片结果摘要</strong>
        {detail.latest_image_plan ? (
          <div className={classes.kvList}>
            <div className={classes.kvItem}>
              <div className={classes.kvLabel}>Provider / Model</div>
              <div className={classes.kvValue}>
                {formatImageProvider(detail.latest_image_plan.plan.provider)} · {detail.latest_image_plan.plan.provider_model}
              </div>
            </div>
            <div className={classes.kvItem}>
              <div className={classes.kvLabel}>计划摘要</div>
              <div className={classes.kvValue}>
                {detail.latest_image_plan.plan.system_decision_summary || '未记录'}
              </div>
            </div>
            <div className={classes.kvItem}>
              <div className={classes.kvLabel}>已选图片</div>
              <div className={classes.kvValue}>
                已选 {detail.latest_image_plan.selected_assets.length} 张 · 候选 {detail.latest_image_plan.assets.length} 张
              </div>
            </div>
          </div>
        ) : (
          <div className={classes.panelHint}>当前任务还没有图片规划或选图结果。</div>
        )}
      </div>

      <div className={classes.resultCard}>
        <strong>反馈</strong>
        {detail.feedback ? (
          <div className={classes.kvList}>
            <div className={classes.kvItem}>
              <div className={classes.kvLabel}>是否已发布</div>
              <div className={classes.kvValue}>
                {readHistoryBoolean(detail.feedback, 'used_in_publish') ? '已发布' : '未发布'}
              </div>
            </div>
            <div className={classes.kvItem}>
              <div className={classes.kvLabel}>主观反馈</div>
              <div className={classes.kvValue}>
                {readHistoryString(detail.feedback, 'manual_feedback') || '未填写'}
              </div>
            </div>
          </div>
        ) : (
          <div className={classes.panelHint}>当前任务还没有反馈数据。</div>
        )}
      </div>
    </div>
  );
}
