import { readFileSync } from 'node:fs';
import { resolveEnvValue } from '@/lib/env';

export const IMAGE_PROVIDER_IDS = ['openai', 'google_vertex'] as const;
export type ImageProviderId = (typeof IMAGE_PROVIDER_IDS)[number];

export type ImageGenerationCapabilityCode =
  | 'IMAGE_UNCONFIGURED'
  | 'IMAGE_UNSUPPORTED_PROTOCOL'
  | 'IMAGE_GOOGLE_INVALID_CREDENTIALS';

export type ImageGenerationCapabilityStatus =
  | {
      provider: ImageProviderId;
      available: true;
      model: string;
    }
  | {
      provider: ImageProviderId;
      available: false;
      code: ImageGenerationCapabilityCode;
      message: string;
      model: string;
    };

export type ImageGenerationProviderSummary = ImageGenerationCapabilityStatus & {
  label: string;
};

export interface GoogleVertexImageConfig {
  credentialsPath: string;
  projectId: string;
  location: string;
  model: string;
}

const OPENAI_UNCONFIGURED_MESSAGE = '当前未配置图片生成能力，请补充 IMAGE_* 配置。';
const OPENAI_UNSUPPORTED_PROTOCOL_MESSAGE = '当前图片生成仅支持 openai 协议。';
const GOOGLE_UNCONFIGURED_MESSAGE = '当前未配置 Google Banana 图片生成能力，请补充 IMAGE_GOOGLE_* 配置。';

export const IMAGE_PROVIDER_LABELS: Record<ImageProviderId, string> = {
  openai: 'OpenAI-Compatible',
  google_vertex: 'Google Banana',
};

function resolveOpenAiImageModel(env: NodeJS.ProcessEnv): string {
  return resolveEnvValue(env.IMAGE_MODEL, 'gpt-image-1') ?? 'gpt-image-1';
}

function resolveGoogleImageModel(env: NodeJS.ProcessEnv): string {
  return resolveEnvValue(env.IMAGE_GOOGLE_MODEL, 'gemini-3-pro-image-preview') ?? 'gemini-3-pro-image-preview';
}

function resolveGoogleImageLocation(env: NodeJS.ProcessEnv): string {
  return resolveEnvValue(env.IMAGE_GOOGLE_LOCATION, 'global') ?? 'global';
}

function resolveGoogleImageCredentialError(env: NodeJS.ProcessEnv): string | null {
  const credentialsPath = resolveEnvValue(env.IMAGE_GOOGLE_CREDENTIALS_PATH);
  if (!credentialsPath) {
    return GOOGLE_UNCONFIGURED_MESSAGE;
  }

  let json: Record<string, unknown>;
  try {
    json = JSON.parse(readFileSync(credentialsPath, 'utf8')) as Record<string, unknown>;
  } catch (error) {
    return `当前 Google Banana 凭证无效：${credentialsPath} 读取失败。${error instanceof Error ? error.message : 'Unknown error'}`;
  }

  if (json.type !== 'service_account') {
    return `当前 Google Banana 凭证无效：${credentialsPath} 必须是 service account JSON。`;
  }

  const projectId = resolveEnvValue(env.IMAGE_GOOGLE_PROJECT_ID) ?? String(json.project_id ?? '').trim();
  if (!projectId) {
    return `当前 Google Banana 凭证无效：${credentialsPath} 未包含 project_id。`;
  }

  return null;
}

function resolveGoogleProjectId(env: NodeJS.ProcessEnv): string | null {
  const credentialsPath = resolveEnvValue(env.IMAGE_GOOGLE_CREDENTIALS_PATH);
  if (!credentialsPath) {
    return null;
  }

  const envProjectId = resolveEnvValue(env.IMAGE_GOOGLE_PROJECT_ID);
  if (envProjectId) {
    return envProjectId;
  }

  try {
    const json = JSON.parse(readFileSync(credentialsPath, 'utf8')) as Record<string, unknown>;
    const projectId = String(json.project_id ?? '').trim();
    return projectId || null;
  } catch {
    return null;
  }
}

function resolveOpenAiCapabilityStatus(env: NodeJS.ProcessEnv): ImageGenerationCapabilityStatus {
  const model = resolveOpenAiImageModel(env);
  const protocol = resolveEnvValue(env.IMAGE_PROTOCOL, 'openai') ?? 'openai';

  if (protocol !== 'openai') {
    return {
      provider: 'openai',
      available: false,
      code: 'IMAGE_UNSUPPORTED_PROTOCOL',
      message: OPENAI_UNSUPPORTED_PROTOCOL_MESSAGE,
      model,
    };
  }

  const apiKey = resolveEnvValue(env.IMAGE_API_KEY);
  const baseURL = resolveEnvValue(env.IMAGE_BASE_URL);

  if (!apiKey || !baseURL || !model) {
    return {
      provider: 'openai',
      available: false,
      code: 'IMAGE_UNCONFIGURED',
      message: OPENAI_UNCONFIGURED_MESSAGE,
      model,
    };
  }

  return {
    provider: 'openai',
    available: true,
    model,
  };
}

function resolveGoogleCapabilityStatus(env: NodeJS.ProcessEnv): ImageGenerationCapabilityStatus {
  const model = resolveGoogleImageModel(env);
  const credentialsPath = resolveEnvValue(env.IMAGE_GOOGLE_CREDENTIALS_PATH);

  if (!credentialsPath) {
    return {
      provider: 'google_vertex',
      available: false,
      code: 'IMAGE_UNCONFIGURED',
      message: GOOGLE_UNCONFIGURED_MESSAGE,
      model,
    };
  }

  const credentialError = resolveGoogleImageCredentialError(env);
  if (credentialError) {
    return {
      provider: 'google_vertex',
      available: false,
      code: credentialError === GOOGLE_UNCONFIGURED_MESSAGE
        ? 'IMAGE_UNCONFIGURED'
        : 'IMAGE_GOOGLE_INVALID_CREDENTIALS',
      message: credentialError,
      model,
    };
  }

  return {
    provider: 'google_vertex',
    available: true,
    model,
  };
}

export function resolveImageGenerationCapabilityStatus(
  env: NodeJS.ProcessEnv = process.env,
  provider: ImageProviderId = 'openai',
): ImageGenerationCapabilityStatus {
  return provider === 'google_vertex'
    ? resolveGoogleCapabilityStatus(env)
    : resolveOpenAiCapabilityStatus(env);
}

export function listImageGenerationProviders(
  env: NodeJS.ProcessEnv = process.env,
): {
  providers: ImageGenerationProviderSummary[];
  defaultProvider: ImageProviderId | null;
} {
  const providers = IMAGE_PROVIDER_IDS.map((provider) => ({
    ...resolveImageGenerationCapabilityStatus(env, provider),
    label: IMAGE_PROVIDER_LABELS[provider],
  }));

  const defaultProvider = providers.find((provider) => provider.provider === 'openai' && provider.available)?.provider
    ?? providers.find((provider) => provider.provider === 'google_vertex' && provider.available)?.provider
    ?? null;

  return {
    providers,
    defaultProvider,
  };
}

export function resolveGoogleVertexImageConfig(
  env: NodeJS.ProcessEnv = process.env,
): GoogleVertexImageConfig {
  const status = resolveGoogleCapabilityStatus(env);
  if (!status.available) {
    throw new Error(status.message);
  }

  const credentialsPath = resolveEnvValue(env.IMAGE_GOOGLE_CREDENTIALS_PATH);
  const projectId = resolveGoogleProjectId(env);
  if (!credentialsPath || !projectId) {
    throw new Error(GOOGLE_UNCONFIGURED_MESSAGE);
  }

  return {
    credentialsPath,
    projectId,
    location: resolveGoogleImageLocation(env),
    model: status.model,
  };
}
