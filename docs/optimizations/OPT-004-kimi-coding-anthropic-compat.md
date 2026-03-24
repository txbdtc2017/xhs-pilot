# OPT-004：Kimi Coding Anthropic 兼容收口

> **目标**：让 XHS Pilot 的 `anthropic-messages` 接入语义兼容 OpenClaw 对 Kimi Coding 的使用方式，避免 Kimi Coding 在当前项目中因 base URL、默认 header 与模型别名差异而无法直接工作。

## 前序依赖

Phase 6 完成，且 `OPT-001`、`OPT-002`、`OPT-003` 已完成当前环境变量、Anthropic Messages 基线与 embedding 语义收口。

## 参考章节

- `docs/CONVENTIONS.md`
- `docs/optimizations/CONVENTIONS.md`
- `docs/optimizations/OPT-002-anthropic-messages-provider.md`
- `docs/optimizations/OPT-003-embedding-explicit-and-lexical-only.md`
- `README.md`
- OpenClaw 参考实现：
  - `/Users/rotas/Documents/my/learnai/openclaw/src/agents/model-compat.ts`
  - `/Users/rotas/Documents/my/learnai/openclaw/extensions/kimi-coding/provider-catalog.ts`

## 具体任务

### 1. Anthropic base URL 兼容层

- 在现有 provider 兼容层中增加 `anthropic-messages` base URL 规范化逻辑。
- 规范化只对 `anthropic-messages` 生效，不影响 `openai` 路径。
- 规范化规则固定为：
  - 末尾若已是 `/v1` 或 `/v1/`，统一为单个 `/v1`
  - 若未以 `/v1` 结尾，则自动补成 `.../v1`
- `LLM_*` 与 `VISION_*` 必须复用同一套 Anthropic base URL 规则，不允许两套实现。

### 2. Kimi Coding 专项兼容

- 增加对 Kimi Coding Anthropic endpoint 的识别逻辑，至少覆盖 `api.kimi.com/coding`。
- 命中 Kimi Coding 时，为 Anthropic provider 默认注入：
  - `User-Agent: claude-code/0.1.0`
- 该默认 header 仅作为内建兼容行为，不新增 header 相关环境变量，也不引入通用 header 配置系统。

### 3. Kimi 模型别名兼容

- 在运行时对 Kimi Coding 模型名增加兼容映射：
  - `kimi-code` -> `kimi-for-coding`
  - `k2p5` 继续视为 legacy 可用值，不强制改写
- 普通 Anthropic provider 不做模型名改写。
- 上层业务调用方式保持不变，分析、生成、视觉链路不新增 provider 分支。

### 4. 文档与示例配置同步

- `.env.example` 与 README 统一说明：
  - 当前项目在 `anthropic-messages` 下接受“带 `/v1`”和“不带 `/v1`”两种 base URL 写法
  - Kimi Coding 推荐写法可按 OpenClaw 风格使用 `https://api.kimi.com/coding/`
  - `kimi-code` 为推荐模型别名，`k2p5` 为兼容 legacy 值
  - 本轮不涉及 `EMBEDDING_*` 修复或语义调整
- 文档需要明确区分：
  - OpenClaw 风格的“配置语义兼容”
  - 当前仓库内部仍使用 Vercel AI SDK 的实现事实

## 禁止事项 ❌

- ❌ 不要新增 Moonshot/Kimi 专用 provider 类型
- ❌ 不要改动 OpenAI-compatible 路径
- ❌ 不要新增 `LLM_HEADERS`、`VISION_HEADERS` 等通用配置项
- ❌ 不要把 embedding 接入 Anthropic Messages
- ❌ 不要顺手改提示词、样本状态机、检索逻辑或队列行为
- ❌ 不要引入与本轮无关的配置重构

## 验收检查清单 ✅

- [x] `anthropic-messages` 下的 base URL 会统一规范化为可用的 `/v1` 语义
- [x] `openai` provider 完全不受该规范化影响
- [x] `LLM_*` 与 `VISION_*` 共享同一套 Anthropic base URL 规范化逻辑
- [x] 命中 Kimi Coding endpoint 时会自动注入 `User-Agent: claude-code/0.1.0`
- [x] 非 Kimi Anthropic provider 不会被注入该 header
- [x] `kimi-code` 在运行时可兼容为 `kimi-for-coding`
- [x] `k2p5` 仍保持可用
- [x] `.env.example`、README、`OPT-004` 口径一致
- [x] `npm test`、`npm run lint`、`npm run build` 通过
