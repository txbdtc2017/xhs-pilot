'use client'

import type { ChangeEvent } from 'react';

import type { ImageConfigValues, ImageProviderPayload } from './models';
import { formatImageProvider } from './view-helpers';

export type ImageConfigFormClassName =
  | 'panel'
  | 'panelHeader'
  | 'panelTitle'
  | 'panelHint'
  | 'controlGrid'
  | 'field'
  | 'fieldLabel'
  | 'input'
  | 'select';

export type ImageConfigFormClasses = Record<ImageConfigFormClassName, string>;

interface ImageConfigFormProps {
  classes: ImageConfigFormClasses;
  config: ImageConfigValues;
  providers: ImageProviderPayload[];
  onChange: <K extends keyof ImageConfigValues>(field: K, value: ImageConfigValues[K]) => void;
}

function readNumber(value: string, fallback: number): number {
  const nextValue = Number.parseInt(value, 10);
  return Number.isNaN(nextValue) ? fallback : nextValue;
}

export function ImageConfigForm({
  classes,
  config,
  providers,
  onChange,
}: ImageConfigFormProps) {
  function handleTextChange<K extends Extract<keyof ImageConfigValues, 'provider' | 'visualDirectionOverride'>>(
    field: K,
  ) {
    return (
      event: ChangeEvent<HTMLInputElement | HTMLSelectElement>,
    ) => onChange(field, event.target.value as ImageConfigValues[K]);
  }

  function handleNumberChange<K extends Extract<keyof ImageConfigValues, 'bodyPageCap' | 'coverCandidateCount' | 'bodyCandidateCount'>>(
    field: K,
    fallback: number,
  ) {
    return (event: ChangeEvent<HTMLInputElement>) =>
      onChange(field, readNumber(event.target.value, fallback) as ImageConfigValues[K]);
  }

  return (
    <section className={classes.panel}>
      <div className={classes.panelHeader}>
        <div className={classes.panelTitle}>图片参数</div>
        <div className={classes.panelHint}>图片 provider 和候选规则在这里配置，创建计划后会固化到该 plan。</div>
      </div>

      <div className={classes.controlGrid}>
        <label className={classes.field}>
          <span className={classes.fieldLabel}>图片提供方</span>
          <select
            className={classes.select}
            value={config.provider}
            onChange={handleTextChange('provider')}
          >
            {providers.map((provider) => (
              <option key={provider.provider} value={provider.provider} disabled={!provider.available}>
                {provider.label || formatImageProvider(provider.provider)}
                {!provider.available ? '（不可用）' : ''}
              </option>
            ))}
          </select>
        </label>

        <label className={classes.field}>
          <span className={classes.fieldLabel}>图片视觉方向</span>
          <input
            className={classes.input}
            value={config.visualDirectionOverride}
            onChange={handleTextChange('visualDirectionOverride')}
            placeholder="例如：漫画感、纪实感、暖调胶片"
          />
        </label>

        <label className={classes.field}>
          <span className={classes.fieldLabel}>正文页上限</span>
          <input
            className={classes.input}
            type="number"
            min={1}
            value={String(config.bodyPageCap)}
            onChange={handleNumberChange('bodyPageCap', config.bodyPageCap)}
          />
        </label>

        <label className={classes.field}>
          <span className={classes.fieldLabel}>封面候选数</span>
          <input
            className={classes.input}
            type="number"
            min={1}
            value={String(config.coverCandidateCount)}
            onChange={handleNumberChange('coverCandidateCount', config.coverCandidateCount)}
          />
        </label>

        <label className={classes.field}>
          <span className={classes.fieldLabel}>正文候选数</span>
          <input
            className={classes.input}
            type="number"
            min={1}
            value={String(config.bodyCandidateCount)}
            onChange={handleNumberChange('bodyCandidateCount', config.bodyCandidateCount)}
          />
        </label>
      </div>
    </section>
  );
}
