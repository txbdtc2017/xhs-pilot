# Phase 2：样本录入 + LLM 分析管线

> **目标**：用户能录入样本，系统自动完成 LLM 分析（文本 + 视觉）并入库。这是数据沉淀闭环。

## 前序依赖

Phase 1 完成（数据库就绪、Docker 运行正常、核心库可用）

## 参考章节

- `implementation_plan.md` 第四章 工作流 A（样本沉淀）
- `implementation_plan.md` 第七章 7.1-7.2（Ingestion Agent + Analysis Agent）
- `implementation_plan.md` 第八章 8.1.1-8.1.2（分析 Schema + 视觉分析 Schema）
- `implementation_plan.md` 第八章 8.3（Agent Prompt 约束 — Analysis Agent）
- `implementation_plan.md` 第十四章 14.4（BullMQ 异步任务）

## 具体任务

### 1. 样本 CRUD API

实现以下 API（参考 8.2 节 API 契约）：

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/samples` | 创建样本（接收 FormData：标题、正文、图片、标签等） |
| `GET` | `/api/samples` | 样本列表（基础版，支持分页） |
| `GET` | `/api/samples/[id]` | 样本详情 |
| `PATCH` | `/api/samples/[id]` | 更新样本（手动修正标签等） |
| `DELETE` | `/api/samples/[id]` | 删除样本 |

- 图片上传使用 `src/lib/storage.ts` 的 LocalStorage 实现
- `POST` 成功后自动向 BullMQ 发送 `sample-analyze` 任务
- `source_url` 重复时返回 409 错误
- 本阶段不实现 `content_hash` 去重，仍只依赖 `source_url`

### 2. BullMQ Worker 实现

在 `src/worker.ts` 中实现两个队列处理器：

**`sample-analyze` 队列**：
1. 将 `sample.status` 从 `pending` 更新为 `analyzing`
2. 调用 LLM 分析样本文本 → 输出符合 `analysisSchema` 的 JSON
3. 如果有图片，通过 `storage.getBuffer(storage_key)` 读取封面图，再调用多模态模型分析封面 → 输出符合 `visualAnalysisSchema` 的 JSON（含 `extracted_text`）
4. 将分析结果写入 `sample_analysis` + `sample_visual_analysis` 表
5. 更新 `sample.status` 为 `embedding`
6. 分析完成后自动向 `sample-embed` 队列发送任务

**`sample-embed` 队列**：
1. 为样本生成 embedding（title + body 拼接后生成一个 embedding）
2. 写入 `sample_embeddings` 表
3. 更新 `sample.status` 为 `completed`

### 3. Agent 实现

**Ingestion Agent** (`src/agents/ingestion.ts`)：
- 文本清洗（去多余空格、特殊字符）
- 图片存储并记录顺序，同时保存 `storage_key`
- 区分封面图和配图（第一张为封面）
- 不做 OCR，不调用任何 LLM

**Analysis Agent** (`src/agents/analysis.ts`)：
- System Prompt 按 8.3 节约束编写
- 使用 `generateObject({ model, schema: analysisSchema, prompt })` 输出结构化分析结果
- 使用 `generateObject({ model, schema: visualAnalysisSchema, prompt })` 做视觉分析（含端到端 OCR）
- `temperature=0`

### 4. Schema 文件

按 8.1.1 和 8.1.2 创建：
- `src/agents/schemas/analysis.ts`
- `src/agents/schemas/visual-analysis.ts`

### 4.1 数据库补齐迁移

- 如果当前数据库来自 Phase 1 旧骨架，需要新增 forward-only migration：
  - `samples.status` 对齐为 `pending | analyzing | embedding | completed | failed`
  - `sample_images` 增加 `storage_key`
  - `sample_visual_analysis` 增加 `extracted_text`
  - `sample_embeddings` 去掉 `embedding_type`，只保留一份 `title + body` 联合向量
- 不要修改已有的 Phase 1 历史迁移文件

### 5. Prompt 文件

- `src/agents/prompts/analysis.ts` — 分析器的 System Prompt

### 6. 分析状态 SSE 端点

- `GET /api/samples/[id]/status` — 返回 SSE 流，推送分析进度（pending → analyzing → embedding → completed）

## 禁止事项 ❌

- ❌ 不要实现检索功能（Phase 3 的事）
- ❌ 不要实现创作生成功能
- ❌ 不要实现风格画像的自动归纳
- ❌ 不要生成多种类型的 embedding（Phase 2 只生成一种：title+body 拼接）
- ❌ 不要实现前端页面（本阶段只做 API + Worker）
- ❌ 不要引入独立的 OCR 服务（GPT-4o Vision 端到端）
- ❌ 不要实现内容级去重（`content_hash`），Phase 1/2 仅依靠 `source_url` 去重

## 验收检查清单 ✅

- [ ] 通过 API 能成功创建样本（含图片上传）
- [ ] 创建样本后 BullMQ 自动触发分析任务
- [ ] Worker 正确调用 LLM，分析结果符合 Schema 并入库
- [ ] `sample_analysis` 表有正确的枚举标签和自然语言摘要
- [ ] `sample_visual_analysis` 表有 `extracted_text`（OCR 结果）
- [ ] `sample_embeddings` 表有 embedding 向量
- [ ] 样本状态从 `pending` → `analyzing` → `embedding` → `completed` 正确流转
- [ ] `source_url` 重复录入返回 409
- [ ] SSE 端点能推送分析进度
- [ ] LLM API 调用失败时自动重试（最多 3 次）
- [ ] 错误不会导致 Worker 崩溃
