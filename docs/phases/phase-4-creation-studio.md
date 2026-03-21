# Phase 4：创作工作台（核心交互页）

> **目标**：实现完整的创作生成流程 — 从输入主题到流式输出策略和内容。这是产品的核心页面。

> [!CAUTION]
> **Vercel AI SDK 版本约束**：请严格使用 `ai` 包 v3.1+ 的最新写法（`import { streamText, streamObject } from 'ai'`）。**不要**使用已废弃的 `OpenAIStream`、`StreamingTextResponse` 等旧版 API。

## 前序依赖

Phase 3 完成（检索层可用，Query 重写和相似度搜索正常工作）

## 参考章节

- `implementation_plan.md` 第四章 工作流 B（创作生成 Step 1-6）
- `implementation_plan.md` 第五章 5.4（创作工作台 UI + RSC/Client 约束）
- `implementation_plan.md` 第七章 7.4-7.5（Strategy Agent + Generation Agent）
- `implementation_plan.md` 第八章 8.1.4（策略 Schema）
- `implementation_plan.md` 第八章 8.2（API 契约 — 创作生成部分）
- `implementation_plan.md` 第八章 8.3（Prompt 约束 — 策略器 + 生成器）
- `implementation_plan.md` 第八章 8.4（streamObject vs streamText）

## 具体任务

### 1. 策略 + 生成 API（流式响应）

**`POST /api/generate`** — 这是整个系统最核心的 API：

```
请求体：{ topic, target_audience?, goal?, style_preference?, persona_mode?, style_profile_id?, need_cover_suggestion? }

响应：ReadableStream，依次流式输出四个阶段
```

**实现流程**：

```
Step 1: 保存任务到 generation_tasks 表

Step 2: 调用 LLM → streamObject(taskUnderstandingSchema)
        → 流式输出任务理解
        → 提取 search_filters + rewritten_query

Step 3: 调用 searchSimilarSamples()（Phase 3 已实现）
        → 检查是否 Zero-Shot
        → 按用途裁剪上下文（标题参考只喂标题分析，结构参考只喂结构分析）
        → 流式输出参考样本列表

Step 4: 调用 LLM → streamObject(strategySchema)
        → 流式输出策略 JSON（前端实时渲染策略树）

Step 5: 调用 LLM → streamText()
        → 流式输出标题、正文、CTA 等内容（打字机效果）

Step 6: 保存结果到 task_strategy + task_references + generation_outputs 表
```

> ⚠️ **关键约束**：Step 4 用 `streamObject()`，Step 5 用 `streamText()`。绝对不要搞混。

### 2. Agent 实现

**Strategy Agent** (`src/agents/strategy.ts`，扩展 Phase 3 的任务理解部分)：
- System Prompt 按 8.3 节策略器约束
- 参考透明：策略必须注明参考了哪篇样本
- Zero-Shot 模式下基于通用爆款逻辑输出策略
- `temperature=0.3`

**Generation Agent** (`src/agents/generation.ts`)：
- System Prompt 按 8.3 节生成器约束
- **防洗稿指令必须写入 System Prompt**
- 标题生成 5 个，正文不超过 800 字
- `temperature=0.7`

创建 Prompt 文件：
- `src/agents/prompts/strategy.ts`
- `src/agents/prompts/generation.ts`

创建 Schema 文件：
- `src/agents/schemas/strategy.ts`

### 3. 创作工作台前端页面

**`src/app/create/page.tsx`** — **整页 `"use client"`**

三栏布局（按 5.4 节设计）：

| 左侧 | 中间 | 右侧 |
|------|------|------|
| 任务输入表单 | Agent 策略区（流式步骤展示） | 生成结果区 |

**左侧栏**：
- 主题（必填）、目标人群、目标效果、风格倾向、persona_mode 选择
- [生成] 按钮

**中间栏**（核心交互）：
- Step 1: 任务理解 → 流式展示分析结果
- Step 2: 样本检索 → 展示找到的参考样本列表
- Step 3: 策略制定 → 流式渲染策略 JSON 为可读卡片
- Step 4: 生成中 → 进度指示

**右侧栏**：
- 标题候选（5个）
- 开头（3个）
- 正文
- 封面文案
- 标签建议
- 首评建议

使用 Vercel AI SDK 的 `useCompletion` 或自定义 fetch + ReadableStream 消费流式响应。

### 4. 历史任务 API

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/generate/[taskId]` | 查看历史生成任务详情 |
| `GET` | `/api/generate/history` | 生成任务列表（分页） |

### 5. 上下文精准裁剪逻辑

在构建 Generation Agent 的 prompt 时，按用途只注入对应维度：
- 标题参考 → `title_pattern_explanation` + 原标题
- 结构参考 → `structure_explanation` + `opening_explanation`
- 封面参考 → `cover_explanation`

## 禁止事项 ❌

- ❌ 不要实现 Dashboard 页面（Phase 5）
- ❌ 不要实现样本库页面（Phase 5）
- ❌ 不要实现风格画像页面（Phase 5）
- ❌ 不要实现策略调整后重新生成的功能（Phase 5 或后续迭代）
- ❌ 不要用 BullMQ 处理生成任务 — 必须在 API Route 中直接流式响应
- ❌ 不要在 Server Component 中使用 React hooks

## 验收检查清单 ✅

- [ ] 创作工作台页面能正常加载，三栏布局正确
- [ ] 输入主题后点击生成，中间栏依次流式展示四个步骤
- [ ] 策略区以结构化方式展示（不是原始 JSON）
- [ ] 右侧栏以打字机效果流式输出内容
- [ ] 当库中有匹配样本时，展示参考了哪些样本
- [ ] 当库中无匹配样本时，提示"Zero-Shot 模式"并正常生成
- [ ] 生成结果正确保存到数据库（generation_tasks + task_strategy + generation_outputs + task_references）
- [ ] 历史任务 API 能查看过去的生成记录
- [ ] 生成的正文不超过 800 字
- [ ] 标题生成了 5 个不同方向的版本
