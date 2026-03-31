import Link from 'next/link';

export default function OfflinePage() {
  return (
    <div className="pageShell">
      <header className="pageHeader pageHeaderCompact">
        <p className="eyebrow">离线</p>
        <h1 className="pageTitle">当前设备离线</h1>
        <p className="pageSubtitle">
          创作生成、样本分析、检索和历史详情仍然依赖服务端与模型服务在线。
        </p>
      </header>

      <section className="sectionCard">
        <div className="stackMd">
          <p>
            网络恢复后，你可以继续查看内容档案、创作工作台和历史记录。
          </p>
          <div className="inlineActions">
            <Link className="buttonSecondary" href="/">
              返回首页
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
