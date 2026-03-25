import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { SampleIngestDrawer } from '@/components/sample-ingest-drawer';
import { SampleTrashActions } from '@/components/sample-trash-actions';
import { SampleStatusAutoRefresh } from '@/components/sample-status-auto-refresh';
import { StatusBadge } from '@/components/status-badge';
import { hasActiveSampleStatuses } from '@/lib/sample-status';
import {
  getSampleFilterOptions,
  listSamples,
  normalizeSampleListView,
  type SampleFilterOptions,
  type SampleListItem,
  type SampleListView,
} from '@/lib/samples';

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

type SamplesPageContentProps = {
  query: { [key: string]: string | string[] | undefined };
  currentPage: number;
  totalPages: number;
  filters: {
    view: SampleListView;
    search: string;
    track: string;
    contentType: string;
    coverStyle: string;
    isHighValue: string;
    dateFrom: string;
    dateTo: string;
  };
  options: SampleFilterOptions;
  result: {
    samples: SampleListItem[];
    total: number;
  };
  hasActiveSamples: boolean;
  ingestControl?: ReactNode;
  statusRefreshControl?: ReactNode;
};

export function SamplesPageContent({
  query,
  currentPage,
  totalPages,
  filters,
  options,
  result,
  hasActiveSamples,
  ingestControl,
  statusRefreshControl,
}: SamplesPageContentProps) {
  const isTrashView = filters.view === 'trash';
  const activeHref = createSamplesHref(query, { view: 'active', page: 1 });
  const trashHref = createSamplesHref(query, { view: 'trash', page: 1 });

  return (
    <div className="pageShell">
      {statusRefreshControl === undefined ? (
        <SampleStatusAutoRefresh isActive={!isTrashView && hasActiveSamples} />
      ) : statusRefreshControl}
      <header className="pageHeader">
        <p className="eyebrow">内容档案库</p>
        <h1 className="pageTitle">
          {isTrashView
            ? '回收站里的样本仍是你的资产，只是暂时退出主档案。'
            : '把样本沉淀成可检索、可归类、可再创作的内容档案。'}
        </h1>
        <p className="pageSubtitle">
          {isTrashView
            ? '这里仅显示已移入回收站的样本。恢复后会回到主档案；彻底删除会同步清理记录与关联图片。'
            : '先通过筛选把样本缩到合适范围，再根据状态、标签和被引用价值决定哪些内容值得继续沉淀。'}
        </p>
      </header>

      <section className="sectionCard">
        <div className="stackMd">
          <div className="viewToggle">
            <Link
              className={`buttonGhost ${!isTrashView ? 'buttonSelected' : ''}`}
              href={activeHref}
            >
              正常样本
            </Link>
            <Link
              className={`buttonGhost ${isTrashView ? 'buttonSelected' : ''}`}
              href={trashHref}
            >
              回收站
            </Link>
          </div>

          <div className="toolbarRow">
            <form className="filterGrid" method="GET">
              <input name="view" type="hidden" value={filters.view} />
              <label className="fieldStack">
                <span className="fieldLabel">关键词</span>
                <input className="formInput" defaultValue={filters.search} name="search" />
              </label>

              <label className="fieldStack">
                <span className="fieldLabel">赛道</span>
                <select className="formSelect" defaultValue={filters.track} name="track">
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
                <select className="formSelect" defaultValue={filters.contentType} name="content_type">
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
                <select className="formSelect" defaultValue={filters.coverStyle} name="cover_style">
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
                <select className="formSelect" defaultValue={filters.isHighValue} name="is_high_value">
                  <option value="">全部</option>
                  <option value="true">仅高价值</option>
                  <option value="false">仅普通</option>
                </select>
              </label>

              <label className="fieldStack">
                <span className="fieldLabel">开始日期</span>
                <input className="formInput" defaultValue={filters.dateFrom} name="date_from" type="date" />
              </label>

              <label className="fieldStack">
                <span className="fieldLabel">结束日期</span>
                <input className="formInput" defaultValue={filters.dateTo} name="date_to" type="date" />
              </label>

              <div className="inlineActions">
                <button className="buttonSecondary" type="submit">
                  应用筛选
                </button>
                <Link className="buttonGhost" href={createSamplesHref(query, {
                  page: undefined,
                  search: undefined,
                  track: undefined,
                  content_type: undefined,
                  cover_style: undefined,
                  is_high_value: undefined,
                  date_from: undefined,
                  date_to: undefined,
                })}>
                  重置
                </Link>
              </div>
            </form>

            {!isTrashView ? ingestControl : null}
          </div>
        </div>
      </section>

      <section className="sampleCardGrid sampleLibraryGrid">
        {result.samples.length > 0 ? (
          result.samples.map((sample) => (
            <article className="sampleCard" key={sample.id}>
              <Link className="sampleCardLink" href={`/samples/${sample.id}`}>
                <div className="mediaThumb">
                  {sample.cover_url ? (
                    <Image
                      alt={sample.title}
                      height={720}
                      src={sample.cover_url}
                      unoptimized
                      width={960}
                    />
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

              <div className="sampleCardActions">
                <SampleTrashActions context="list" sampleId={sample.id} view={filters.view} />
              </div>
            </article>
          ))
        ) : (
          <div className="emptyCard">
            {isTrashView
              ? '回收站里还没有样本。'
              : '当前筛选条件下没有样本。你可以先调整筛选，或者直接录入一条新样本。'}
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

export default async function SamplesPage({ searchParams }: SamplesPageProps) {
  const query = await searchParams;
  const currentPage = Math.max(parseInt(readParam(query, 'page') || '1', 10), 1);
  const limit = 12;
  const view = normalizeSampleListView(readParam(query, 'view'));
  const search = readParam(query, 'search') || '';
  const track = readParam(query, 'track') || '';
  const contentType = readParam(query, 'content_type') || '';
  const coverStyle = readParam(query, 'cover_style') || '';
  const isHighValue = readParam(query, 'is_high_value') || '';
  const dateFrom = readParam(query, 'date_from') || '';
  const dateTo = readParam(query, 'date_to') || '';

  const [result, options] = await Promise.all([
    listSamples({
      view,
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
    getSampleFilterOptions(view),
  ]);

  const totalPages = Math.max(1, Math.ceil(result.total / limit));
  const hasActiveSamples = hasActiveSampleStatuses(result.samples.map((sample) => sample.status));

  return (
    <SamplesPageContent
      currentPage={currentPage}
      filters={{
        view,
        search,
        track,
        contentType,
        coverStyle,
        isHighValue,
        dateFrom,
        dateTo,
      }}
      hasActiveSamples={hasActiveSamples}
      ingestControl={<SampleIngestDrawer />}
      options={options}
      query={query}
      result={result}
      statusRefreshControl={<SampleStatusAutoRefresh isActive={view === 'active' && hasActiveSamples} />}
      totalPages={totalPages}
    />
  );
}
