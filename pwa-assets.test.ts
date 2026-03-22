import assert from 'node:assert/strict';
import fs from 'fs/promises';
import path from 'path';
import test from 'node:test';

const projectRoot = process.cwd();

test('public/sw.js is present and contains offline fallback logic', async () => {
  const swPath = path.join(projectRoot, 'public', 'sw.js');
  const source = await fs.readFile(swPath, 'utf8');

  assert.match(source, /const OFFLINE_URL = '\/offline';/);
  assert.match(source, /self\.addEventListener\('install'/);
  assert.match(source, /self\.addEventListener\('fetch'/);
});

test('PWA icon assets exist', async () => {
  await fs.access(path.join(projectRoot, 'public', 'icons', 'icon-192.svg'));
  await fs.access(path.join(projectRoot, 'public', 'icons', 'icon-512.svg'));
});
