import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveDatabaseUrl, resolveEnvValue } from './env';

test('resolveEnvValue returns the fallback for unresolved placeholders', () => {
  assert.equal(resolveEnvValue('${LLM_API_KEY}', 'fallback-key'), 'fallback-key');
  assert.equal(resolveEnvValue('${LLM_BASE_URL}', 'https://example.com/v1'), 'https://example.com/v1');
});

test('resolveEnvValue keeps concrete values', () => {
  assert.equal(resolveEnvValue('https://localhost:11434/v1', 'fallback'), 'https://localhost:11434/v1');
});

test('resolveDatabaseUrl builds a connection string from DB_* values when DATABASE_URL is unresolved', () => {
  const url = resolveDatabaseUrl({
    DATABASE_URL: 'postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}',
    DB_HOST: 'localhost',
    DB_PORT: '5432',
    DB_USER: 'xhs_pilot',
    DB_PASSWORD: 'change-me',
    DB_NAME: 'xhs_pilot',
  });

  assert.equal(url, 'postgresql://xhs_pilot:change-me@localhost:5432/xhs_pilot');
});

test('resolveDatabaseUrl prefers a concrete DATABASE_URL value', () => {
  const url = resolveDatabaseUrl({
    DATABASE_URL: 'postgresql://user:pass@db:5432/app',
    DB_HOST: 'localhost',
    DB_PORT: '5432',
    DB_USER: 'xhs_pilot',
    DB_PASSWORD: 'change-me',
    DB_NAME: 'xhs_pilot',
  });

  assert.equal(url, 'postgresql://user:pass@db:5432/app');
});
