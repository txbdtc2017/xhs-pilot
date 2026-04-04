'use client'

import Link from 'next/link';

import {
  buildCreateCopyHref,
  buildCreateImagesHref,
  buildCreatePublishHref,
} from './history';

export type StudioTab = 'copy' | 'images' | 'publish';

export interface StudioTabsClasses {
  studioTabs: string;
  studioTab: string;
  studioTabActive: string;
}

interface StudioTabsProps {
  classes: StudioTabsClasses;
  activeTab: StudioTab;
  taskId?: string | null;
  outputId?: string | null;
}

export function StudioTabs({
  classes,
  activeTab,
  taskId,
  outputId,
}: StudioTabsProps) {
  const items = [
    {
      key: 'copy' as const,
      label: '文案创作',
      href: buildCreateCopyHref(taskId, outputId),
    },
    {
      key: 'images' as const,
      label: '图片创作',
      href: buildCreateImagesHref(taskId, outputId),
    },
    {
      key: 'publish' as const,
      label: '发布',
      href: buildCreatePublishHref(taskId, outputId),
    },
  ];

  return (
    <nav className={classes.studioTabs} aria-label="创作工作流">
      {items.map((item) => (
        <Link
          key={item.key}
          className={`${classes.studioTab} ${activeTab === item.key ? classes.studioTabActive : ''}`}
          href={item.href}
          scroll={false}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
