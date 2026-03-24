export const KIMI_CODING_USER_AGENT = 'claude-code/0.1.0';
export const KIMI_CODING_MODEL_ALIAS = 'kimi-code';
export const KIMI_CODING_UPSTREAM_MODEL_ID = 'kimi-for-coding';
export const KIMI_CODING_LEGACY_MODEL_ID = 'k2p5';

function trimTrailingSlashes(value: string): string {
  return value.replace(/\/+$/, '');
}

export function normalizeAnthropicBaseUrl(baseUrl?: string): string | undefined {
  const trimmed = baseUrl?.trim();
  if (!trimmed) {
    return undefined;
  }

  const withoutTrailingSlash = trimTrailingSlashes(trimmed);
  return /\/v1$/i.test(withoutTrailingSlash) ? withoutTrailingSlash : `${withoutTrailingSlash}/v1`;
}

export function isKimiCodingAnthropicBaseUrl(baseUrl?: string): boolean {
  const normalized = normalizeAnthropicBaseUrl(baseUrl);
  if (!normalized) {
    return false;
  }

  try {
    const parsed = new URL(normalized);
    const pathname = trimTrailingSlashes(parsed.pathname.toLowerCase());
    return parsed.hostname.toLowerCase() === 'api.kimi.com' && pathname === '/coding/v1';
  } catch {
    return /^https?:\/\/api\.kimi\.com\/coding\/v1$/i.test(normalized);
  }
}

export function resolveAnthropicProviderHeaders(
  baseUrl?: string,
): Record<string, string> | undefined {
  if (!isKimiCodingAnthropicBaseUrl(baseUrl)) {
    return undefined;
  }

  return {
    'User-Agent': KIMI_CODING_USER_AGENT,
  };
}

export function resolveAnthropicCompatibleModelId(modelId: string, baseUrl?: string): string {
  if (isKimiCodingAnthropicBaseUrl(baseUrl) && modelId === KIMI_CODING_MODEL_ALIAS) {
    return KIMI_CODING_UPSTREAM_MODEL_ID;
  }

  return modelId;
}
