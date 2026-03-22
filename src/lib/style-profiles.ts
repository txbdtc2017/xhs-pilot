import { query, queryOne } from './db';

export interface StyleProfileTagSource {
  track: string | null;
  content_type: string | null;
  cover_style_tag: string | null;
}

export interface StyleProfileSummary {
  id: string;
  name: string;
  description: string | null;
  sample_count: number;
  typical_tags: string[];
}

export interface StyleProfileDetail extends StyleProfileSummary {
  samples: Array<{
    id: string;
    title: string;
    status: string;
    track: string | null;
    content_type: string | null;
    cover_url: string | null;
  }>;
}

export interface StyleProfileMutationInput {
  name: string;
  description?: string | null;
}

interface StyleProfileListRow extends StyleProfileTagSource {
  id: string;
  name: string;
  description: string | null;
  sample_count: number;
  created_at: string;
}

function scoreLabels(rows: Array<{ value: string | null }>): string[] {
  const counts = new Map<string, { count: number; firstIndex: number }>();

  rows.forEach((row, index) => {
    if (!row.value) {
      return;
    }

    const existing = counts.get(row.value);
    if (existing) {
      existing.count += 1;
      return;
    }

    counts.set(row.value, { count: 1, firstIndex: index });
  });

  return [...counts.entries()]
    .sort((left, right) => {
      if (right[1].count !== left[1].count) {
        return right[1].count - left[1].count;
      }

      return left[1].firstIndex - right[1].firstIndex;
    })
    .map(([value]) => value);
}

export function buildTypicalTags(rows: StyleProfileTagSource[]): string[] {
  return scoreLabels(
    rows.flatMap((row) => [
      { value: row.track },
      { value: row.cover_style_tag },
      { value: row.content_type },
    ]),
  );
}

function groupStyleProfileRows(rows: StyleProfileListRow[]): { profiles: StyleProfileSummary[] } {
  const grouped = new Map<
    string,
    {
      id: string;
      name: string;
      description: string | null;
      sample_count: number;
      created_at: string;
      labels: StyleProfileTagSource[];
    }
  >();

  for (const row of rows) {
    const existing = grouped.get(row.id);
    if (existing) {
      existing.labels.push({
        track: row.track,
        content_type: row.content_type,
        cover_style_tag: row.cover_style_tag,
      });
      continue;
    }

    grouped.set(row.id, {
      id: row.id,
      name: row.name,
      description: row.description,
      sample_count: row.sample_count,
      created_at: row.created_at,
      labels: [
        {
          track: row.track,
          content_type: row.content_type,
          cover_style_tag: row.cover_style_tag,
        },
      ],
    });
  }

  return {
    profiles: [...grouped.values()]
      .sort((left, right) => right.created_at.localeCompare(left.created_at))
      .map((profile) => ({
        id: profile.id,
        name: profile.name,
        description: profile.description,
        sample_count: profile.sample_count,
        typical_tags: buildTypicalTags(profile.labels),
      })),
  };
}

export async function listStyleProfiles(): Promise<{ profiles: StyleProfileSummary[] }> {
  const rows = await query<StyleProfileListRow>(
    `
      SELECT
        sp.id,
        sp.name,
        sp.description,
        sp.sample_count,
        sp.created_at,
        sa.track,
        sa.content_type,
        sva.cover_style_tag
      FROM style_profiles sp
      LEFT JOIN style_profile_samples sps ON sps.style_profile_id = sp.id
      LEFT JOIN sample_analysis sa ON sa.sample_id = sps.sample_id
      LEFT JOIN sample_visual_analysis sva ON sva.sample_id = sps.sample_id
      ORDER BY sp.created_at DESC, sp.name ASC
    `,
  );

  return groupStyleProfileRows(rows);
}

export async function getStyleProfileDetail(profileId: string): Promise<StyleProfileDetail | null> {
  const profile = await queryOne<{
    id: string;
    name: string;
    description: string | null;
    sample_count: number;
  }>(
    `
      SELECT id, name, description, sample_count
      FROM style_profiles
      WHERE id = $1
    `,
    [profileId],
  );

  if (!profile) {
    return null;
  }

  const [tagRows, samples] = await Promise.all([
    query<StyleProfileTagSource>(
      `
        SELECT sa.track, sa.content_type, sva.cover_style_tag
        FROM style_profile_samples sps
        LEFT JOIN sample_analysis sa ON sa.sample_id = sps.sample_id
        LEFT JOIN sample_visual_analysis sva ON sva.sample_id = sps.sample_id
        WHERE sps.style_profile_id = $1
      `,
      [profileId],
    ),
    query<StyleProfileDetail['samples'][number]>(
      `
        SELECT
          s.id,
          s.title,
          s.status,
          sa.track,
          sa.content_type,
          (
            SELECT si.image_url
            FROM sample_images si
            WHERE si.sample_id = s.id AND si.image_type = 'cover'
            ORDER BY si.sort_order ASC
            LIMIT 1
          ) AS cover_url
        FROM style_profile_samples sps
        INNER JOIN samples s ON s.id = sps.sample_id
        LEFT JOIN sample_analysis sa ON sa.sample_id = s.id
        WHERE sps.style_profile_id = $1
        ORDER BY s.created_at DESC
      `,
      [profileId],
    ),
  ]);

  return {
    ...profile,
    typical_tags: buildTypicalTags(tagRows),
    samples,
  };
}

async function refreshStyleProfileSampleCount(profileId: string): Promise<number> {
  const countRow = await queryOne<{ total: number }>(
    `
      SELECT COUNT(*)::int AS total
      FROM style_profile_samples
      WHERE style_profile_id = $1
    `,
    [profileId],
  );

  const total = countRow?.total ?? 0;

  await query(
    `
      UPDATE style_profiles
      SET sample_count = $2, updated_at = NOW()
      WHERE id = $1
    `,
    [profileId, total],
  );

  return total;
}

export async function createStyleProfile(
  input: StyleProfileMutationInput,
): Promise<{ profile: StyleProfileSummary }> {
  const created = await queryOne<{ id: string }>(
    `
      INSERT INTO style_profiles (name, description, updated_at)
      VALUES ($1, $2, NOW())
      RETURNING id
    `,
    [input.name, input.description ?? null],
  );

  if (!created) {
    throw new Error('Failed to create style profile');
  }

  const profile = await getStyleProfileDetail(created.id);
  if (!profile) {
    throw new Error('Failed to load created style profile');
  }

  return {
    profile: {
      id: profile.id,
      name: profile.name,
      description: profile.description,
      sample_count: profile.sample_count,
      typical_tags: profile.typical_tags,
    },
  };
}

export async function updateStyleProfile(
  profileId: string,
  input: Partial<StyleProfileMutationInput>,
): Promise<{ profile: StyleProfileSummary } | null> {
  const existing = await queryOne<{ id: string; name: string; description: string | null }>(
    `
      SELECT id, name, description
      FROM style_profiles
      WHERE id = $1
    `,
    [profileId],
  );

  if (!existing) {
    return null;
  }

  await query(
    `
      UPDATE style_profiles
      SET
        name = $2,
        description = $3,
        updated_at = NOW()
      WHERE id = $1
    `,
    [profileId, input.name ?? existing.name, input.description ?? existing.description],
  );

  const profile = await getStyleProfileDetail(profileId);
  if (!profile) {
    return null;
  }

  return {
    profile: {
      id: profile.id,
      name: profile.name,
      description: profile.description,
      sample_count: profile.sample_count,
      typical_tags: profile.typical_tags,
    },
  };
}

export async function addSampleToStyleProfile(
  profileId: string,
  sampleId: string,
): Promise<{ success: true; sample_count: number } | null> {
  const profile = await queryOne<{ id: string }>(
    `SELECT id FROM style_profiles WHERE id = $1`,
    [profileId],
  );
  const sample = await queryOne<{ id: string }>(
    `SELECT id FROM samples WHERE id = $1`,
    [sampleId],
  );

  if (!profile || !sample) {
    return null;
  }

  await query(
    `
      INSERT INTO style_profile_samples (style_profile_id, sample_id)
      VALUES ($1, $2)
      ON CONFLICT DO NOTHING
    `,
    [profileId, sampleId],
  );

  return {
    success: true,
    sample_count: await refreshStyleProfileSampleCount(profileId),
  };
}

export async function removeSampleFromStyleProfile(
  profileId: string,
  sampleId: string,
): Promise<{ success: true; sample_count: number } | null> {
  const profile = await queryOne<{ id: string }>(
    `SELECT id FROM style_profiles WHERE id = $1`,
    [profileId],
  );

  if (!profile) {
    return null;
  }

  await query(
    `
      DELETE FROM style_profile_samples
      WHERE style_profile_id = $1 AND sample_id = $2
    `,
    [profileId, sampleId],
  );

  return {
    success: true,
    sample_count: await refreshStyleProfileSampleCount(profileId),
  };
}
