import assert from 'node:assert/strict';
import test from 'node:test';

import { appMetadata } from './metadata';

test('root metadata advertises the installed app shell', () => {
  assert.equal(appMetadata.title, 'XHS Pilot');
  assert.equal(appMetadata.description, '小红书内容资产、检索与创作工作台。');
  assert.deepEqual(appMetadata.applicationName, 'XHS Pilot');
  assert.deepEqual(appMetadata.appleWebApp, {
    capable: true,
    title: 'XHS Pilot',
    statusBarStyle: 'default',
  });
  assert.deepEqual(appMetadata.icons, {
    icon: [
      { url: '/icons/icon-192.svg', type: 'image/svg+xml' },
      { url: '/icons/icon-512.svg', type: 'image/svg+xml' },
    ],
    apple: [{ url: '/icons/icon-192.svg', type: 'image/svg+xml' }],
  });
});
