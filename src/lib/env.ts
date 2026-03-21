const UNRESOLVED_ENV_PATTERN = /\$\{[^}]+\}/;

type EnvMap = Record<string, string | undefined>;

function normalizeEnvValue(value?: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const trimmed = value.trim();

  if (trimmed === '' || UNRESOLVED_ENV_PATTERN.test(trimmed)) {
    return undefined;
  }

  return trimmed;
}

export function resolveEnvValue(value?: string, fallback?: string): string | undefined {
  return normalizeEnvValue(value) ?? normalizeEnvValue(fallback);
}

export function resolveDatabaseUrl(env: EnvMap): string | undefined {
  const databaseUrl = normalizeEnvValue(env.DATABASE_URL);

  if (databaseUrl) {
    return databaseUrl;
  }

  const host = normalizeEnvValue(env.DB_HOST);
  const port = normalizeEnvValue(env.DB_PORT);
  const user = normalizeEnvValue(env.DB_USER);
  const password = normalizeEnvValue(env.DB_PASSWORD);
  const databaseName = normalizeEnvValue(env.DB_NAME);

  if (!host || !port || !user || !password || !databaseName) {
    return undefined;
  }

  return `postgresql://${user}:${password}@${host}:${port}/${databaseName}`;
}
