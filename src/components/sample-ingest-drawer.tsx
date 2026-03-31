'use client';

import { createPortal } from 'react-dom';
import { startTransition, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function normalizeTags(rawValue: string): string[] {
  return rawValue
    .split(/[\n,，]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function lockBodyScroll(documentLike: Pick<Document, 'body'> | null | undefined) {
  const body = documentLike?.body;
  if (!body) {
    return () => undefined;
  }

  const previousOverflow = body.style.overflow;
  body.style.overflow = 'hidden';

  return () => {
    body.style.overflow = previousOverflow;
  };
}

export function SampleIngestDrawer() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const formRef = useRef<HTMLFormElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const currentView = searchParams.get('view') === 'trash' ? 'trash' : 'active';

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    return lockBodyScroll(document);
  }, [isOpen]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const formData = new FormData(formElement);
    const manualTags = normalizeTags(String(formData.get('manual_tags') ?? ''));
    formData.delete('manual_tags');

    for (const tag of manualTags) {
      formData.append('manual_tags[]', tag);
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/samples', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? '样本创建失败');
      }

      formRef.current?.reset();
      setIsOpen(false);
      startTransition(() => {
        router.refresh();
      });
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : '样本创建失败');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (currentView === 'trash') {
    return null;
  }

  const drawerContent = (
    <div className="drawerRoot" role="dialog" aria-modal="true">
      <button
        aria-label="关闭录入侧栏"
        className="drawerBackdrop"
        type="button"
        onClick={() => setIsOpen(false)}
      />

      <aside className="drawerPanel">
        <div className="drawerHeader">
          <div>
            <p className="eyebrow">样本录入</p>
            <h2 className="drawerTitle">录入样本</h2>
          </div>

          <button className="buttonGhost" type="button" onClick={() => setIsOpen(false)}>
            关闭
          </button>
        </div>

        <form className="formStack" onSubmit={handleSubmit} ref={formRef}>
          <label className="fieldStack">
            <span className="fieldLabel">标题</span>
            <input className="formInput" name="title" required />
          </label>

          <label className="fieldStack">
            <span className="fieldLabel">正文</span>
            <textarea className="formTextarea" name="body_text" required rows={10} />
          </label>

          <label className="fieldStack">
            <span className="fieldLabel">来源链接</span>
            <input className="formInput" name="source_url" placeholder="https://..." />
          </label>

          <label className="fieldStack">
            <span className="fieldLabel">手动标签</span>
            <input
              className="formInput"
              name="manual_tags"
              placeholder="职场, 收藏向, 复盘"
            />
          </label>

          <label className="fieldStack">
            <span className="fieldLabel">图片</span>
            <input accept="image/*" className="formInput" multiple name="images" type="file" />
          </label>

          <p className="helperText">
            提交后会直接触发分析队列。重复 `source_url` 会返回 409，避免同链接重复录入。
          </p>

          {error ? <div className="errorBanner">{error}</div> : null}

          <div className="drawerActions">
            <button className="buttonSecondary" type="button" onClick={() => setIsOpen(false)}>
              取消
            </button>
            <button className="buttonPrimary" disabled={isSubmitting} type="submit">
              {isSubmitting ? '提交中...' : '提交并分析'}
            </button>
          </div>
        </form>
      </aside>
    </div>
  );

  return (
    <>
      <button className="buttonPrimary" type="button" onClick={() => setIsOpen(true)}>
        录入样本
      </button>

      {isOpen
        ? typeof document !== 'undefined' && document.body
          ? createPortal(drawerContent, document.body)
          : drawerContent
        : null}
    </>
  );
}
