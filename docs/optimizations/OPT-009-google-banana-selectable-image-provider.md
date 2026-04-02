# OPT-009：可选 Google Banana 图片提供方

> **目标**：在保留现有 OpenAI-compatible 图片生成链路的前提下，新增一条可选的 Google Banana 图片生成路径，并让 `/create` 在创建图片计划时显式选择 provider，保证 plan / job / 历史回放都带完整 provider 上下文。

## 前序依赖

- Phase 6 已完成
- `OPT-008` 图片计划与图片生成子链路已落地
- 现有 `/create` 已具备图片计划、图片 job、图片 SSE 与历史详情回放

## 参考章节

- `docs/CONVENTIONS.md`
- `docs/optimizations/CONVENTIONS.md`
- `docs/optimizations/OPT-008-image-planning-and-generation.md`
- `README.md`
- `/Users/rotas/Documents/my/tools/googleaitest`

## 具体任务

### 1. Provider 与配置收口

- 保留现有 `IMAGE_PROTOCOL=openai`、`IMAGE_API_KEY`、`IMAGE_BASE_URL`、`IMAGE_MODEL` 语义不变。
- 新增 Google Banana 配置：
  - `IMAGE_GOOGLE_CREDENTIALS_PATH`
  - `IMAGE_GOOGLE_PROJECT_ID`
  - `IMAGE_GOOGLE_LOCATION`
  - `IMAGE_GOOGLE_MODEL`
- 新增 `GET /api/image-generation/providers`，返回 provider 列表、可用性、模型名与默认 provider。
- 默认 provider 选择顺序固定为：
  - `openai`
  - `google_vertex`
  - 都不可用时返回 `null`

### 2. 数据模型与接口契约

- `image_plans` 新增：
  - `provider`
  - `provider_model`
- `image_generation_jobs` 新增：
  - `provider`
- `POST /api/generate/outputs/[outputId]/image-plans` 请求体新增 `provider`。
- `PATCH /api/image-plans/[planId]` 不允许修改 provider。
- `POST /api/image-plans/[planId]/jobs` 必须从 plan 继承 provider / provider_model，不接受前端自定义。
- 历史详情、job snapshot、active job 都必须返回 provider 信息。

### 3. Google Banana 执行链路

- Google Banana 固定走 `@google/genai` + Vertex AI。
- 认证方式固定为 service account JSON，不走 ADC 自动发现。
- Google Banana 走 `generateContentStream`，从流式 chunk 提取图片 bytes。
- 候选图策略固定为“单图循环补齐”：
  - 每次调用生成 1 张
  - 循环到 `candidate_count`
  - 中途失败沿用现有 `partial_failed` 语义
- 不新增第二套 worker、queue 或 SSE 基础设施。

### 4. `/create` 与历史回放

- 图片配置区新增 provider 选择器，文案固定为：
  - `OpenAI-Compatible`
  - `Google Banana`
- 页面初始化时读取 provider 列表并回填默认 provider。
- 历史详情加载时，如果当前 output 已有图片计划，前端必须用历史计划的 provider 回填 UI。
- 图片工作区必须展示当前 plan / active job 的 provider 与 model。

### 5. 文档与样例配置

- `README.md` 与 `.env.example` 必须同时补齐 Google Banana 配置说明。
- 明确声明：
  - 现有 OpenAI 图片路径完全保留
  - 这轮不做多 provider 高级参数面板
  - 这轮不做文本链路 provider 化

## 禁止事项 ❌

- 不把 Google Banana 硬塞进现有 OpenAI 图片接口工厂
- 不引入第二套图片 worker / SSE / 实时基础设施
- 不在这轮开放 per-job provider 选择
- 不在这轮新增图片模型面板或高级参数面板
- 不修改文本生成主链路契约

## 验收检查清单 ✅

- [ ] `GET /api/image-generation/providers` 能正确返回 OpenAI-only、Google-only、双 provider、双 provider 都不可用四种状态
- [ ] 创建图片计划时可显式选择 `openai` 或 `google_vertex`
- [ ] plan / job / history detail / job snapshot 都能回放 provider 与 model
- [ ] Google Banana 能从流式响应里提取图片 bytes 并生成真实 asset
- [ ] Google Banana 在 `candidate_count > 1` 时按单图循环补齐
- [ ] Google Banana 中途失败时保留已生成图片，并把 job 标记为 `partial_failed`
- [ ] `/create` 能展示 provider 选择器，并在历史切换时回填已有 plan 的 provider
- [ ] 现有 OpenAI 图片生成链路不回归
- [ ] `npm run lint`、`npm test`、`npm run build` 全部通过
