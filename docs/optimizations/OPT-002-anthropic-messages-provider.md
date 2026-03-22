# OPT-002：Anthropic Messages 协议接入与 v0.2.1 版本推进

> **目标**：在保留现有 OpenAI-compatible 接入方式的同时，为文本分析、策略生成、正文生成和图片分析增加 `anthropic-messages` 协议支持，以适配 Kimi coding 的接入方式；并将项目版本提升到 `0.2.1`。

## 前序依赖

Phase 6 完成，且 `OPT-001` 已完成环境变量、默认空库和 Vision provider 收口。

## 参考章节

- `docs/CONVENTIONS.md`
- `docs/optimizations/CONVENTIONS.md`
- `README.md`
- `docs/implementation_plan.md`
- `docs/phases/phase-6-productization.md`

## 具体任务

### 1. LLM 协议层扩展

- 在现有 provider 层之上增加 `anthropic-messages` 协议支持
- 协议扩展覆盖：
  - 样本文本分析
  - 任务理解与策略生成
  - 正文生成
  - 图片分析
- `embedding` 保持独立 provider，不并入 `anthropic-messages`
- 对上层调用方式保持不变，不在业务层散落 provider 分支

### 2. 环境变量与回退规则

- 新增：
  - `LLM_PROTOCOL=openai|anthropic-messages`
  - `VISION_PROTOCOL=openai|anthropic-messages`
- `LLM_PROTOCOL` 未设置时默认 `openai`
- `VISION_PROTOCOL` 未设置时回退到 `LLM_PROTOCOL`
- `VISION_API_KEY` / `VISION_BASE_URL` 继续按字段回退到 `LLM_API_KEY` / `LLM_BASE_URL`
- `EMBEDDING_*` 仍独立配置，不新增 `EMBEDDING_PROTOCOL`
- 无效协议值必须明确报错，不做自动推断或静默降级

### 3. 文档与示例配置同步

- `.env.example` 必须体现双协议能力，而不是只保留 OpenAI-compatible 口径
- README 必须说明：
  - 当前支持 `openai` 与 `anthropic-messages`
  - Kimi coding 推荐用法
  - 图片分析同样受 `VISION_PROTOCOL` 控制
  - `embedding` 仍需要独立 provider
  - 修改 `.env` 后必须重启 `app` 与 `worker`
- `docs/implementation_plan.md` 与产品化相关文档需同步到一致表述

### 4. 版本推进

- 本轮实现基线分支固定为 `v0.2.1`
- `package.json` 版本号必须从 `0.2.0` 升到 `0.2.1`
- UI 中的版本展示继续从 `package.json` 派生，不新增第二个版本真源

## 禁止事项 ❌

- ❌ 不要在本轮引入 Moonshot 专用 provider
- ❌ 不要把 `embedding` 强行改到 `anthropic-messages`
- ❌ 不要改动提示词、样本状态机或检索策略本身
- ❌ 不要做协议自动识别
- ❌ 不要顺手扩展到新的模型能力或新的部署边界

## 验收检查清单 ✅

- [ ] 新增 `LLM_PROTOCOL` 与 `VISION_PROTOCOL`
- [ ] 文本分析、策略、生成、图片分析均可按协议切换 provider
- [ ] `VISION_PROTOCOL` 未设置时会回退到 `LLM_PROTOCOL`
- [ ] `VISION_API_KEY` / `VISION_BASE_URL` 继续逐字段回退到 `LLM_*`
- [ ] `embedding` 仍保持独立 provider
- [ ] 无效协议值会给出明确错误
- [ ] `.env.example`、README、implementation plan、phase 6 文档口径一致
- [ ] `package.json` 版本号已更新为 `0.2.1`
- [ ] 左侧栏版本展示为 `版本 v0.2.1`
- [ ] `npm test`、`npm run lint`、`npm run build` 通过
