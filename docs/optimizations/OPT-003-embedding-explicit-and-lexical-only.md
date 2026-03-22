# OPT-003：Embedding 显式配置与 Lexical-only 兜底

> **目标**：让 XHS Pilot 在未配置 embedding provider 时仍可正常完成样本沉淀与创作检索，同时收口 embedding 配置语义，避免运行时隐式回退造成的混淆与失败。

## 前序依赖

Phase 6 完成，且 `OPT-001`、`OPT-002` 已落地当前环境变量与 provider 基线。

## 参考章节

- `docs/CONVENTIONS.md`
- `docs/optimizations/CONVENTIONS.md`
- `docs/implementation_plan.md`
- `docs/phases/phase-3-retrieval.md`
- `docs/phases/phase-6-productization.md`
- `README.md`

## 具体任务

### 1. Embedding 配置与运行模式收口

- 去掉 `EMBEDDING_*` 对 `LLM_*` 的隐式回退。
- 运行模式固定为：
  - `hybrid`：显式配置可用的 `EMBEDDING_*`
  - `lexical-only`：未配置 embedding，允许正常运行
  - `misconfigured`：用户显式提供了 embedding 相关字段，但配置不完整，不做静默降级
- `EMBEDDING_BASE_URL` 保持可选；未提供时按 OpenAI-compatible 默认基址处理。
- 提供统一的运行模式解析入口，供 worker、检索链路、健康检查与 UI 复用。

### 2. 样本分析状态机调整

- `lexical-only` 模式下，样本分析完成后直接进入 `completed`，不再进入 `embedding` 阶段。
- `hybrid` 模式下继续沿用 `pending -> analyzing -> embedding -> completed`。
- 若运行模式为 `misconfigured`，样本分析链路应显式报错，不允许静默进入 `lexical-only`。
- 是否拥有向量由 `sample_embeddings` 是否存在表达，不再依赖 `samples.status`。

### 3. 检索链路新增 lexical-only 分支

- 保留现有 `taskUnderstanding` 输出：`search_filters + rewritten_query`。
- `hybrid` 模式继续使用结构化过滤 + pgvector 排序。
- `lexical-only` 模式新增轻量词法检索函数，返回与现有 `SimilarSample[]` 兼容的候选结构。
- 检索字段至少覆盖：
  - `samples.title`
  - `samples.body_text`
  - `sample_visual_analysis.extracted_text`
  - `sample_analysis.reasoning_summary`
  - `sample_analysis.title_pattern_explanation`
  - `sample_analysis.opening_explanation`
  - `sample_analysis.structure_explanation`
  - `sample_visual_analysis.cover_explanation`
- v1 采用轻量关键词方案，不引入 SQLite FTS5 或重型外部搜索组件：
  - 从 `rewritten_query` 与 `topic` 中提取关键词
  - 英文按词切分
  - 中文保留原短语并补充双字切分
  - 依据字段权重与命中覆盖率排序
- 过滤策略按以下顺序逐层放宽：
  1. `is_reference_allowed + track + content_type + title_pattern_hints`
  2. 放宽 `title_pattern_hints`
  3. 放宽 `content_type`
  4. 放宽 `track`
  5. 仍无可用候选则进入 `zero-shot`

### 4. 模式展示与运维入口

- 创作工作台明确展示当前检索模式与限制说明。
- SSE / API 返回的检索结果中增加当前检索模式信息，便于前端展示。
- 健康检查或等效状态入口中增加当前检索模式与原因说明。
- 新增手动回填入口，例如 `npm run embeddings:backfill`：
  - 仅在 `hybrid` 模式下可运行
  - 只为缺失向量的已完成样本补跑 embedding
  - 不自动扫描，不在启动时触发

## 禁止事项 ❌

- ❌ 不要引入 SQLite FTS5 或独立搜索引擎
- ❌ 不要把 lexical-only 做成新的复杂检索子系统
- ❌ 不要新增本地 embedding sidecar 或模型部署编排
- ❌ 不要在本轮调整提示词、检索用途分配逻辑或样本详情页关系网络产品定位
- ❌ 不要重新引入 `EMBEDDING_* -> LLM_*` 的隐式共享

## 验收检查清单 ✅

- [ ] 未配置 `EMBEDDING_*` 时应用仍可正常运行
- [ ] 未配置 `EMBEDDING_*` 时样本分析完成后直接进入 `completed`
- [ ] 未配置 `EMBEDDING_*` 时创作链路进入 `lexical-only`
- [ ] `lexical-only` 检索可返回兼容 `SimilarSample[]` 的候选
- [ ] `lexical-only` 支持按约定顺序放宽结构化过滤
- [ ] 无有效候选时会进入 `zero-shot`
- [ ] 显式配置 `EMBEDDING_*` 时继续走 `hybrid`
- [ ] embedding 配置不完整时会标记为 `misconfigured`，不静默降级
- [ ] 创作页可见当前检索模式
- [ ] 已提供手动 backfill 命令，仅补齐缺失 embedding
- [ ] `.env.example`、README、实现文档已同步为新语义
