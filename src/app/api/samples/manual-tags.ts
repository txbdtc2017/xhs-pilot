export class InvalidManualTagsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidManualTagsError';
  }
}

function normalizeManualTags(values: string[]): string[] {
  const normalized = values
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  return Array.from(new Set(normalized));
}

export function parseManualTagsFromFormData(formData: FormData): string[] {
  const explicitValues = formData
    .getAll('manual_tags[]')
    .filter((value): value is string => typeof value === 'string');

  if (explicitValues.length > 0) {
    return normalizeManualTags(explicitValues);
  }

  const legacyValue = formData.get('manual_tags');
  if (typeof legacyValue !== 'string' || legacyValue.trim() === '') {
    return [];
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(legacyValue);
  } catch {
    throw new InvalidManualTagsError('manual_tags must be a JSON string array');
  }

  if (!Array.isArray(parsed) || parsed.some((value) => typeof value !== 'string')) {
    throw new InvalidManualTagsError('manual_tags must be a JSON string array');
  }

  return normalizeManualTags(parsed);
}

