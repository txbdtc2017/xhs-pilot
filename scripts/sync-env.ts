import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const ENV_KEY_PATTERN = /^\s*([A-Z0-9_]+)=/;

export function collectEnvKeys(content: string): Set<string> {
  const keys = new Set<string>();

  for (const line of content.split(/\r?\n/)) {
    const match = line.match(ENV_KEY_PATTERN);
    if (match) {
      keys.add(match[1] as string);
    }
  }

  return keys;
}

export function buildMissingEnvPatch(exampleContent: string, existingKeys: Set<string>): string {
  const appendedLines: string[] = [];
  const lines = exampleContent.split(/\r?\n/);
  let pendingComments: string[] = [];
  let emittedInBlock = false;

  for (const line of lines) {
    if (!line.trim()) {
      if (emittedInBlock && appendedLines.at(-1) !== '') {
        appendedLines.push('');
      }

      pendingComments = [];
      emittedInBlock = false;
      continue;
    }

    if (line.trimStart().startsWith('#')) {
      pendingComments.push(line);
      continue;
    }

    const match = line.match(ENV_KEY_PATTERN);
    if (!match) {
      continue;
    }

    const key = match[1] as string;
    if (existingKeys.has(key)) {
      continue;
    }

    if (!emittedInBlock && pendingComments.length > 0) {
      appendedLines.push(...pendingComments);
    }

    appendedLines.push(line);
    emittedInBlock = true;
    existingKeys.add(key);
  }

  while (appendedLines.length > 0 && appendedLines.at(-1) === '') {
    appendedLines.pop();
  }

  return appendedLines.join('\n');
}

export function syncEnvFiles(examplePath: string, envPath: string): {
  addedKeys: string[];
  changed: boolean;
} {
  const exampleContent = readFileSync(examplePath, 'utf8');
  const envContent = existsSync(envPath) ? readFileSync(envPath, 'utf8') : '';
  const existingKeys = collectEnvKeys(envContent);
  const beforeKeys = new Set(existingKeys);
  const missingPatch = buildMissingEnvPatch(exampleContent, existingKeys);

  if (!missingPatch.trim()) {
    return { addedKeys: [], changed: false };
  }

  const addedKeys = Array.from(existingKeys).filter((key) => !beforeKeys.has(key));
  const normalizedEnvContent = envContent && !envContent.endsWith('\n') ? `${envContent}\n` : envContent;
  const nextContent = `${normalizedEnvContent}${normalizedEnvContent ? '\n' : ''}${missingPatch}\n`;
  writeFileSync(envPath, nextContent, 'utf8');

  return {
    addedKeys,
    changed: true,
  };
}

function main() {
  const cwd = process.cwd();
  const envPath = path.join(cwd, '.env');
  const examplePath = path.join(cwd, '.env.example');

  const result = syncEnvFiles(examplePath, envPath);

  if (!result.changed) {
    process.stdout.write('Local .env already contains every key from .env.example\n');
    return;
  }

  process.stdout.write(`Added ${result.addedKeys.length} missing .env keys: ${result.addedKeys.join(', ')}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
