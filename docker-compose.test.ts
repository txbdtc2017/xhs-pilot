import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const repoRoot = '/Users/rotas/Documents/my/AIProjects/XHS-Pilot';

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

test('docker compose uses a dedicated migrate service before app and worker start', () => {
  const composeFile = readFileSync(path.join(repoRoot, 'docker-compose.yml'), 'utf8');
  const dockerfile = readFileSync(path.join(repoRoot, 'Dockerfile'), 'utf8');

  assert.match(composeFile, /\n  migrate:\n/);
  assert.match(composeFile, /migrate:[\s\S]*command:\s+sh -lc "\.\/scripts\/with-env\.sh node-pg-migrate up"/);
  assert.match(composeFile, /migrate:[\s\S]*volumes:\s*\n\s*-\s*\.\/\.credentials:\/app\/\.credentials:ro/);
  assert.match(composeFile, /app:[\s\S]*migrate:\s*\n\s*condition:\s*service_completed_successfully/);
  assert.match(composeFile, /app:[\s\S]*volumes:\s*\n\s*-\s*\.\/\.credentials:\/app\/\.credentials:ro[\s\S]*-\s*\.\/uploads:\/app\/uploads/);
  assert.match(composeFile, /worker:[\s\S]*migrate:\s*\n\s*condition:\s*service_completed_successfully/);
  assert.match(composeFile, /worker:[\s\S]*volumes:\s*\n\s*-\s*\.\/\.credentials:\/app\/\.credentials:ro[\s\S]*-\s*\.\/uploads:\/app\/uploads/);
  assert.doesNotMatch(composeFile, /worker:[\s\S]*node-pg-migrate up[\s\S]*restart:/);
  assert.doesNotMatch(
    dockerfile,
    new RegExp(escapeRegExp('CMD ["sh", "-lc", "./scripts/with-env.sh node-pg-migrate up && exec npm run start"]')),
  );
  assert.match(dockerfile, /CMD \["sh", "-lc", "exec npm run start"\]/);
});
