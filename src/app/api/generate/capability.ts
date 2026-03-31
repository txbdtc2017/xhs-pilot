import { isKimiCodingAnthropicBaseUrl } from '@/lib/anthropic-provider-compat';

export type GenerationCapabilityCode = 'GENERATION_UNSUPPORTED_PROVIDER';

export type GenerationCapabilityStatus =
  | { available: true }
  | {
      available: false;
      code: GenerationCapabilityCode;
      message: string;
    };

const KIMI_ANTHROPIC_GENERATION_UNAVAILABLE_MESSAGE =
  '当前 Kimi Anthropic 配置暂不支持内容生成，请切换 provider 或启用兼容模式。';

export function resolveGenerationCapabilityStatus(
  env: NodeJS.ProcessEnv = process.env,
): GenerationCapabilityStatus {
  if (
    env.LLM_PROTOCOL === 'anthropic-messages' &&
    isKimiCodingAnthropicBaseUrl(env.LLM_BASE_URL)
  ) {
    return {
      available: false,
      code: 'GENERATION_UNSUPPORTED_PROVIDER',
      message: KIMI_ANTHROPIC_GENERATION_UNAVAILABLE_MESSAGE,
    };
  }

  return { available: true };
}
