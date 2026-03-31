# OPT-008：图片计划与图片生成子链路

> **目标**：在现有文本创作链路之上新增独立的图片计划与图片生成子链路，让创作工作台从“文本输出 + 图片建议”升级为“文本输出 + 可确认的图片计划 + 可回看的真实图片资产”，同时保持文本 SSE 主链路稳定，不把图片执行挤进现有 `/api/generate`。

## 前序依赖

Phase 6 已完成，当前主线已经具备：

- 创作工作台 `/create`
- 文本生成 API 与 SSE 主链路
- 历史任务详情与列表
- 样本图片上传、本地存储、图片读取与删除
- 样本视觉分析与封面风格抽取
- BullMQ / Redis 慢任务基础设施

本轮属于 Phase 6 之后的多步骤优化，执行时以前端当前工作台、文本生成状态机、本地存储与队列基线为准。

## 参考章节

- `docs/CONVENTIONS.md`
- `docs/optimizations/CONVENTIONS.md`
- `docs/implementation_plan.md`
- `docs/phases/phase-4-creation-studio.md`
- `README.md`

## 具体任务

### 0. 产品边界与流程收口

- 保留现有文本创作主链路：
  - `POST /api/generate` 继续只负责任务理解、参考检索、策略生成、正文输出与文本结果持久化。
  - 不把图片计划和真实出图直接塞进当前文本 SSE 请求周期。
- 图片能力固定拆成两段：
  - **图片计划**：同步生成，用户可见、可确认、可轻量覆盖
  - **图片生成**：异步执行，独立任务、独立 SSE、独立历史状态
- 固定整体流程为：
  - 文本生成完成
  - 用户手动触发图片计划
  - 用户确认图片计划
  - 启动异步图片生成任务
  - 前端通过单独 SSE 查看图片进度
  - 历史任务按文本输出版本查看对应图片计划与已选图片
- 图片计划与图片资产必须绑定 `generation_outputs.id`，不绑定裸 `generation_tasks.id`。
- 第一版生成图默认不进入样本库，不参与后续视觉分析、检索或风格判断，避免系统自我强化。

### 0.1 实施顺序与核心文件清单

- 必须按以下顺序实施，不要并行跳步：
  1. 迁移与 repository
  2. `IMAGE_*` provider 与 capability
  3. 图片计划 agent 与计划接口
  4. 图片任务队列、worker、job API 与图片 SSE
  5. `/create` 页状态与 UI
  6. 历史详情扩展、README、`.env.example`、验证
- 本轮允许新增的核心文件路径固定为：
  - `migrations/018_create-image-plans.sql`
  - `migrations/019_create-image-plan-pages.sql`
  - `migrations/020_create-image-generation-jobs.sql`
  - `migrations/021_create-image-assets.sql`
  - `migrations/022_create-image-job-events.sql`
  - `migrations/023_add-image-generation-constraints.sql`
  - `src/agents/image-planning.ts`
  - `src/agents/image-generation.ts`
  - `src/agents/prompts/image-planning.ts`
  - `src/agents/prompts/image-generation.ts`
  - `src/agents/schemas/image-plan.ts`
  - `src/app/api/image-generation/capability.ts`
  - `src/app/api/image-generation/capability.test.ts`
  - `src/app/api/image-generation/repository.ts`
  - `src/app/api/image-generation/repository.test.ts`
  - `src/app/api/generate/outputs/[outputId]/image-plans/route.ts`
  - `src/app/api/generate/outputs/[outputId]/image-plans/route.test.ts`
  - `src/app/api/image-plans/[planId]/route.ts`
  - `src/app/api/image-plans/[planId]/route.test.ts`
  - `src/app/api/image-plans/[planId]/jobs/route.ts`
  - `src/app/api/image-plans/[planId]/jobs/route.test.ts`
  - `src/app/api/image-jobs/[jobId]/route.ts`
  - `src/app/api/image-jobs/[jobId]/route.test.ts`
  - `src/app/api/image-jobs/[jobId]/events/route.ts`
  - `src/app/api/image-jobs/[jobId]/events/route.test.ts`
  - `src/app/api/image-assets/[assetId]/select/route.ts`
  - `src/app/api/image-assets/[assetId]/select/route.test.ts`
  - `src/app/create/image-api.ts`
  - `src/app/create/image-api.test.ts`
  - `src/app/create/image-workbench.tsx`
  - `src/worker-image-jobs.ts`
  - `src/worker-image-jobs.test.ts`
- 本轮允许修改的核心文件路径固定为：
  - `.env.example`
  - `README.md`
  - `src/lib/llm.ts`
  - `src/lib/llm.test.ts`
  - `src/queues/index.ts`
  - `src/worker.ts`
  - `src/app/api/generate/[taskId]/route.ts`
  - `src/app/api/generate/task-detail.route.test.ts`
  - `src/app/api/generate/repository.ts`
  - `src/app/create/composer-form.tsx`
  - `src/app/create/composer-form.test.ts`
  - `src/app/create/history.ts`
  - `src/app/create/history.test.ts`
  - `src/app/create/state.ts`
  - `src/app/create/state.test.ts`
  - `src/app/create/page.tsx`
  - `src/app/create/page.module.css`
  - `src/app/create/page-styles.test.ts`

### 1. 运行时配置与 provider 语义

- 新增独立图片生成 provider 配置：
  - `IMAGE_PROTOCOL`
  - `IMAGE_API_KEY`
  - `IMAGE_BASE_URL`
  - `IMAGE_MODEL`
- 图片生成 provider 不复用 `VISION_*`，避免“图片理解”和“图片生成”共享一套含义不清的运行时语义。
- 第一版 `IMAGE_PROTOCOL` 只支持 `openai`，不支持 `anthropic-messages`。
- `IMAGE_*` 不对 `LLM_*` 或 `VISION_*` 做字段级回退，必须显式配置：
  - `IMAGE_API_KEY`
  - `IMAGE_BASE_URL`
  - `IMAGE_MODEL`
- 默认模型与生成参数固定为：
  - `IMAGE_MODEL=gpt-image-1`
  - `size=1024x1536`
  - `outputFormat=png`
  - `quality=medium`
  - `maxRetries=2`
- 本轮图片生成实现固定使用：
  - `generateImage()` from `ai`
  - `createOpenAI(...).imageModel(...)` 语义
- 具体运行时改动固定落在：
  - `src/lib/llm.ts`
  - `src/lib/llm.test.ts`
  - `src/app/api/image-generation/capability.ts`
  - `src/app/api/image-generation/capability.test.ts`
- 未配置 `IMAGE_*` 时：
  - 文本创作链路必须保持完整可用
  - 图片入口展示明确能力提示
  - 图片计划与图片任务接口在能力检查阶段返回明确错误，不做静默降级
- 图片 capability 错误口径固定为：
  - `IMAGE_UNCONFIGURED`
  - `IMAGE_UNSUPPORTED_PROTOCOL`
- 建议错误消息固定为：
  - `当前未配置图片生成能力，请补充 IMAGE_* 配置。`
  - `当前图片生成仅支持 openai 协议。`
- README、`.env.example`、运行时 provider 工厂与 capability 判断口径必须一致。

### 2. 数据模型与迁移

- 保留现有：
  - `generation_tasks`
  - `task_strategy`
  - `generation_outputs`
- 图片能力新增以下表：

#### 2.1 `image_plans`

- 一条记录代表某个文本输出版本的一套图片计划。
- SQL 形状固定为：
  - `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
  - `output_id UUID NOT NULL REFERENCES generation_outputs(id) ON DELETE CASCADE`
  - `status TEXT NOT NULL DEFAULT 'ready'`
  - `visual_direction_override TEXT`
  - `body_page_cap INT NOT NULL DEFAULT 4`
  - `cover_candidate_count INT NOT NULL DEFAULT 2`
  - `body_candidate_count INT NOT NULL DEFAULT 1`
  - `system_decision_summary TEXT NOT NULL`
  - `created_at TIMESTAMPTZ DEFAULT NOW()`
  - `superseded_at TIMESTAMPTZ`

#### 2.2 `image_plan_pages`

- 一条记录代表计划中的一页图片。
- SQL 形状固定为：
  - `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
  - `plan_id UUID NOT NULL REFERENCES image_plans(id) ON DELETE CASCADE`
  - `sort_order INT NOT NULL`
  - `page_role TEXT NOT NULL`
  - `is_enabled BOOLEAN NOT NULL DEFAULT TRUE`
  - `content_purpose TEXT NOT NULL`
  - `source_excerpt TEXT NOT NULL`
  - `visual_type TEXT NOT NULL`
  - `style_reason TEXT NOT NULL`
  - `prompt_summary TEXT NOT NULL`
  - `prompt_text TEXT NOT NULL`
  - `candidate_count INT NOT NULL`
  - `created_at TIMESTAMPTZ DEFAULT NOW()`

#### 2.3 `image_generation_jobs`

- 一条记录代表一次真实图片生成任务。
- SQL 形状固定为：
  - `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
  - `plan_id UUID NOT NULL REFERENCES image_plans(id) ON DELETE CASCADE`
  - `scope TEXT NOT NULL`
  - `plan_page_id UUID REFERENCES image_plan_pages(id) ON DELETE SET NULL`
  - `status TEXT NOT NULL DEFAULT 'queued'`
  - `total_units INT NOT NULL DEFAULT 0`
  - `completed_units INT NOT NULL DEFAULT 0`
  - `error_message TEXT`
  - `model_name TEXT NOT NULL`
  - `created_at TIMESTAMPTZ DEFAULT NOW()`
  - `started_at TIMESTAMPTZ`
  - `finished_at TIMESTAMPTZ`

#### 2.4 `image_assets`

- 一条记录代表一张实际生成出的图片文件。
- SQL 形状固定为：
  - `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
  - `plan_page_id UUID NOT NULL REFERENCES image_plan_pages(id) ON DELETE CASCADE`
  - `job_id UUID NOT NULL REFERENCES image_generation_jobs(id) ON DELETE CASCADE`
  - `candidate_index INT NOT NULL`
  - `storage_key TEXT`
  - `image_url TEXT`
  - `mime_type TEXT`
  - `width INT`
  - `height INT`
  - `status TEXT NOT NULL DEFAULT 'generated'`
  - `is_selected BOOLEAN NOT NULL DEFAULT FALSE`
  - `prompt_text_snapshot TEXT NOT NULL`
  - `created_at TIMESTAMPTZ DEFAULT NOW()`

#### 2.5 `image_job_events`

- 用于图片 SSE 的事件日志。
- SQL 形状固定为：
  - `id BIGSERIAL PRIMARY KEY`
  - `job_id UUID NOT NULL REFERENCES image_generation_jobs(id) ON DELETE CASCADE`
  - `event_name TEXT NOT NULL`
  - `payload JSONB NOT NULL`
  - `created_at TIMESTAMPTZ DEFAULT NOW()`

#### 2.6 现有表补丁

- `generation_outputs` 继续作为文本结果真源，但图片侧所有读取逻辑必须显式以 `output_id` 为入口。
- 补充 `GET /api/generate/[taskId]` 所需的输出版本视角，不再把历史详情固定为“只返回一个最新 outputs”。
- 若当前数据库未约束 `(task_id, version)` 唯一性，应补充 forward-only 迁移收紧文本版本语义。

#### 2.7 约束与索引

- `migrations/023_add-image-generation-constraints.sql` 必须至少包含以下约束或索引：
  - `generation_outputs (task_id, version)` 唯一约束
  - `image_plan_pages (plan_id, sort_order)` 唯一约束
  - `image_assets (job_id, plan_page_id, candidate_index)` 唯一约束
  - `image_plans (output_id)` 的“仅一个活动计划”部分唯一索引，条件为 `superseded_at IS NULL`
  - `image_assets (plan_page_id)` 的“仅一个当前选中图”部分唯一索引，条件为 `is_selected = TRUE`
- 查询索引至少包含：
  - `image_generation_jobs (plan_id, created_at DESC)`
  - `image_job_events (job_id, id ASC)`
  - `image_assets (plan_page_id, created_at DESC)`
- `body_page_cap` 校验范围固定为 `1..8`
- `cover_candidate_count` 校验范围固定为 `1..4`
- `body_candidate_count` 校验范围固定为 `1..3`

### 3. 图片计划生成链路

- 新增同步接口：`POST /api/generate/outputs/[outputId]/image-plans`
- 该接口固定落在：
  - `src/app/api/generate/outputs/[outputId]/image-plans/route.ts`
  - `src/app/api/generate/outputs/[outputId]/image-plans/route.test.ts`
- 计划生成 agent 固定落在：
  - `src/agents/image-planning.ts`
  - `src/agents/prompts/image-planning.ts`
  - `src/agents/schemas/image-plan.ts`
- 计划生成固定使用 `generateObject()`，不使用 `streamObject()`。
- 请求体验证固定为：

```json
{
  "visualDirectionOverride": "档案感结论大字",
  "bodyPageCap": 4,
  "coverCandidateCount": 2,
  "bodyCandidateCount": 1
}
```

- `visualDirectionOverride`：
  - 可选
  - 空字符串按未提供处理
  - 最大长度 120
- 计划生成必须基于：
  - 当前文本输出版本
  - 当前任务策略摘要
  - 任务输入
  - 已命中的参考样本与视觉信息
- 计划生成的职责是：
  - 决定封面页与正文页结构
  - 在 `1..bodyPageCap` 范围内决定正文图片页数
  - 为每页生成用途说明、来源文案片段、推荐视觉类型、判断理由、摘要 prompt、原始 prompt
  - 为封面页和正文页分别应用各自候选图数量
- 图片计划默认同步返回完整结果，不走 SSE。
- 成功响应形状固定为：

```json
{
  "plan": {
    "id": "plan-1",
    "output_id": "output-1",
    "status": "ready",
    "visual_direction_override": "档案感结论大字",
    "body_page_cap": 4,
    "cover_candidate_count": 2,
    "body_candidate_count": 1,
    "system_decision_summary": "正文适合 3 页信息卡 + 1 页封面",
    "created_at": "2026-03-31T00:00:00.000Z"
  },
  "pages": [
    {
      "id": "page-cover",
      "sort_order": 0,
      "page_role": "cover",
      "is_enabled": true,
      "content_purpose": "封面结论页",
      "source_excerpt": "封面主标题 + 副标题",
      "visual_type": "info-card",
      "style_reason": "参考样本多为高对比大字封面",
      "prompt_summary": "高对比、结论先行、强标题",
      "prompt_text": "完整原始 prompt",
      "candidate_count": 2
    }
  ],
  "selected_output": {
    "id": "output-1",
    "task_id": "task-1",
    "version": 1,
    "created_at": "2026-03-31T00:00:00.000Z"
  }
}
```

- 失败状态固定为：
  - `404`：`output_id` 不存在
  - `409`：图片能力不可用
  - `400`：参数越界或格式错误
- 同一 `output_id` 下重新生成新计划时：
  - 旧计划标记为 `superseded`
  - 不删除旧计划及其历史图片资产

### 4. 图片计划修改与确认边界

- 新增 `PATCH /api/image-plans/[planId]`
- 该接口固定落在：
  - `src/app/api/image-plans/[planId]/route.ts`
  - `src/app/api/image-plans/[planId]/route.test.ts`
- 第一版只允许以下修改：
  - 更新全局视觉方向覆盖
  - 更新单页 `is_enabled`
- 请求体固定为：

```json
{
  "visualDirectionOverride": "杂志感留白版",
  "pages": [
    { "id": "page-2", "isEnabled": false },
    { "id": "page-3", "isEnabled": true }
  ]
}
```

- `pages` 只允许出现当前计划已有的 page id，不允许新增页面或调整顺序。
- 响应体固定与“创建计划”成功响应同形。
- 不允许第一版在站内直接改每页原始 prompt、布局、色彩或文案细节。
- 计划详情里：
  - `prompt_summary` 默认可见
  - `prompt_text` 默认隐藏，可展开
- 计划确认后才允许启动真实图片生成。
- 文本输出版本切换后，图片计划视图必须切换到对应 `output_id`，不能混用不同文本版本的计划与图片。

### 5. 图片任务执行、队列与 SSE

- 图片生成任务使用后台队列执行，不复用文本 SSE 直出模式。
- 可复用现有 BullMQ / Redis 慢任务基础设施，但本轮仅用于图片生成任务，不回头改动文本链路“生成不走队列”的既有边界。
- 队列与 worker 命名固定为：
  - queue name: `image-generate`
  - exported queue: `imageGenerateQueue`
  - worker variable: `imageGenerateWorker`
  - worker file: `src/worker-image-jobs.ts`
- 新增 `POST /api/image-plans/[planId]/jobs`
- 该接口固定落在：
  - `src/app/api/image-plans/[planId]/jobs/route.ts`
  - `src/app/api/image-plans/[planId]/jobs/route.test.ts`
- 支持两种 scope：
  - `full`：整套图片生成
  - `page`：单页重生
- 请求体固定为以下二选一：

```json
{ "scope": "full" }
```

```json
{ "scope": "page", "planPageId": "page-2" }
```

- 启动任务成功响应固定为：

```json
{
  "job": {
    "id": "job-1",
    "plan_id": "plan-1",
    "scope": "full",
    "plan_page_id": null,
    "status": "queued",
    "total_units": 0,
    "completed_units": 0
  },
  "events_url": "/api/image-jobs/job-1/events"
}
```

- 新增 `GET /api/image-jobs/[jobId]/events`，作为图片进度 SSE。
- 新增 `GET /api/image-jobs/[jobId]` 作为图片任务快照接口，供前端恢复断线状态。
- 两个接口固定落在：
  - `src/app/api/image-jobs/[jobId]/route.ts`
  - `src/app/api/image-jobs/[jobId]/route.test.ts`
  - `src/app/api/image-jobs/[jobId]/events/route.ts`
  - `src/app/api/image-jobs/[jobId]/events/route.test.ts`
- 图片 SSE 事件固定为：
  - `job_queued`
  - `job_started`
  - `page_started`
  - `asset_generated`
  - `job_progress`
  - `page_completed`
  - `job_completed`
  - `error`
- 图片 SSE payload 形状固定为：

```json
{ "event": "job_queued", "data": { "job_id": "job-1", "scope": "full" } }
```

```json
{ "event": "job_started", "data": { "job_id": "job-1", "total_units": 4 } }
```

```json
{ "event": "page_started", "data": { "job_id": "job-1", "plan_page_id": "page-2", "sort_order": 2 } }
```

```json
{
  "event": "asset_generated",
  "data": {
    "job_id": "job-1",
    "plan_page_id": "page-2",
    "asset": {
      "id": "asset-1",
      "image_url": "/uploads/generated/asset-1.png",
      "candidate_index": 1,
      "is_selected": true
    }
  }
}
```

```json
{ "event": "job_progress", "data": { "job_id": "job-1", "completed_units": 2, "total_units": 4 } }
```

```json
{ "event": "page_completed", "data": { "job_id": "job-1", "plan_page_id": "page-2", "selected_asset_id": "asset-1" } }
```

```json
{ "event": "job_completed", "data": { "job_id": "job-1", "status": "completed" } }
```

```json
{ "event": "error", "data": { "job_id": "job-1", "message": "image generation failed", "plan_page_id": "page-2" } }
```

- 图片 SSE 第一版不实现 `Last-Event-ID` 协议。
- `GET /api/image-jobs/[jobId]/events` 在连接建立时必须先重放该 job 现有全部 `image_job_events`，然后轮询新事件继续推送。
- 前端 reducer 必须按“事件重放可重复消费”设计，不能依赖事件只来一次。
- SSE 断开时，前端可回退到任务快照接口恢复状态，不要求用户重新发起生成。
- 图片 worker 对每个 page 的执行固定为：
  - 读取 `prompt_text`
  - 按 `candidate_count` 调用 `generateImage()`
  - 将生成的二进制文件写入 `storage.upload()`
  - 写入 `image_assets`
  - 首张成功图片默认 `is_selected = true`
- `model_name` 固定写入 `process.env.IMAGE_MODEL ?? 'gpt-image-1'`

### 6. 图片资产选择与重生语义

- 新增 `POST /api/image-assets/[assetId]/select`
- 该接口固定落在：
  - `src/app/api/image-assets/[assetId]/select/route.ts`
  - `src/app/api/image-assets/[assetId]/select/route.test.ts`
- 同一 `image_plan_page` 下允许存在多张候选图，但任一时刻只能有一张 `is_selected = true`。
- 选中接口响应固定返回：

```json
{
  "asset": {
    "id": "asset-2",
    "plan_page_id": "page-2",
    "image_url": "/uploads/generated/asset-2.png",
    "is_selected": true
  }
}
```

- 单页重生：
  - 只创建新 `image_generation_jobs` 记录和新 `image_assets`
  - 不创建新图片计划
  - 不影响其他页当前已选图片
- 整套重生：
  - 作用于当前计划的所有启用页面
  - 不强制丢弃旧候选图
- 第一版只做逻辑上的“选中图切换”，不要求同步做历史候选图的物理文件清理。

### 7. 创作工作台 `/create` 改造

- 继续使用单页工作台，不新增图片专用路由。
- 前端请求 helper 固定抽到：
  - `src/app/create/image-api.ts`
  - `src/app/create/image-api.test.ts`
- 图片结果面板固定抽到：
  - `src/app/create/image-workbench.tsx`
- 左侧“任务输入”新增图片参数区：
  - `bodyPageCap`
  - `coverCandidateCount`
  - `bodyCandidateCount`
  - `visualDirectionOverride`
- 默认值固定为：
  - `bodyPageCap = 4`
  - `coverCandidateCount = 2`
  - `bodyCandidateCount = 1`
  - `visualDirectionOverride = ''`
- 文本生成仍由原“生成”按钮触发，不自动启动图片计划。
- 中间流程区从 4 步扩为 6 步：
  - 任务理解
  - 参考检索
  - 策略形成
  - 成稿生成
  - 图片计划
  - 图片生成
- 右侧结果区新增图片工作台，至少覆盖以下状态：
  - 无计划
  - 有计划未确认
  - 图片任务执行中
  - 有可用图片结果
- 图片工作台至少支持以下动作：
  - 生成图片计划
  - 更新全局视觉方向
  - 开关单页
  - 启动整套图片生成
  - 单页重生
  - 选择当前使用图片
- `state.ts` 必须新增以下状态类型：
  - `ImageConfig`
  - `ImagePlanPayload`
  - `ImageJobPayload`
  - `OutputVersionSummary`
  - `SelectedImageAssetPayload`
- `selectedOutputId` 默认行为固定为：
  - 当前新生成任务优先选中最新 `output_id`
  - 历史详情优先选中 `output_versions` 中 `version` 最大的一项
- 图片入口禁用逻辑固定为：
  - 文本尚未完成时禁用
  - 无 `IMAGE_*` 能力时禁用并展示 capability 提示
- `page.tsx` 不直接发裸 fetch 到所有图片接口；除文本生成外，其余图片相关请求统一走 `image-api.ts`

### 8. 历史任务与版本回看

- 扩展 `GET /api/generate/[taskId]` 返回：
  - `output_versions`
  - `selected_output_id`
  - `latest_image_plan`
  - `selected_image_assets`
  - `active_image_job`
- 历史详情区必须支持：
  - 查看多个文本输出版本
  - 切换输出版本后查看对应图片计划
  - 查看每页当前已选图片与任务状态
- 历史页默认展示当前选中图片，不强制平铺所有候选图。
- 图片计划与图片任务失败不能破坏原有文本历史详情展示。
- `GET /api/generate/[taskId]` 返回形状固定为：

```json
{
  "task": { "id": "task-1", "topic": "主题", "status": "completed" },
  "strategy": { "strategy_summary": "..." },
  "references": [],
  "output_versions": [
    { "id": "output-1", "version": 1, "model_name": "gpt-4o", "created_at": "2026-03-31T00:00:00.000Z" }
  ],
  "selected_output_id": "output-1",
  "outputs": {
    "id": "output-1",
    "titles": [],
    "openings": [],
    "body_versions": [],
    "cta_versions": [],
    "cover_copies": [],
    "hashtags": [],
    "first_comment": "",
    "image_suggestions": ""
  },
  "latest_image_plan": {
    "plan": { "id": "plan-1", "status": "ready" },
    "pages": [],
    "selected_assets": []
  },
  "active_image_job": null,
  "reference_mode": "referenced",
  "feedback": null
}
```

- `src/app/api/generate/repository.ts` 必须承担文本版本列表与图片摘要拼装，不要把图片查询散落到多个 route 内重复实现。

### 8.1 图片计划生成决策默认值

- 未提供 `visualDirectionOverride` 时，planner 自行根据：
  - `cover_explanation`
  - `strategy.cover_strategy`
  - `outputs.cover_copies`
  - `outputs.image_suggestions`
  - `body_versions[0]`
  生成默认整套视觉方向。
- `page_role='cover'` 的 page 固定只有 1 页，`sort_order=0`。
- 正文页固定从 `sort_order=1` 开始连续编号。
- `visual_type` 第一版只允许：
  - `info-card`
  - `scene`
- 若 planner 判断不确定，默认回退到 `info-card`。

### 9. 测试与验证

- 为新增迁移补充数据库层测试：
  - 新表可创建
  - 外键行为正确
  - 选中图唯一性正确
- 迁移测试文件固定为：
  - `src/app/api/image-generation/repository.test.ts`
- 为计划接口补充测试：
  - 基于指定 `output_id` 生成图片计划
  - 正文页数受任务级上限约束
  - 全局视觉方向覆盖与单页开关更新后可返回新计划
- 计划接口测试文件固定为：
  - `src/app/api/generate/outputs/[outputId]/image-plans/route.test.ts`
  - `src/app/api/image-plans/[planId]/route.test.ts`
- 为图片任务补充测试：
  - 整套图片任务 `queued -> running -> completed`
  - 单页重生不影响其他页
  - `partial_failed` / `failed` 状态正确落库
- 图片任务测试文件固定为：
  - `src/app/api/image-plans/[planId]/jobs/route.test.ts`
  - `src/app/api/image-jobs/[jobId]/route.test.ts`
  - `src/worker-image-jobs.test.ts`
- 为图片 SSE 补充测试：
  - 事件顺序正确
  - 断流后可通过任务快照接口恢复
- 图片 SSE 测试文件固定为：
  - `src/app/api/image-jobs/[jobId]/events/route.test.ts`
- 为存储补充测试：
  - 图片可落本地存储并返回 `image_url`
  - 切换选中图后同页仅一张为当前选中
- 如需扩展本地存储测试，直接补 `src/lib/storage.test.ts`，不要再造第二套 storage fake。
- 为 `/create` 页面补充测试：
  - 文本完成后可手动生成图片计划
  - 图片计划、整套生成、单页重生、历史版本切换都可用
  - 未配置 `IMAGE_*` 时文本链路仍可用且图片入口有明确提示
- 前端测试文件固定为：
  - `src/app/create/image-api.test.ts`
  - `src/app/create/state.test.ts`
  - `src/app/create/history.test.ts`
  - `src/app/create/composer-form.test.ts`
  - `src/app/create/page-styles.test.ts`
- 实现完成后运行：
  - `npm run lint`
  - `npm test`
  - `npm run build`

### 10. 执行时必须遵守的实现决策

- 不要把图片计划、图片任务和图片资产塞回 `src/app/api/generate/route.ts`；文本 route 只扩展历史详情返回。
- 不要把图片 worker 逻辑继续堆到 `src/worker-jobs.ts`；图片任务单独放在 `src/worker-image-jobs.ts`。
- 不要在 `/create` 页里内联所有图片 fetch 与 SSE 逻辑；图片 API helper 固定放到 `src/app/create/image-api.ts`。
- 不要让图片 SSE 依赖 provider 级 partial image streaming；前端只消费 job/page/asset 事件，不消费 provider 原始 partial image。
- 不要让 planner 直接复用现有文本 `StrategyResult` schema；图片计划必须有自己的 schema 文件。
- 不要在第一次实现中支持 prompt 编辑、版式编辑、颜色编辑、遮罩编辑或局部重绘。

## 禁止事项 ❌

- ❌ 不要修改现有 `POST /api/generate` 的文本职责与事件协议
- ❌ 不要把图片真实生成再塞进当前文本 SSE 请求周期
- ❌ 不要让生成图自动回流样本库
- ❌ 不要新增站内画布编辑、局部重绘、图层调整等编辑器能力
- ❌ 不要引入 WebSocket 或新的实时通信基础设施
- ❌ 不要扩展 `s3/r2` 等新的存储 provider，本轮继续沿用 `local`
- ❌ 不要把本轮扩展成发布链路、审核链路、样本反哺学习链路或多用户协作系统

## 验收检查清单 ✅

- [ ] 已新增 `docs/optimizations/OPT-008-image-planning-and-generation.md`
- [ ] 已新增独立 `IMAGE_*` provider 语义，且文本链路在未配置时仍可用
- [ ] 图片计划与图片资产均绑定 `generation_outputs.id`
- [ ] 已新增 `image_plans`、`image_plan_pages`、`image_generation_jobs`、`image_assets`、`image_job_events`
- [ ] `POST /api/generate/outputs/[outputId]/image-plans` 可生成结构化图片计划
- [ ] 图片计划支持全局视觉方向覆盖与单页开关
- [ ] 图片真实生成通过异步任务执行，而不是文本请求内同步完成
- [ ] 已提供图片任务快照接口与单独 SSE 事件流
- [ ] 支持整套生成与单页重生
- [ ] 同页候选图仅有一张当前选中图
- [ ] `/create` 已支持手动触发图片计划、查看图片任务进度、选择图片与重生
- [ ] 历史任务详情已支持文本输出版本切换，并联动展示对应图片计划与当前选中图片
- [ ] 图片链路失败不会破坏文本链路
- [ ] `npm run lint`、`npm test`、`npm run build` 通过
