import Link from 'next/link';

export default function OfflinePage() {
  return (
    <div className="pageShell">
      <header className="pageHeader">
        <p className="eyebrow">Offline</p>
        <h1 className="pageTitle">你当前处于离线状态</h1>
        <p className="pageSubtitle">
          XHS Pilot 当前只提供可安装、可缓存静态壳、离线时有友好提示。
          创作生成、样本分析、检索和历史详情仍然需要服务端与模型服务在线。
        </p>
      </header>

      <section className="sectionCard">
        <div className="stackMd">
          <p>
            你可以在网络恢复后继续使用样本库、创作工作台和生成历史链路。
          </p>
          <div className="inlineActions">
            <Link className="buttonSecondary" href="/">
              返回 Dashboard
            </Link>
            <Link className="buttonGhost" href="/create">
              去创作工作台
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
