import Link from 'next/link';
import { SampleIngestDrawer } from '@/components/sample-ingest-drawer';
import { StatusBadge } from '@/components/status-badge';
import { getSampleFilterOptions, listSamples } from '@/lib/samples';

export const dynamic = 'force-dynamic';

type SamplesPageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

function readParam(
  query: { [key: string]: string | string[] | undefined },
  key: string,
): string | undefined {
  const value = query[key];
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

function createSamplesHref(
  currentQuery: { [key: string]: string | string[] | undefined },
  overrides: Record<string, string | number | undefined>,
) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(currentQuery)) {
    if (typeof value === 'string' && value.length > 0) {
      params.set(key, value);
    }
  }

  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined || value === '') {
      params.delete(key);
    } else {
      params.set(key, String(value));
    }
  }

  const queryString = params.toString();
  return queryString ? `/samples?${queryString}` : '/samples';
}

export default async function SamplesPage({ searchParams }: SamplesPageProps) {
  const query = await searchParams;
  const currentPage = Math.max(parseInt(readParam(query, 'page') || '1', 10), 1);
  const limit = 12;
  const search = readParam(query, 'search') || '';
  const track = readParam(query, 'track') || '';
  const contentType = readParam(query, 'content_type') || '';
  const coverStyle = readParam(query, 'cover_style') || '';
  const isHighValue = readParam(query, 'is_high_value') || '';
  const dateFrom = readParam(query, 'date_from') || '';
  const dateTo = readParam(query, 'date_to') || '';

  const [result, options] = await Promise.all([
    listSamples({
      search: search || undefined,
      track: track || undefined,
      contentType: contentType || undefined,
      coverStyle: coverStyle || undefined,
      isHighValue:
        isHighValue === 'true' ? true : isHighValue === 'false' ? false : undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      page: currentPage,
      limit,
    }),
    getSampleFilterOptions(),
  ]);

  const totalPages = Math.max(1, Math.ceil(result.total / limit));

  return (
    <div className="pageShell">
      <header className="pageHeader">
        <p className="eyebrow">Samples</p>
        <h1 className="pageTitle">把样本真正喂进系统，再把结果看明白。</h1>
        <p className="pageSubtitle">
          样本库页同时承担录入、筛选、管理三件事。新样本进入后会自动走分析队列，并在这里持续呈现状态与引用价值。
        </p>
      </header>

      <section className="sectionCard">
        <div className="toolbarRow">
          <form className="filterGrid" method="GET">
            <label className="fieldStack">
              <span className="fieldLabel">关键词</span>
              <input className="formInput" defaultValue={search} name="search" />
            </label>

            <label className="fieldStack">
              <span className="fieldLabel">赛道</span>
              <select className="formSelect" defaultValue={track} name="track">
                <option value="">全部</option>
                {options.tracks.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            <label className="fieldStack">
              <span className="fieldLabel">内容类型</span>
              <select className="formSelect" defaultValue={contentType} name="content_type">
                <option value="">全部</option>
                {options.contentTypes.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            <label className="fieldStack">
              <span className="fieldLabel">封面风格</span>
              <select className="formSelect" defaultValue={coverStyle} name="cover_style">
                <option value="">全部</option>
                {options.coverStyles.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            <label className="fieldStack">
              <span className="fieldLabel">高价值</span>
              <select className="formSelect" defaultValue={isHighValue} name="is_high_value">
                <option value="">全部</option>
                <option value="true">仅高价值</option>
                <option value="false">仅普通</option>
              </select>
            </label>

            <label className="fieldStack">
              <span className="fieldLabel">开始日期</span>
              <input className="formInput" defaultValue={dateFrom} name="date_from" type="date" />
            </label>

            <label className="fieldStack">
              <span className="fieldLabel">结束日期</span>
              <input className="formInput" defaultValue={dateTo} name="date_to" type="date" />
            </label>

            <div className="inlineActions">
              <button className="buttonSecondary" type="submit">
                应用筛选
              </button>
              <Link className="buttonGhost" href="/samples">
                重置
              </Link>
            </div>
          </form>

          <SampleIngestDrawer />
        </div>
      </section>

      <section className="sampleCardGrid">
        {result.samples.length > 0 ? (
          result.samples.map((sample) => (
            <Link className="sampleCard" href={`/samples/${sample.id}`} key={sample.id}>
              <div className="mediaThumb">
                {sample.cover_url ? (
                  <img alt={sample.title} src={sample.cover_url} />
                ) : (
                  <div className="mediaThumbPlaceholder">No Cover</div>
                )}
              </div>

              <div className="sampleCardBody">
                <div className="inlineMeta">
                  <StatusBadge status={sample.status} />
                  {sample.is_high_value ? <span className="badge badgeWarning">高价值</span> : null}
                </div>

                <h2>{sample.title}</h2>

                <div className="chipList">
                  {sample.track ? <span className="chip">{sample.track}</span> : null}
                  {sample.content_type ? <span className="chip">{sample.content_type}</span> : null}
                  {sample.cover_style_tag ? <span className="chip">{sample.cover_style_tag}</span> : null}
                </div>

                <div className="sampleCardMeta">
                  <span>被引用 {sample.reference_count} 次</span>
                  <span>{new Date(sample.created_at).toLocaleDateString('zh-CN')}</span>
                </div>
              </div>
            </Link>
          ))
        ) : (
          <div className="emptyCard">
            当前筛选条件下没有样本。你可以先调整筛选，或者直接录入一条新样本。
          </div>
        )}
      </section>

      <div className="paginationBar">
        <span className="mutedText">
          第 {currentPage} / {totalPages} 页，共 {result.total} 条
        </span>

        <div className="inlineActions">
          <Link
            aria-disabled={currentPage <= 1}
            className={`buttonGhost ${currentPage <= 1 ? 'buttonDisabled' : ''}`}
            href={createSamplesHref(query, { page: currentPage - 1 })}
          >
            上一页
          </Link>
          <Link
            aria-disabled={currentPage >= totalPages}
            className={`buttonGhost ${currentPage >= totalPages ? 'buttonDisabled' : ''}`}
            href={createSamplesHref(query, { page: currentPage + 1 })}
          >
            下一页
          </Link>
        </div>
      </div>
    </div>
  );
}
