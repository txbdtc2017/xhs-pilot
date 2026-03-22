import assert from 'node:assert/strict';
import test from 'node:test';

import { parseGenerationOutput } from './generation';

const fullTemplate = `## 标题候选
1. 标题一
2. 标题二
3. 标题三
4. 标题四
5. 标题五

## 开头候选
1. 开头一
2. 开头二
3. 开头三

## 正文
这是正文第一段。
这是正文第二段。

## CTA 候选
1. CTA 一
2. CTA 二

## 封面文案
1. 主标题：封面主一
   副标题：封面副一
2. 主标题：封面主二
   副标题：封面副二

## 标签建议
#标签一
#标签二
#标签三

## 首评建议
首评正文

## 配图建议
配图建议正文`;

test('parseGenerationOutput maps the fixed markdown template into structured outputs', () => {
  const result = parseGenerationOutput(fullTemplate);

  assert.deepEqual(result.titles, ['标题一', '标题二', '标题三', '标题四', '标题五']);
  assert.deepEqual(result.openings, ['开头一', '开头二', '开头三']);
  assert.deepEqual(result.body_versions, ['这是正文第一段。\n这是正文第二段。']);
  assert.deepEqual(result.cta_versions, ['CTA 一', 'CTA 二']);
  assert.deepEqual(result.cover_copies, [
    { main: '封面主一', sub: '封面副一' },
    { main: '封面主二', sub: '封面副二' },
  ]);
  assert.deepEqual(result.hashtags, ['#标签一', '#标签二', '#标签三']);
  assert.equal(result.first_comment, '首评正文');
  assert.equal(result.image_suggestions, '配图建议正文');
});

test('parseGenerationOutput rejects incomplete templates', () => {
  assert.throws(
    () => parseGenerationOutput(`## 标题候选\n1. 只有标题`),
    /缺少必要章节：开头候选/,
  );
});
