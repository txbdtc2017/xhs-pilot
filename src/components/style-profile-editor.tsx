'use client';

import { startTransition, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { SampleSelectOption } from '@/lib/samples';

interface SelectedSample {
  id: string;
  title: string;
  status: string;
}

export function StyleProfileEditor({
  profileId,
  initialName,
  initialDescription,
  availableSamples,
  selectedSamples,
}: {
  profileId: string;
  initialName: string;
  initialDescription: string;
  availableSamples: SampleSelectOption[];
  selectedSamples: SelectedSample[];
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [isSavingMeta, setIsSavingMeta] = useState(false);
  const [isMutatingSamples, setIsMutatingSamples] = useState(false);

  async function handleMetaSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    setIsSavingMeta(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/style-profiles/${profileId}`, {
        method: 'PATCH',
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
        throw new Error(payload?.error ?? '更新画像失败');
      }

      setMessage('画像信息已更新');
      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '更新画像失败');
    } finally {
      setIsSavingMeta(false);
    }
  }

  async function handleAddSample(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const sampleId = String(formData.get('sample_id') ?? '');

    if (!sampleId) {
      setMessage('请选择一个样本');
      return;
    }

    setIsMutatingSamples(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/style-profiles/${profileId}/samples`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sampleId }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? '添加样本失败');
      }

      setMessage('样本已加入画像');
      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '添加样本失败');
    } finally {
      setIsMutatingSamples(false);
    }
  }

  async function handleRemoveSample(sampleId: string) {
    setIsMutatingSamples(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/style-profiles/${profileId}/samples/${sampleId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? '移除样本失败');
      }

      setMessage('样本已移出画像');
      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '移除样本失败');
    } finally {
      setIsMutatingSamples(false);
    }
  }

  const selectableSamples = availableSamples.filter(
    (sample) => !selectedSamples.some((selected) => selected.id === sample.id),
  );

  return (
    <div className="stackLg">
      <form className="formCard" onSubmit={handleMetaSubmit}>
        <div className="panelHeading">
          <div>
            <p className="eyebrow">Profile Settings</p>
            <h2 className="panelTitle">风格档案信息</h2>
          </div>
        </div>

        <div className="formGrid">
          <label className="fieldStack">
            <span className="fieldLabel">画像名称</span>
            <input className="formInput" defaultValue={initialName} name="name" required />
          </label>

          <label className="fieldStack">
            <span className="fieldLabel">描述</span>
            <input className="formInput" defaultValue={initialDescription} name="description" />
          </label>
        </div>

        <div className="inlineActions">
          <button className="buttonPrimary" disabled={isSavingMeta} type="submit">
            {isSavingMeta ? '保存中...' : '保存画像'}
          </button>
        </div>
      </form>

      <form className="formCard" onSubmit={handleAddSample}>
        <div className="panelHeading">
          <div>
            <p className="eyebrow">Curation</p>
            <h2 className="panelTitle">把样本纳入当前集合</h2>
          </div>
        </div>

        <div className="responsiveInline">
          <select className="formSelect" name="sample_id" defaultValue="">
            <option value="">选择一个样本</option>
            {selectableSamples.map((sample) => (
              <option key={sample.id} value={sample.id}>
                {sample.title} · {sample.status}
              </option>
            ))}
          </select>

          <button className="buttonSecondary" disabled={isMutatingSamples} type="submit">
            添加样本
          </button>
        </div>
      </form>

      <div className="sectionCard">
        <div className="panelHeading">
          <div>
            <p className="eyebrow">Membership</p>
            <h2 className="panelTitle">当前样本</h2>
          </div>
        </div>

        <div className="listStack">
          {selectedSamples.length > 0 ? (
            selectedSamples.map((sample) => (
              <div className="listRow" key={sample.id}>
                <div>
                  <strong>{sample.title}</strong>
                  <p className="mutedText">状态：{sample.status}</p>
                </div>

                <button
                  className="buttonGhost"
                  disabled={isMutatingSamples}
                  type="button"
                  onClick={() => handleRemoveSample(sample.id)}
                >
                  移除
                </button>
              </div>
            ))
          ) : (
            <div className="emptyCard">当前画像还没有样本。</div>
          )}
        </div>

        {message ? <div className="helperText">{message}</div> : null}
      </div>
    </div>
  );
}
