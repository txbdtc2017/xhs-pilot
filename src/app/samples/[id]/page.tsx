import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SampleEditForm } from '@/components/sample-edit-form';
import { StatusBadge } from '@/components/status-badge';
import { getSampleDetail } from '@/lib/samples';

export const dynamic = 'force-dynamic';

type SampleDetailPageProps = {
  params: Promise<{ id: string }>;
};

function readString(record: Record<string, unknown>, key: string): string {
  return typeof record[key] === 'string' ? (record[key] as string) : '';
}

function readBoolean(record: Record<string, unknown>, key: string): boolean {
  return record[key] === true;
}

function readStringArray(record: Record<string, unknown> | null, key: string): string[] {
  if (!record) {
    return [];
  }

  const value = record[key];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

export default async function SampleDetailPage({ params }: SampleDetailPageProps) {
  const { id } = await params;
  const detail = await getSampleDetail(id);

  if (!detail) {
    notFound();
  }

  const sample = detail.sample;
  const analysis = detail.analysis;
  const visual = detail.visualAnalysis;
  const bodyText = readString(sample, 'body_text');
  const sourceUrl = readString(sample, 'source_url');
  const manualNotes = readString(sample, 'manual_notes');
  const manualTags = readStringArray(sample, 'manual_tags');
  const titlePatternTags = readStringArray(analysis, 'title_pattern_tags');
  const openingPatternTags = readStringArray(analysis, 'opening_pattern_tags');
  const structurePatternTags = readStringArray(analysis, 'structure_pattern_tags');
  const trustSignalTags = readStringArray(analysis, 'trust_signal_tags');
  const ctaTypeTags = readStringArray(analysis, 'cta_type_tags');
  const replicableRules = readStringArray(analysis, 'replicable_rules');
  const avoidPoints = readStringArray(analysis, 'avoid_points');

  return (
    <div className="pageShell">
      <header className="pageHeader">
        <Link className="buttonGhost" href="/samples">
          返回样本库
        </Link>
        <p className="eyebrow">Sample Detail</p>
        <h1 className="pageTitle">{readString(sample, 'title')}</h1>
        <div className="inlineMeta">
          <StatusBadge status={readString(sample, 'status')} />
          {readBoolean(sample, 'is_high_value') ? <span className="badge badgeWarning">高价值</span> : null}
          {!readBoolean(sample, 'is_reference_allowed') ? (
            <span className="badge badgeNeutral">禁止引用</span>
          ) : null}
        </div>
      </header>

      <section className="contentColumns">
        <article className="sectionCard">
          <div className="panelHeading">
            <div>
              <p className="eyebrow">A. Original Content</p>
              <h2 className="panelTitle">原始内容</h2>
            </div>
          </div>

          <div className="stackMd">
            {sourceUrl ? (
              <p className="mutedText">
                来源链接：
                <a href={sourceUrl} rel="noreferrer" target="_blank">
                  {sourceUrl}
                </a>
              </p>
            ) : null}
            <div className="richText">{bodyText || '没有正文内容。'}</div>

            <div className="imageGrid">
              {detail.images.length > 0 ? (
                detail.images.map((image) => (
                  <figure className="imageFrame" key={String(image.id)}>
                    <img alt={readString(sample, 'title')} src={readString(image, 'image_url')} />
                    <figcaption className="mutedText">
                      {readString(image, 'image_type') || 'image'}
                    </figcaption>
                  </figure>
                ))
              ) : (
                <div className="emptyCard">该样本没有图片。</div>
              )}
            </div>
          </div>
        </article>

        <article className="sectionCard">
          <div className="panelHeading">
            <div>
              <p className="eyebrow">B. Parsed Signals</p>
              <h2 className="panelTitle">解析结果</h2>
            </div>
          </div>

          <div className="stackMd">
            <div className="chipList">
              {titlePatternTags.map((tag) => (
                <span className="chip" key={tag}>
                  标题 · {tag}
                </span>
              ))}
              {openingPatternTags.map((tag) => (
                <span className="chip" key={tag}>
                  开头 · {tag}
                </span>
              ))}
              {structurePatternTags.map((tag) => (
                <span className="chip" key={tag}>
                  结构 · {tag}
                </span>
              ))}
              {trustSignalTags.map((tag) => (
                <span className="chip" key={tag}>
                  信任 · {tag}
                </span>
              ))}
              {ctaTypeTags.map((tag) => (
                <span className="chip" key={tag}>
                  CTA · {tag}
                </span>
              ))}
              {readString(visual ?? {}, 'cover_style_tag') ? (
                <span className="chip">封面 · {readString(visual ?? {}, 'cover_style_tag')}</span>
              ) : null}
            </div>

            <div className="infoGrid">
              <div className="infoCard">
                <h3>OCR 文本</h3>
                <p>{readString(visual ?? {}, 'extracted_text') || '暂无 OCR 文本。'}</p>
              </div>
              <div className="infoCard">
                <h3>赛道 / 内容类型</h3>
                <p>
                  {[readString(analysis ?? {}, 'track'), readString(analysis ?? {}, 'content_type')]
                    .filter(Boolean)
                    .join(' · ') || '待分析'}
                </p>
              </div>
            </div>
          </div>
        </article>
      </section>

      <section className="contentColumns">
        <article className="sectionCard">
          <div className="panelHeading">
            <div>
              <p className="eyebrow">C. Cognitive Analysis</p>
              <h2 className="panelTitle">认知结果</h2>
            </div>
          </div>

          <div className="infoGrid">
            <div className="infoCard">
              <h3>标题策略</h3>
              <p>{readString(analysis ?? {}, 'title_pattern_explanation') || '暂无。'}</p>
            </div>
            <div className="infoCard">
              <h3>开头策略</h3>
              <p>{readString(analysis ?? {}, 'opening_explanation') || '暂无。'}</p>
            </div>
            <div className="infoCard">
              <h3>主体结构</h3>
              <p>{readString(analysis ?? {}, 'structure_explanation') || '暂无。'}</p>
            </div>
            <div className="infoCard">
              <h3>封面风格</h3>
              <p>{readString(visual ?? {}, 'cover_explanation') || '暂无。'}</p>
            </div>
            <div className="infoCard">
              <h3>综合判断</h3>
              <p>{readString(analysis ?? {}, 'reasoning_summary') || '暂无。'}</p>
            </div>
            <div className="infoCard">
              <h3>情绪强度</h3>
              <p>{String(analysis?.emotion_level ?? '未提供')}</p>
            </div>
          </div>

          <div className="twoColumnGrid compactGrid">
            <div className="sectionCard insetCard">
              <h3 className="panelTitle">可复用规则</h3>
              <div className="chipList">
                {replicableRules.length > 0 ? (
                  replicableRules.map((rule) => <span className="chip" key={rule}>{rule}</span>)
                ) : (
                  <span className="mutedText">暂无。</span>
                )}
              </div>
            </div>
            <div className="sectionCard insetCard">
              <h3 className="panelTitle">不建议模仿点</h3>
              <div className="chipList">
                {avoidPoints.length > 0 ? (
                  avoidPoints.map((point) => <span className="chip chipMuted" key={point}>{point}</span>)
                ) : (
                  <span className="mutedText">暂无。</span>
                )}
              </div>
            </div>
          </div>
        </article>

        <article className="sectionCard">
          <div className="panelHeading">
            <div>
              <p className="eyebrow">D. Relationship Network</p>
              <h2 className="panelTitle">关系网络</h2>
            </div>
          </div>

          <div className="stackMd">
            <div className="infoCard">
              <h3>相似样本</h3>
              <div className="listStack">
                {detail.related_samples.length > 0 ? (
                  detail.related_samples.map((relatedSample) => (
                    <Link className="listRow linkRow" href={`/samples/${relatedSample.id}`} key={relatedSample.id}>
                      <div>
                        <strong>{relatedSample.title}</strong>
                        <p className="mutedText">
                          {[relatedSample.track, relatedSample.content_type].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                      <span className="badge badgeInfo">
                        相似度 {relatedSample.similarity.toFixed(2)}
                      </span>
                    </Link>
                  ))
                ) : (
                  <div className="emptyCard">暂无相似样本。</div>
                )}
              </div>
            </div>

            <div className="infoCard">
              <h3>被哪些任务引用过</h3>
              <div className="listStack">
                {detail.referenced_by_tasks.length > 0 ? (
                  detail.referenced_by_tasks.map((task) => (
                    <div className="listRow" key={`${task.task_id}-${task.reference_type}`}>
                      <div>
                        <strong>{task.topic}</strong>
                        <p className="mutedText">
                          {task.reference_type}
                          {task.reason ? ` · ${task.reason}` : ''}
                        </p>
                      </div>
                      <StatusBadge status={task.status} />
                    </div>
                  ))
                ) : (
                  <div className="emptyCard">还没有生成任务引用它。</div>
                )}
              </div>
            </div>

            <div className="infoCard">
              <h3>所属风格画像</h3>
              <div className="listStack">
                {detail.style_profiles.length > 0 ? (
                  detail.style_profiles.map((profile) => (
                    <Link className="listRow linkRow" href={`/styles/${profile.id}`} key={profile.id}>
                      <div>
                        <strong>{profile.name}</strong>
                        <p className="mutedText">{profile.description || '暂无描述'}</p>
                      </div>
                    </Link>
                  ))
                ) : (
                  <div className="emptyCard">还未加入任何画像。</div>
                )}
              </div>
            </div>
          </div>
        </article>
      </section>

      <section className="sectionCard">
        <div className="panelHeading">
          <div>
            <p className="eyebrow">E. Manual Correction</p>
            <h2 className="panelTitle">人工修正</h2>
          </div>
        </div>

        <SampleEditForm
          initialIsHighValue={readBoolean(sample, 'is_high_value')}
          initialIsReferenceAllowed={readBoolean(sample, 'is_reference_allowed')}
          initialManualNotes={manualNotes}
          initialManualTags={manualTags}
          sampleId={id}
        />
      </section>
    </div>
  );
}
