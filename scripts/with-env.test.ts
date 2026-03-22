import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import test from 'node:test';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const nodeBinDir = path.dirname(process.execPath);

test('with-env.sh prepends the local node_modules bin directory to PATH', () => {
  const output = execFileSync(
    'sh',
    ['scripts/with-env.sh', 'node', '-e', 'process.stdout.write(process.env.PATH || "")'],
    {
      cwd: repoRoot,
      env: {
        ...process.env,
        PATH: `${nodeBinDir}:/usr/bin:/bin`,
      },
      encoding: 'utf8',
    },
  ).trim();

  assert.match(output, new RegExp(`^${repoRoot.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/node_modules/\\.bin:`));
});
