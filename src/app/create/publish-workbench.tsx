import type { HistoryTaskDetail } from './models';
import { formatImageProvider } from './view-helpers';

export type PublishWorkbenchClassName =
  | 'panel'
  | 'panelHeader'
  | 'panelTitle'
  | 'panelHint'
  | 'list'
  | 'kvList'
  | 'kvItem'
  | 'kvLabel'
  | 'kvValue'
  | 'resultCard'
  | 'referenceMeta'
  | 'versionTabs'
  | 'versionButton'
  | 'versionButtonActive'
  | 'emptyState';

export type PublishWorkbenchClasses = Record<PublishWorkbenchClassName, string>;

interface PublishWorkbenchProps {
  classes: PublishWorkbenchClasses;
  detail: HistoryTaskDetail | null;
  selectedOutputId: string | null;
  onSelectOutputVersion: (outputId: string) => void;
}

export function PublishWorkbench({
  classes,
  detail,
  selectedOutputId,
  onSelectOutputVersion,
}: PublishWorkbenchProps) {
  if (!detail || !detail.outputs) {
    return (
      <section className={classes.panel}>
        <div className={classes.panelHeader}>
          <div className={classes.panelTitle}>发布准备台</div>
          <div className={classes.panelHint}>先完成文案或图片创作，再整理发布包。</div>
        </div>
        <div className={classes.emptyState}>当前还没有可整理的文案结果。</div>
      </section>
    );
  }

  const selectedAssets = detail.latest_image_plan?.selected_assets ?? [];
  const publishReadyText = selectedAssets.length > 0 ? '文案和配图已齐备' : '当前只有文案，尚未选定配图';

  return (
    <section className={classes.panel}>
      <div className={classes.panelHeader}>
        <div className={classes.panelTitle}>发布准备台</div>
        <div className={classes.panelHint}>整理当前任务的发布包预览；真实小红书发布能力留在下一轮接入。</div>
      </div>

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
          <div className={classes.kvLabel}>当前任务</div>
          <div className={classes.kvValue}>{detail.task.topic}</div>
        </div>
        <div className={classes.kvItem}>
          <div className={classes.kvLabel}>发布准备状态</div>
          <div className={classes.kvValue}>{publishReadyText}</div>
        </div>
        <div className={classes.kvItem}>
          <div className={classes.kvLabel}>图片摘要</div>
          <div className={classes.kvValue}>
            {selectedAssets.length > 0
              ? `已选图片 ${selectedAssets.length} 张`
              : '未选图片'}
            {detail.latest_image_plan
              ? ` · ${formatImageProvider(detail.latest_image_plan.plan.provider)} · ${detail.latest_image_plan.plan.provider_model}`
              : ''}
          </div>
        </div>
      </div>

      <div className={classes.resultCard}>
        <strong>标题</strong>
        <div className={classes.kvValue}>{detail.outputs.titles.join(' / ') || '未记录'}</div>
      </div>
      <div className={classes.resultCard}>
        <strong>正文</strong>
        <div className={classes.kvValue}>{detail.outputs.body_versions[0] || '未记录'}</div>
      </div>
      <div className={classes.resultCard}>
        <strong>首评与标签</strong>
        <div className={classes.kvList}>
          <div className={classes.kvItem}>
            <div className={classes.kvLabel}>首评</div>
            <div className={classes.kvValue}>{detail.outputs.first_comment || '未记录'}</div>
          </div>
          <div className={classes.kvItem}>
            <div className={classes.kvLabel}>标签</div>
            <div className={classes.kvValue}>{detail.outputs.hashtags.join(' ') || '未记录'}</div>
          </div>
        </div>
      </div>
      <div className={classes.resultCard}>
        <strong>状态</strong>
        <div className={classes.kvValue}>小红书发布能力待接入</div>
        <div className={classes.panelHint}>这期只做发布包预览，不发起真实发布请求。</div>
      </div>
    </section>
  );
}
