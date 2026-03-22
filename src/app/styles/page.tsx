import Link from 'next/link';
import { StyleProfileCreator } from '@/components/style-profile-creator';
import { listStyleProfiles } from '@/lib/style-profiles';

export const dynamic = 'force-dynamic';

export default async function StyleProfilesPage() {
  const { profiles } = await listStyleProfiles();

  return (
    <div className="pageShell">
      <header className="pageHeader">
        <p className="eyebrow">Style Profiles</p>
        <h1 className="pageTitle">先手动分组，再观察系统已经沉淀出哪些风格簇。</h1>
        <p className="pageSubtitle">
          当前阶段的画像是人工策展工具，不做自动推荐和自动归纳。你决定分组，系统只负责把关联样本和高频标签展示清楚。
        </p>
      </header>

      <StyleProfileCreator />

      <section className="sampleCardGrid">
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
