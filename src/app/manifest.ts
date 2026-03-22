import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'XHS Pilot',
    short_name: 'XHS Pilot',
    description: '小红书内容资产、检索与创作工作台。',
    start_url: '/',
    display: 'standalone',
    background_color: '#fff8f1',
    theme_color: '#ff2442',
    icons: [
      {
        src: '/icons/icon-192.svg',
        sizes: '192x192',
        type: 'image/svg+xml',
      },
      {
        src: '/icons/icon-512.svg',
        sizes: '512x512',
        type: 'image/svg+xml',
      },
    ],
  };
}
