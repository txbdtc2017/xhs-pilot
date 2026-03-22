import type { Metadata } from 'next';

export const appMetadata: Metadata = {
  title: 'XHS Pilot',
  description: '小红书内容资产、检索与创作工作台。',
  applicationName: 'XHS Pilot',
  appleWebApp: {
    capable: true,
    title: 'XHS Pilot',
    statusBarStyle: 'default',
  },
  icons: {
    icon: [
      { url: '/icons/icon-192.svg', type: 'image/svg+xml' },
      { url: '/icons/icon-512.svg', type: 'image/svg+xml' },
    ],
    apple: [{ url: '/icons/icon-192.svg', type: 'image/svg+xml' }],
  },
};
