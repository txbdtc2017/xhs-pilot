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
      <header className="pageHeader pageHeaderCompact">
        <p className="eyebrow">风格画像</p>
        <h1 className="pageTitle">风格画像</h1>
        <p className="pageSubtitle">
          手动创建、维护和查看风格画像。
        </p>
      </header>

      {creator ?? null}

      <section className="sectionCard archiveTableCard">
        {profiles.length > 0 ? (
          profiles.map((profile) => (
            <Link className="archiveIndexRow" href={`/styles/${profile.id}`} key={profile.id}>
              <div className="archiveIndexMain">
                <strong className="archiveTitle">{profile.name}</strong>
                <p className="mutedText">{profile.description || '暂无描述'}</p>
              </div>

              <div className="archiveIndexMeta">
                <span className="badge badgeInfo">{profile.sample_count} 个样本</span>
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
