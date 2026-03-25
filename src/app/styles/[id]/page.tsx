import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { StatusBadge } from '@/components/status-badge';
import { StyleProfileEditor } from '@/components/style-profile-editor';
import { listSampleSelectOptions } from '@/lib/samples';
import { getStyleProfileDetail } from '@/lib/style-profiles';

export const dynamic = 'force-dynamic';

type StyleProfileDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function StyleProfileDetailPage({
  params,
}: StyleProfileDetailPageProps) {
  const { id } = await params;
  const [profile, availableSamples] = await Promise.all([
    getStyleProfileDetail(id),
    listSampleSelectOptions(),
  ]);

  if (!profile) {
    notFound();
  }

  return (
    <div className="pageShell">
      <header className="pageHeader">
        <Link className="buttonGhost" href="/styles">
          返回风格集合
        </Link>
        <p className="eyebrow">风格档案</p>
        <h1 className="pageTitle">{profile.name}</h1>
        <p className="pageSubtitle">
          {profile.description || '这是一个手动维护的风格档案，用来把同类样本长期收拢在一起。'}
        </p>
        <div className="chipList">
          <span className="badge badgeInfo">{profile.sample_count} 个样本</span>
          {profile.typical_tags.map((tag) => (
            <span className="chip" key={tag}>
              {tag}
            </span>
          ))}
        </div>
      </header>

      <section className="contentColumns">
        <div className="sectionCard">
          <div className="panelHeading">
            <div>
              <p className="eyebrow">Collection</p>
              <h2 className="panelTitle">画像里的样本</h2>
            </div>
          </div>

          <div className="sampleCardGrid compactCards">
            {profile.samples.length > 0 ? (
              profile.samples.map((sample) => (
                <Link className="sampleCard" href={`/samples/${sample.id}`} key={sample.id}>
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
                    </div>
                    <h2>{sample.title}</h2>
                    <div className="chipList">
                      {sample.track ? <span className="chip">{sample.track}</span> : null}
                      {sample.content_type ? <span className="chip">{sample.content_type}</span> : null}
                    </div>
                  </div>
                </Link>
              ))
            ) : (
              <div className="emptyCard">当前画像还没有样本。</div>
            )}
          </div>
        </div>

        <StyleProfileEditor
          availableSamples={availableSamples}
          initialDescription={profile.description || ''}
          initialName={profile.name}
          profileId={profile.id}
          selectedSamples={profile.samples.map((sample) => ({
            id: sample.id,
            title: sample.title,
            status: sample.status,
          }))}
        />
      </section>
    </div>
  );
}
