# Phase 3：检索层

> **目标**：实现完整的两阶段检索（结构化过滤 + 向量排序），含 Zero-Shot 降级。这是连接"沉淀"和"生成"的桥梁。

## 前序依赖

Phase 2 完成（样本数据库中已有分析结果和 embedding）

## 参考章节

- `implementation_plan.md` 第三章 3.4（检索决策层）
- `implementation_plan.md` 第八章 8.3（Strategy Agent Prompt 约束）
- `implementation_plan.md` 第八章 8.5（pgvector 混合检索约束）
- `implementation_plan.md` 第四章 工作流 B Step 2-3（任务理解 + 参考检索）
- `implementation_plan.md` 第八章 8.1.3（任务理解 + Query 重写 Schema）

## 具体任务

### 1. 任务理解 + Query 重写

**`src/agents/strategy.ts`**（部分实现，本阶段只做 Step 2）：

- 接收用户的创作任务输入
- 调用 LLM + `taskUnderstandingSchema` → 输出任务理解 + 结构化检索参数
- Query 重写：将自然语言转为 `search_filters` + `rewritten_query`
- System Prompt 按 8.3 节 Strategy Agent 约束编写
- Prompt 放在 `src/agents/prompts/strategy.ts`，不要把 prompt 内联在实现里

创建 Schema 文件：
- `src/agents/schemas/task-understanding.ts`

创建 Prompt 文件：
- `src/agents/prompts/strategy.ts`

### 2. Query Embedding Bridge

- `rewritten_query` 必须先通过 `llmEmbedding` 生成 `taskEmbedding`
- 然后再调用 `searchSimilarSamples()`
- 这一步不新增公共 API，只是补齐检索链路中间步骤
- `is_reference_allowed` 由系统侧补充为过滤条件，不从 `taskUnderstandingSchema` 生成

### 3. 混合检索函数

**`src/lib/db.ts`** 中新增 `searchSimilarSamples()` 函数：

```
输入：
  - taskEmbedding: number[]（由 rewritten_query 生成的 embedding）
  - filters: { track?, content_type?: string[], title_pattern_hints?: string[], is_reference_allowed?: boolean }
  - limit: number（默认 20）
  - similarityThreshold: number（默认 0.6）

处理：
  1. 第一阶段：SQL WHERE 按 filters 过滤 sample_analysis 表
  2. JOIN sample_embeddings 表
  3. 按 embedding <=> $vector 排序
  4. 计算相似度 = 1 - distance

输出：
  - SimilarSample[]（含 sample 基本信息 + 相似度分数 + 分析摘要）
```

**必须遵守 8.5 节的实现约束**：
- 参数化查询（`$1, $2...`）
- 向量序列化为字符串
- 正确的余弦距离计算
- `searchSimilarSamples()` 只返回排序后的 `SimilarSample[]`，不负责 Zero-Shot 判断或参考用途分配

### 4. Zero-Shot 降级逻辑

由调用方包装检索结果，而不是放进 `searchSimilarSamples()`：
- 如果结果为空或最高相似度 < 阈值 → 判定 `reference_mode: 'zero-shot'`
- 正常情况 → 判定 `reference_mode: 'referenced'`
- Phase 3 只需把这个判断逻辑封装在调用链中，供 Phase 4 的 `generate` 流程复用

### 5. 自动化测试与 Seed 验证

- 为任务理解、query embedding、`searchSimilarSamples()`、Zero-Shot 判断编写自动化测试
- 用 seed 数据验证检索命中是否合理
- 不新增公开测试 API 路由

## 禁止事项 ❌

- ❌ 不要实现策略制定和内容生成（Phase 4 的事）
- ❌ 不要实现前端页面
- ❌ 不要实现复杂的 Rerank 逻辑（简单相似度排序即可）
- ❌ 不要实现多样性控制（"避免总引用同几篇"是 Phase 2+ 的优化）
- ❌ 不要引入互动数据加权（Phase 2+ 的事）
- ❌ 不要新增临时公开测试 API（如 `/api/search/test`）
- ❌ 不要在 Phase 3 产出 `reference_type` 或参考用途分配结果

## 验收检查清单 ✅

- [ ] Query 重写能将自然语言转为结构化检索参数
- [ ] `rewritten_query` 能成功生成 embedding
- [ ] `searchSimilarSamples()` 能正确执行混合查询（SQL 过滤 + 向量排序）
- [ ] 相似度分数合理（0~1 范围）
- [ ] 调用方能根据检索结果正确判断 `reference_mode: 'zero-shot' | 'referenced'`
- [ ] SQL 查询使用参数化，无注入风险
- [ ] 向量参数正确序列化
- [ ] 用 seed 数据测试：搜索"职场"主题能找到职场样本
