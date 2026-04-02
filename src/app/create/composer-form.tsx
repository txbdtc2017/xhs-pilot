'use client'

import type { ChangeEvent, FormEvent } from 'react';

import type { CreateFormValues, ImageConfigValues, ImageProviderPayload } from './state';

export type CreateComposerFormClassName =
  | 'panel'
  | 'composerPanel'
  | 'panelHeader'
  | 'panelTitle'
  | 'panelHint'
  | 'composerLayout'
  | 'composerPrimary'
  | 'composerSecondary'
  | 'field'
  | 'topicField'
  | 'fieldLabel'
  | 'textarea'
  | 'topicTextarea'
  | 'controlGrid'
  | 'input'
  | 'select'
  | 'composerActions'
  | 'checkboxCard'
  | 'checkboxControl'
  | 'checkboxInput'
  | 'checkboxText'
  | 'checkboxHint'
  | 'submitButton'
  | 'errorBox';

export type CreateComposerFormClasses = Record<CreateComposerFormClassName, string>;

interface CreateComposerFormProps {
  classes: CreateComposerFormClasses;
  form: CreateFormValues;
  imageConfig: ImageConfigValues;
  imageProviders: ImageProviderPayload[];
  isSubmitting: boolean;
  error: string | null;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onFieldChange: <K extends keyof CreateFormValues>(field: K, value: CreateFormValues[K]) => void;
  onImageConfigChange: <K extends keyof ImageConfigValues>(field: K, value: ImageConfigValues[K]) => void;
}

export function CreateComposerForm({
  classes,
  form,
  imageConfig,
  imageProviders,
  isSubmitting,
  error,
  onSubmit,
  onFieldChange,
  onImageConfigChange,
}: CreateComposerFormProps) {
  function handleTextChange<K extends Extract<keyof CreateFormValues, 'topic' | 'targetAudience' | 'goal' | 'stylePreference' | 'personaMode'>>(
    field: K,
  ) {
    return (
      event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
    ) => onFieldChange(field, event.target.value as CreateFormValues[K]);
  }

  function handleNumberChange<K extends Extract<keyof ImageConfigValues, 'bodyPageCap' | 'coverCandidateCount' | 'bodyCandidateCount'>>(
    field: K,
  ) {
    return (event: ChangeEvent<HTMLInputElement>) => {
      onImageConfigChange(field, Number(event.target.value) as ImageConfigValues[K]);
    };
  }

  return (
    <form className={`${classes.panel} ${classes.composerPanel}`} onSubmit={onSubmit}>
      <div className={classes.panelHeader}>
        <div className={classes.panelTitle}>任务输入</div>
        <div className={classes.panelHint}>填写主题、目标人群、目标效果和风格倾向。</div>
      </div>

      <div className={classes.composerLayout}>
        <section className={classes.composerPrimary} aria-label="主题输入区">
          <label className={`${classes.field} ${classes.topicField}`}>
            <span className={classes.fieldLabel}>主题</span>
            <textarea
              className={`${classes.textarea} ${classes.topicTextarea}`}
              value={form.topic}
              onChange={handleTextChange('topic')}
              placeholder="例如：写一篇让人想收藏的职场复盘笔记"
            />
          </label>
        </section>

        <section className={classes.composerSecondary} aria-label="任务参数区">
          <div className={classes.controlGrid}>
            <label className={classes.field}>
              <span className={classes.fieldLabel}>目标人群</span>
              <input
                className={classes.input}
                value={form.targetAudience}
                onChange={handleTextChange('targetAudience')}
                placeholder="例如：3-5 年经验职场人"
              />
            </label>

            <label className={classes.field}>
              <span className={classes.fieldLabel}>目标效果</span>
              <input
                className={classes.input}
                value={form.goal}
                onChange={handleTextChange('goal')}
                placeholder="例如：收藏 / 评论 / 转化"
              />
            </label>

            <label className={classes.field}>
              <span className={classes.fieldLabel}>风格倾向</span>
              <input
                className={classes.input}
                value={form.stylePreference}
                onChange={handleTextChange('stylePreference')}
                placeholder="例如：专业直接、克制、有结论"
              />
            </label>

            <label className={classes.field}>
              <span className={classes.fieldLabel}>图片提供方</span>
              <select
                className={classes.select}
                value={imageConfig.provider}
                onChange={(event) => onImageConfigChange('provider', event.target.value as ImageConfigValues['provider'])}
              >
                {imageProviders.map((provider) => (
                  <option
                    key={provider.provider}
                    value={provider.provider}
                    disabled={!provider.available}
                  >
                    {provider.label}{provider.available ? '' : '（未配置）'}
                  </option>
                ))}
              </select>
            </label>

            <label className={classes.field}>
              <span className={classes.fieldLabel}>图片视觉方向</span>
              <input
                className={classes.input}
                value={imageConfig.visualDirectionOverride}
                onChange={(event) => onImageConfigChange('visualDirectionOverride', event.target.value)}
                placeholder="例如：档案感结论大字 / 杂志感留白"
              />
            </label>

            <label className={classes.field}>
              <span className={classes.fieldLabel}>Persona Mode</span>
              <select
                className={classes.select}
                value={form.personaMode}
                onChange={handleTextChange('personaMode')}
              >
                <option value="balanced">balanced</option>
                <option value="self">self</option>
                <option value="strong_style">strong_style</option>
              </select>
            </label>

            <label className={classes.field}>
              <span className={classes.fieldLabel}>正文页上限</span>
              <input
                className={classes.input}
                type="number"
                min={1}
                max={8}
                value={imageConfig.bodyPageCap}
                onChange={handleNumberChange('bodyPageCap')}
              />
            </label>

            <label className={classes.field}>
              <span className={classes.fieldLabel}>封面候选数</span>
              <input
                className={classes.input}
                type="number"
                min={1}
                max={4}
                value={imageConfig.coverCandidateCount}
                onChange={handleNumberChange('coverCandidateCount')}
              />
            </label>

            <label className={classes.field}>
              <span className={classes.fieldLabel}>正文候选数</span>
              <input
                className={classes.input}
                type="number"
                min={1}
                max={3}
                value={imageConfig.bodyCandidateCount}
                onChange={handleNumberChange('bodyCandidateCount')}
              />
            </label>
          </div>

          <div className={classes.composerActions} aria-label="提交操作区">
            <label className={classes.checkboxCard}>
              <span className={classes.checkboxControl}>
                <input
                  className={classes.checkboxInput}
                  type="checkbox"
                  checked={form.needCoverSuggestion}
                  onChange={(event) => onFieldChange('needCoverSuggestion', event.target.checked)}
                />
                <span className={classes.checkboxText}>需要封面建议</span>
              </span>
              <span className={classes.checkboxHint}>生成时附带封面主副标题建议。</span>
            </label>

            <button
              className={classes.submitButton}
              type="submit"
              disabled={isSubmitting || !form.topic.trim()}
            >
              {isSubmitting ? '生成中...' : '生成'}
            </button>
          </div>
        </section>
      </div>

      {error ? <div className={classes.errorBox}>{error}</div> : null}
    </form>
  );
}
