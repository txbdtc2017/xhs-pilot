'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { APP_VERSION } from '@/lib/app-version';

const NAV_ITEMS = [
  { href: '/', label: '资产总览' },
  { href: '/samples', label: '内容档案' },
  { href: '/create', label: '创作工作台' },
  { href: '/styles', label: '风格集合' },
];

function isActive(pathname: string, href: string) {
  if (href === '/') {
    return pathname === '/';
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export interface NavigationContentProps {
  pathname: string;
  isOpen: boolean;
  onNavigate?: () => void;
  onToggle?: () => void;
}

export function NavigationContent({
  pathname,
  isOpen,
  onNavigate,
  onToggle,
}: NavigationContentProps) {
  return (
    <header className="app-nav">
      <div className="app-navHeader">
        <Link className="brand" href="/" onClick={onNavigate}>
          <span className="brandMark">XP</span>
          <span>
            <strong>XHS Pilot</strong>
            <small>内容档案、风格策展与创作工作台</small>
          </span>
        </Link>

        <button
          aria-expanded={isOpen}
          aria-label="切换导航"
          className="navToggle"
          type="button"
          onClick={onToggle}
        >
          <span />
          <span />
          <span />
        </button>
      </div>

      <div className={`app-navLinks ${isOpen ? 'app-navLinksOpen' : ''}`}>
        <div className="app-navSectionLabel">主操作</div>
        <div className="app-navActions">
          <Link className="app-navAction app-navActionPrimary" href="/samples" onClick={onNavigate}>
            录入样本
          </Link>
          <Link className="app-navAction app-navActionSecondary" href="/create" onClick={onNavigate}>
            开始创作
          </Link>
        </div>

        <div className="app-navSectionLabel">工作台</div>
        <nav className="app-navPrimary">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              className={`app-navLink ${isActive(pathname, item.href) ? 'app-navLinkActive' : ''}`}
              href={item.href}
              onClick={onNavigate}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>

      <div className="app-navMeta">
        <p className="app-navMetaTitle">单用户内容研究台</p>
        <p className="app-navMetaText">先沉淀样本，再归类风格，最后带着参考进入创作。</p>
        <span className="badge badgeNeutral">版本 v{APP_VERSION}</span>
      </div>
    </header>
  );
}

export function Navigation() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <NavigationContent
      pathname={pathname}
      isOpen={isOpen}
      onNavigate={() => setIsOpen(false)}
      onToggle={() => setIsOpen((current) => !current)}
    />
  );
}
