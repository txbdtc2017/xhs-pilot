import Link from 'next/link';
import type { ReactNode } from 'react';
import { StyleProfileCreator } from '@/components/style-profile-creator';
import { listStyleProfiles } from '@/lib/style-profiles';

export const dynamic = 'force-dynamic';

export function StyleProfilesPageContent({
  profiles,
  creator,
}: {
  profiles: Awaited<ReturnType<typeof listStyleProfiles>>['profiles'];
  creator?: ReactNode;
}) {
  return (
    <div className="pageShell">
      <header className="pageHeader">
        <p className="eyebrow">风格集合</p>
        <h1 className="pageTitle">把高价值样本策展成可复用的风格集合。</h1>
        <p className="pageSubtitle">
          这里不是自动归纳引擎，而是人工策展工具。你决定哪些样本该被放在一起，系统负责把这些集合的标签和成员展示清楚。
        </p>
      </header>

      {creator ?? null}

      <section className="sampleCardGrid profileCollectionGrid">
        {profiles.length > 0 ? (
          profiles.map((profile) => (
            <Link className="sampleCard" href={`/styles/${profile.id}`} key={profile.id}>
              <div className="sampleCardBody">
                <div className="inlineMeta">
                  <span className="badge badgeInfo">{profile.sample_count} 个样本</span>
                </div>

                <h2>{profile.name}</h2>
                <p className="mutedText">{profile.description || '暂无描述'}</p>

                <div className="chipList">
                  {profile.typical_tags.length > 0 ? (
                    profile.typical_tags.slice(0, 6).map((tag) => (
                      <span className="chip" key={tag}>
                        {tag}
                      </span>
                    ))
                  ) : (
                    <span className="mutedText">暂无典型标签</span>
                  )}
                </div>
              </div>
            </Link>
          ))
        ) : (
          <div className="emptyCard">还没有风格画像。先创建一个，再把样本归进去。</div>
        )}
      </section>
    </div>
  );
}

export default async function StyleProfilesPage() {
  const { profiles } = await listStyleProfiles();

  return <StyleProfilesPageContent profiles={profiles} creator={<StyleProfileCreator />} />;
}
