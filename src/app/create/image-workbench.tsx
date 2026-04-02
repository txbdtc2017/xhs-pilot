'use client'

import type {
  HistoryTaskDetail,
  ImageConfigValues,
  ImagePlanPayload,
} from './state';

export type ImageWorkbenchClassName =
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
  | 'emptyState'
  | 'errorBox'
  | 'submitButton'
  | 'secondaryButton'
  | 'versionTabs'
  | 'versionButton'
  | 'versionButtonActive'
  | 'imagePageList'
  | 'imagePageCard'
  | 'imagePageHeader'
  | 'imagePageActions'
  | 'toggleButton'
  | 'toggleButtonActive'
  | 'assetGrid'
  | 'assetButton'
  | 'assetButtonActive'
  | 'assetImage'
  | 'assetMeta'
  | 'progressTrack'
  | 'progressFill';

export type ImageWorkbenchClasses = Record<ImageWorkbenchClassName, string>;

interface ImageWorkbenchProps {
  classes: ImageWorkbenchClasses;
  detail: HistoryTaskDetail | null;
  selectedOutputId: string | null;
  imageConfig: ImageConfigValues;
  isLoading: boolean;
  error: string | null;
  onSelectOutputVersion: (outputId: string) => void;
  onCreatePlan: () => void;
  onTogglePage: (pageId: string, isEnabled: boolean) => void;
  onRunFullJob: () => void;
  onRunPageJob: (pageId: string) => void;
  onSelectAsset: (assetId: string) => void;
}

function findAssetsForPage(plan: ImagePlanPayload, pageId: string) {
  return plan.assets.filter((asset) => asset.plan_page_id === pageId);
}

function formatImageProvider(provider: ImageConfigValues['provider']): string {
  return provider === 'google_vertex' ? 'Google Banana' : 'OpenAI-Compatible';
}

export function ImageWorkbench({
  classes,
  detail,
  selectedOutputId,
  imageConfig,
  isLoading,
  error,
  onSelectOutputVersion,
  onCreatePlan,
  onTogglePage,
  onRunFullJob,
  onRunPageJob,
  onSelectAsset,
}: ImageWorkbenchProps) {
  const selectedOutput = detail?.outputs ?? null;
  const plan = detail?.latest_image_plan ?? null;
  const activeJob = detail?.active_image_job ?? null;
  const progressRatio = activeJob && activeJob.total_units > 0
    ? Math.min(1, activeJob.completed_units / activeJob.total_units)
    : 0;

  return (
    <section className={classes.panel}>
      <div className={classes.panelHeader}>
        <div className={classes.panelTitle}>图片工作区</div>
        <div className={classes.panelHint}>先出计划，再跑整套图或单页重生；候选图会带选中状态回放。</div>
      </div>

      {detail?.output_versions.length ? (
        <div className={classes.versionTabs}>
          {detail.output_versions.map((outputVersion) => {
            const isActive = outputVersion.id === selectedOutputId;
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

      {selectedOutput ? (
        <div className={classes.kvList}>
          <div className={classes.kvItem}>
            <div className={classes.kvLabel}>当前输出版本</div>
            <div className={classes.kvValue}>
              v{selectedOutput.version ?? '1'} · {selectedOutput.model_name ?? 'unknown model'}
            </div>
          </div>
          <div className={classes.kvItem}>
            <div className={classes.kvLabel}>图片规划参数</div>
            <div className={classes.kvValue}>
              {[
                formatImageProvider(imageConfig.provider),
                imageConfig.visualDirectionOverride || '自动归纳视觉方向',
                `正文页上限 ${imageConfig.bodyPageCap}`,
                `封面候选 ${imageConfig.coverCandidateCount}`,
                `正文候选 ${imageConfig.bodyCandidateCount}`,
              ].join(' · ')}
            </div>
          </div>
        </div>
      ) : (
        <div className={classes.emptyState}>需要先选中一条已生成输出，图片工作区才会出现。</div>
      )}

      {error ? <div className={classes.errorBox}>{error}</div> : null}

      {selectedOutput ? (
        <button
          type="button"
          className={classes.submitButton}
          onClick={onCreatePlan}
          disabled={isLoading || Boolean(activeJob)}
        >
          {isLoading ? '处理中...' : plan && plan.plan.output_id === selectedOutputId ? '重算图片计划' : '生成图片计划'}
        </button>
      ) : null}

      {plan ? (
        <div className={classes.list}>
          <div className={classes.resultCard}>
            <strong>计划摘要</strong>
            <div className={classes.kvValue}>
              {plan.plan.system_decision_summary || '未返回系统摘要'}
            </div>
            <div className={classes.referenceMeta}>
              <span>{formatImageProvider(plan.plan.provider)}</span>
              <span>{plan.plan.provider_model}</span>
              <span>{plan.pages.length} 页</span>
              <span>{plan.selected_assets.length} 张已选</span>
              <span>{plan.assets.length} 张候选</span>
            </div>
          </div>

          <div className={classes.resultCard}>
            <strong>执行状态</strong>
            {activeJob ? (
              <div className={classes.list}>
                <div className={classes.kvItem}>
                  <div className={classes.kvLabel}>当前任务</div>
                  <div className={classes.kvValue}>
                    {activeJob.scope === 'full' ? '整套生成' : '单页重生'} · {activeJob.status} · {formatImageProvider(activeJob.provider)} · {activeJob.model_name}
                  </div>
                </div>
                <div className={classes.progressTrack}>
                  <div
                    className={classes.progressFill}
                    style={{ width: `${Math.round(progressRatio * 100)}%` }}
                  />
                </div>
                <div className={classes.panelHint}>
                  {activeJob.completed_units} / {activeJob.total_units} 单元
                </div>
              </div>
            ) : (
              <div className={classes.list}>
                <button
                  type="button"
                  className={classes.submitButton}
                  onClick={onRunFullJob}
                  disabled={isLoading}
                >
                  {isLoading ? '处理中...' : '生成整套图片'}
                </button>
                <div className={classes.panelHint}>单页重生在每个 page 卡片内单独触发。</div>
              </div>
            )}
          </div>

          <div className={classes.imagePageList}>
            {plan.pages.map((page) => {
              const pageAssets = findAssetsForPage(plan, page.id);
              return (
                <article key={page.id} className={classes.imagePageCard}>
                  <div className={classes.imagePageHeader}>
                    <div>
                      <strong>
                        {page.page_role === 'cover' ? '封面' : `正文页 ${page.sort_order}`}
                      </strong>
                      <div className={classes.panelHint}>{page.content_purpose}</div>
                    </div>
                    <div className={classes.imagePageActions}>
                      <button
                        type="button"
                        className={`${classes.toggleButton} ${page.is_enabled ? classes.toggleButtonActive : ''}`}
                        onClick={() => onTogglePage(page.id, !page.is_enabled)}
                        disabled={isLoading || Boolean(activeJob)}
                      >
                        {page.is_enabled ? '已启用' : '已停用'}
                      </button>
                      <button
                        type="button"
                        className={classes.secondaryButton}
                        onClick={() => onRunPageJob(page.id)}
                        disabled={isLoading || Boolean(activeJob)}
                      >
                        单页重生
                      </button>
                    </div>
                  </div>

                  <div className={classes.kvList}>
                    <div className={classes.kvItem}>
                      <div className={classes.kvLabel}>提示摘要</div>
                      <div className={classes.kvValue}>{page.prompt_summary}</div>
                    </div>
                    <div className={classes.kvItem}>
                      <div className={classes.kvLabel}>来源摘录</div>
                      <div className={classes.kvValue}>{page.source_excerpt}</div>
                    </div>
                  </div>

                  {pageAssets.length > 0 ? (
                    <div className={classes.assetGrid}>
                      {pageAssets.map((asset) => (
                        <button
                          key={asset.id}
                          type="button"
                          className={`${classes.assetButton} ${asset.is_selected ? classes.assetButtonActive : ''}`}
                          onClick={() => onSelectAsset(asset.id)}
                          disabled={isLoading}
                        >
                          {asset.image_url ? (
                            <div
                              aria-label={`候选图 ${asset.candidate_index + 1}`}
                              className={classes.assetImage}
                              role="img"
                              style={{ backgroundImage: `url(${asset.image_url})` }}
                            />
                          ) : null}
                          <span className={classes.assetMeta}>
                            候选 {asset.candidate_index + 1} · {asset.is_selected ? '当前选中' : '点击选中'}
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className={classes.emptyState}>这一页还没有生成候选图。</div>
                  )}
                </article>
              );
            })}
          </div>
        </div>
      ) : null}
    </section>
  );
}
