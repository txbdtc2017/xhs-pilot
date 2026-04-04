'use client'

import type { ChangeEvent, FormEvent } from 'react';

import type { CreateFormValues } from './models';

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
  isSubmitting: boolean;
  error: string | null;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onFieldChange: <K extends keyof CreateFormValues>(field: K, value: CreateFormValues[K]) => void;
}

export function CreateComposerForm({
  classes,
  form,
  isSubmitting,
  error,
  onSubmit,
  onFieldChange,
}: CreateComposerFormProps) {
  function handleTextChange<K extends Extract<keyof CreateFormValues, 'topic' | 'targetAudience' | 'goal' | 'stylePreference' | 'personaMode'>>(
    field: K,
  ) {
    return (
      event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
    ) => onFieldChange(field, event.target.value as CreateFormValues[K]);
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
