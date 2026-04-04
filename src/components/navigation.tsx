'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { APP_VERSION } from '@/lib/app-version';

const NAV_ITEMS = [
  { href: '/', label: '资产总览' },
  { href: '/samples', label: '内容档案' },
  { href: '/create', label: '创作工作台' },
  { href: '/history', label: '历史任务' },
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
    <header className="workbenchBar">
      <div className="workbenchBarInner">
        <div className="workbenchLead">
          <Link className="brand workbenchBrand" href="/" onClick={onNavigate}>
            <span className="brandMark">XP</span>
            <span>
              <strong>XHS Pilot</strong>
              <small>内容采集与创作</small>
            </span>
          </Link>
        </div>

        <button
          aria-expanded={isOpen}
          aria-label="切换导航"
          className="workbenchToggle"
          type="button"
          onClick={onToggle}
        >
          <span />
          <span />
          <span />
        </button>

        <div className={`workbenchTray ${isOpen ? 'workbenchTrayOpen' : ''}`}>
          <div className="workbenchSection">
            <div className="workbenchSectionLabel">导航</div>
            <nav className="workbenchNav">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  className={`workbenchNavLink ${isActive(pathname, item.href) ? 'workbenchNavLinkActive' : ''}`}
                  href={item.href}
                  onClick={onNavigate}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="workbenchActionGroup">
            <Link className="buttonSecondary" href="/samples" onClick={onNavigate}>
              录入样本
            </Link>
            <Link className="buttonPrimary" href="/create" onClick={onNavigate}>
              开始创作
            </Link>
            <span className="badge badgeNeutral">版本 v{APP_VERSION}</span>
          </div>
        </div>
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
