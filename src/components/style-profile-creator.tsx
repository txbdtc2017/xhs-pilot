'use client';

import { startTransition, useState } from 'react';
import { useRouter } from 'next/navigation';

export function StyleProfileCreator() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    setIsSubmitting(true);
    setMessage(null);

    try {
      const response = await fetch('/api/style-profiles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: String(formData.get('name') ?? ''),
          description: String(formData.get('description') ?? ''),
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? '创建画像失败');
      }

      event.currentTarget.reset();
      setMessage('画像已创建');
      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '创建画像失败');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="formCard" onSubmit={handleSubmit}>
      <div className="panelHeading">
        <div>
          <p className="eyebrow">Create Profile</p>
          <h2 className="panelTitle">手动建立一个新风格画像</h2>
        </div>
      </div>

      <div className="formGrid">
        <label className="fieldStack">
          <span className="fieldLabel">画像名称</span>
          <input className="formInput" name="name" required />
        </label>

        <label className="fieldStack">
          <span className="fieldLabel">描述</span>
          <input className="formInput" name="description" />
        </label>
      </div>

      {message ? <div className="helperText">{message}</div> : null}

      <div className="inlineActions">
        <button className="buttonPrimary" disabled={isSubmitting} type="submit">
          {isSubmitting ? '创建中...' : '创建画像'}
        </button>
      </div>
    </form>
  );
}
