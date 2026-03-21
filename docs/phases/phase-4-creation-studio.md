# Phase 4：创作工作台（核心交互页）

> **目标**：实现完整的创作生成流程 — 从输入主题到流式输出策略和内容。这是产品的核心页面。

> [!CAUTION]
> **Vercel AI SDK 版本约束**：当前项目使用 `ai@6.x`。请继续使用 `import { streamText, streamObject } from 'ai'` 的写法，**不要**使用已废弃的 `OpenAIStream`、`StreamingTextResponse` 等旧版 API。

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

响应：
  - Content-Type: text/event-stream
  - 前端固定使用 fetch + ReadableStream 消费统一 SSE 事件流
  - 服务端内部可继续使用 streamObject() / streamText()，但对前端暴露的是统一 SSE 协议，不是 AI SDK 原始流
```

**SSE 事件协议**：

```
event: task_understanding
data: TaskUnderstandingResult

event: references
data: {
  reference_mode: 'referenced' | 'zero-shot',
  candidate_count: number,
  selected_references: Array<{
    sample_id: string,
    title: string,
    similarity: number,
    reference_type: 'title' | 'structure' | 'visual' | 'tone',
    reason: string
  }>
}

event: strategy_snapshot
data: 部分策略对象   // 最后一个 snapshot 必须是完整策略对象

event: generation_delta
data: { text: string }

event: generation_complete
data: {
  titles: string[],
  openings: string[],
  body_versions: string[],        // Phase 4 v1 固定 1 个
  cta_versions: string[],
  cover_copies: Array<{ main: string, sub?: string }>,
  hashtags: string[],
  first_comment: string,          // Phase 4 v1 固定 1 条
  image_suggestions: string
}

event: error
data: { message: string, step: 'understanding' | 'searching' | 'strategizing' | 'generating' | 'persisting' }

event: done
data: { task_id: string }
```

**实现流程**：

```
Step 1: 保存任务到 generation_tasks 表
        → status = 'pending'

Step 2: 复用 Phase 3 的 understandTask() / 对应任务理解链路
        → status = 'understanding'
        → 完成后发出 task_understanding 事件

Step 3: 复用 Phase 3 的 retrieveTaskReferences() / 对应检索链路
        → status = 'searching'
        → 判定 reference_mode
        → 完成 title | structure | visual | tone 四类用途分配
        → 写入 task_references
        → 发出 references 事件

Step 4: 调用 LLM → streamObject(strategySchema)
        → status = 'strategizing'
        → 将阶段性结果重编码为 strategy_snapshot 事件
        → 最终结果写入 task_strategy（含 cta_strategy）

Step 5: 调用 LLM → streamText()
        → status = 'generating'
        → 将文本增量重编码为 generation_delta 事件
        → 按固定模板解析最终文本
        → 写入 generation_outputs
        → 发出 generation_complete 事件

Step 6: 回写 generation_tasks.reference_mode + status = 'completed'
        → 发出 done 事件

任一步骤失败：
        → status = 'failed'
        → 发出 error 事件
```

> ⚠️ **关键约束**：Step 4 用 `streamObject()`，Step 5 用 `streamText()`。它们只用于服务端内部生成，不直接暴露给前端。

### 2. Agent 实现

**Strategy Agent** (`src/agents/strategy.ts`，在 Phase 3 的任务理解 / 检索链路上继续扩展)：
- Phase 4 必须复用现有 `understandTask()` / `retrieveTaskReferences()` 作为任务理解与检索真源，不要在 `/api/generate` 里复制一套新的检索逻辑
- System Prompt 按 8.3 节策略器约束
- 参考透明：策略必须注明参考了哪篇样本
- Zero-Shot 模式下基于通用爆款逻辑输出策略
- 产出完整 `strategySchema`，包含 `cta_strategy`
- `temperature=0.3`

**Generation Agent** (`src/agents/generation.ts`)：
- System Prompt 按 8.3 节生成器约束
- **防洗稿指令必须写入 System Prompt**
- 输出必须遵循固定章节模板，便于服务端解析并写入 `generation_outputs`
- 标题 5 个、开头 3 个、正文 1 个、CTA 2 个、封面文案 2 套、标签 5~10 个、首评 1 条、配图建议 1 份
- 正文不超过 800 字
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
- 正文（1版）
- CTA（2个）
- 封面文案（2套）
- 标签建议
- 首评建议（1条）
- 配图建议（1份）

前端固定使用 `fetch + ReadableStream` 消费 SSE：
- 中间栏消费 `task_understanding`、`references`、`strategy_snapshot`
- 右侧栏消费 `generation_delta`，并在 `generation_complete` 到达后切换为结构化结果视图
- 不使用 `useCompletion`

### 4. 历史任务 API

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/generate/[taskId]` | 查看历史生成任务详情，最少返回 `{ task, strategy, references, outputs, reference_mode, feedback? }` |
| `GET` | `/api/generate/history` | 生成任务列表（分页），列表项最少包含 `id, topic, status, reference_mode, created_at` |

### 5. 上下文精准裁剪逻辑

在构建 Generation Agent 的 prompt 时，按用途只注入对应维度：
- 标题参考 → `title_pattern_explanation` + 原标题
- 结构参考 → `structure_explanation` + `opening_explanation`
- 封面参考 → `cover_explanation`
- 语气参考 → `reasoning_summary` + 原标题

### 6. 固定文本模板与持久化映射

`streamText()` 最终文本必须严格遵循以下章节顺序，服务端据此解析并写入 `generation_outputs`：

```markdown
## 标题候选
1. ...
2. ...
3. ...
4. ...
5. ...

## 开头候选
1. ...
2. ...
3. ...

## 正文
...

## CTA 候选
1. ...
2. ...

## 封面文案
1. 主标题：...
   副标题：...
2. 主标题：...
   副标题：...

## 标签建议
#标签1
#标签2

## 首评建议
...

## 配图建议
...
```

字段映射固定为：
- `titles` ← 标题候选 5 条
- `openings` ← 开头候选 3 条
- `body_versions` ← 正文 1 条
- `cta_versions` ← CTA 2 条
- `cover_copies` ← 2 组 `{ main, sub }`
- `hashtags` ← 标签建议 5~10 条
- `first_comment` ← 首评建议 1 条
- `image_suggestions` ← 配图建议 1 条

### 7. 数据契约补充

Phase 4 正式实现前，需要补两条 forward-only migration：
- `generation_tasks.reference_mode`
- `task_strategy.cta_strategy`

不要修改已有历史 migration 文件。

## 禁止事项 ❌

- ❌ 不要实现 Dashboard 页面（Phase 5）
- ❌ 不要实现样本库页面（Phase 5）
- ❌ 不要实现风格画像页面（Phase 5）
- ❌ 不要实现策略调整后重新生成的功能（Phase 5 或后续迭代）
- ❌ 不要用 BullMQ 处理生成任务 — 必须在 API Route 中直接流式响应
- ❌ 不要在 Server Component 中使用 React hooks

## 验收检查清单 ✅

- [ ] 创作工作台页面能正常加载，三栏布局正确
- [ ] 输入主题后点击生成，前端按 `task_understanding → references → strategy_snapshot → generation_delta/generation_complete → done` 的顺序消费事件
- [ ] 策略区以结构化方式展示（不是原始 JSON）
- [ ] 右侧栏以打字机效果流式输出内容，并在结束后落成结构化结果视图
- [ ] 当库中有匹配样本时，展示参考了哪些样本
- [ ] 当库中无匹配样本时，提示"Zero-Shot 模式"并正常生成
- [ ] 生成结果正确保存到数据库（generation_tasks + task_strategy + generation_outputs + task_references）
- [ ] `generation_tasks.status` 按 `pending → understanding → searching → strategizing → generating → completed` 流转；失败时为 `failed`
- [ ] `reference_mode` 被保存并可从历史任务接口读取
- [ ] `task_references.reference_type` 与 `title | structure | visual | tone` 保持一致
- [ ] 历史任务 API 能查看过去的生成记录
- [ ] 生成的正文不超过 800 字
- [ ] 标题生成了 5 个不同方向的版本
- [ ] 最终文本遵循固定章节模板，服务端能稳定解析到 `generation_outputs`
