# Phase 3：检索层

> **目标**：实现完整的两阶段检索（结构化过滤 + 向量排序），含 Zero-Shot 降级。这是连接"沉淀"和"生成"的桥梁。

## 前序依赖

Phase 2 完成（样本数据库中已有分析结果和 embedding）

## 参考章节

- `implementation_plan.md` 第三章 3.4（检索决策层）
- `implementation_plan.md` 第八章 8.5（pgvector 混合检索约束）
- `implementation_plan.md` 第四章 工作流 B Step 2-3（任务理解 + 参考检索）
- `implementation_plan.md` 第八章 8.1.3（任务理解 + Query 重写 Schema）

## 具体任务

### 1. 任务理解 + Query 重写

**`src/agents/strategy.ts`**（部分实现，本阶段只做 Step 2）：

- 接收用户的创作任务输入
- 调用 LLM + `taskUnderstandingSchema` → 输出任务理解 + 结构化检索参数
- Query 重写：将自然语言转为 `search_filters` + `rewritten_query`

创建 Schema 文件：
- `src/agents/schemas/task-understanding.ts`

### 2. 混合检索函数

**`src/lib/db.ts`** 中新增 `searchSimilarSamples()` 函数：

```
输入：
  - taskEmbedding: number[]（由 rewritten_query 生成的 embedding）
  - filters: { track?, content_type?, is_reference_allowed? }
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

### 3. Zero-Shot 降级逻辑

在检索函数返回结果后判断：
- 如果结果为空或最高相似度 < 阈值 → 返回 `{ mode: 'zero-shot', samples: [] }`
- 正常情况 → 返回 `{ mode: 'referenced', samples: [...] }`

### 4. 用途分配（可选，简化版）

Phase 3 的用途分配做简化版：
- 按相似度排序取前 5 篇
- 前 2 篇标记为"标题参考"，中间 2 篇"结构参考"，最后 1 篇"封面参考"
- Phase 4 中由 Strategy Agent 做更精准的分配

### 5. 检索测试 API

创建一个临时测试端点（Phase 4 完成后可删除）：

`POST /api/search/test` — 接收 `{ query: string, filters: {} }` → 返回检索结果

用于验证检索质量。

## 禁止事项 ❌

- ❌ 不要实现策略制定和内容生成（Phase 4 的事）
- ❌ 不要实现前端页面
- ❌ 不要实现复杂的 Rerank 逻辑（简单相似度排序即可）
- ❌ 不要实现多样性控制（"避免总引用同几篇"是 Phase 2+ 的优化）
- ❌ 不要引入互动数据加权（Phase 2+ 的事）

## 验收检查清单 ✅

- [ ] Query 重写能将自然语言转为结构化检索参数
- [ ] `searchSimilarSamples()` 能正确执行混合查询（SQL 过滤 + 向量排序）
- [ ] 测试 API 返回的结果与预期赛道匹配
- [ ] 相似度分数合理（0~1 范围）
- [ ] 当库中无匹配样本时，正确返回 `zero-shot` 模式
- [ ] SQL 查询使用参数化，无注入风险
- [ ] 向量参数正确序列化
- [ ] 用 seed 数据测试：搜索"职场"主题能找到职场样本
