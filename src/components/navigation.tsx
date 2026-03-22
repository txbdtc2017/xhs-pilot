'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { APP_VERSION } from '@/lib/app-version';

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard' },
  { href: '/samples', label: '样本库' },
  { href: '/create', label: '创作工作台' },
  { href: '/styles', label: '风格画像' },
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
            <small>内容资产与创作工作台</small>
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

      <nav className={`app-navLinks ${isOpen ? 'app-navLinksOpen' : ''}`}>
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

      <div className="app-navMeta">
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
