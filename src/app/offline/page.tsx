import Link from 'next/link';

export default function OfflinePage() {
  return (
    <div className="pageShell">
      <header className="pageHeader">
        <p className="eyebrow">Offline</p>
        <h1 className="pageTitle">你当前处于离线状态</h1>
        <p className="pageSubtitle">
          离线时仍可查看已缓存的工作台外壳，但创作生成、样本分析、检索与历史详情仍然依赖服务端和模型服务在线。
        </p>
      </header>

      <section className="sectionCard">
        <div className="stackMd">
          <p>
            网络恢复后，你可以继续回到内容档案、创作工作台和历史链路，把中断的工作接回主流程。
          </p>
          <div className="inlineActions">
            <Link className="buttonSecondary" href="/">
              返回资产总览
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
