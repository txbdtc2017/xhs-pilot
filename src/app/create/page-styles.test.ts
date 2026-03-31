import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const createPageStyles = readFileSync(
  path.join(process.cwd(), 'src/app/create/page.module.css'),
  'utf8',
);

test('create page uses stronger color separation for hero, panel, and field headings', () => {
  assert.match(createPageStyles, /--create-title-color:/);
  assert.match(createPageStyles, /--create-heading-color:/);
  assert.match(createPageStyles, /--create-label-color:/);
  assert.match(createPageStyles, /\.title\s*\{[^}]*color:\s*var\(--create-title-color\);/s);
  assert.match(createPageStyles, /\.panelTitle\s*\{[^}]*color:\s*var\(--create-heading-color\);/s);
  assert.match(createPageStyles, /\.fieldLabel\s*\{[^}]*color:\s*var\(--create-label-color\);/s);
});
