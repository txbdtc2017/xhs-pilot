'use client';

import { startTransition, useState } from 'react';
import { useRouter } from 'next/navigation';

function parseTagString(rawValue: string): string[] {
  return rawValue
    .split(/[\n,，]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function SampleEditForm({
  sampleId,
  initialIsHighValue,
  initialIsReferenceAllowed,
  initialManualNotes,
  initialManualTags,
}: {
  sampleId: string;
  initialIsHighValue: boolean;
  initialIsReferenceAllowed: boolean;
  initialManualNotes: string;
  initialManualTags: string[];
}) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    setIsSubmitting(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/samples/${sampleId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          is_high_value: formData.get('is_high_value') === 'on',
          is_reference_allowed: formData.get('is_reference_allowed') === 'on',
          manual_tags: parseTagString(String(formData.get('manual_tags') ?? '')),
          manual_notes: String(formData.get('manual_notes') ?? ''),
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? '保存失败');
      }

      setMessage('已保存修正');
      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '保存失败');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="formStack" onSubmit={handleSubmit}>
      <label className="checkboxRow">
        <input defaultChecked={initialIsHighValue} name="is_high_value" type="checkbox" />
        <span>标记为高价值样本</span>
      </label>

      <label className="checkboxRow">
        <input
          defaultChecked={initialIsReferenceAllowed}
          name="is_reference_allowed"
          type="checkbox"
        />
        <span>允许被后续创作引用</span>
      </label>

      <label className="fieldStack">
        <span className="fieldLabel">人工标签</span>
        <input className="formInput" defaultValue={initialManualTags.join(', ')} name="manual_tags" />
      </label>

      <label className="fieldStack">
        <span className="fieldLabel">备注</span>
        <textarea
          className="formTextarea"
          defaultValue={initialManualNotes}
          name="manual_notes"
          rows={6}
        />
      </label>

      {message ? <div className="helperText">{message}</div> : null}

      <div className="inlineActions">
        <button className="buttonPrimary" disabled={isSubmitting} type="submit">
          {isSubmitting ? '保存中...' : '保存修正'}
        </button>
      </div>
    </form>
  );
}
