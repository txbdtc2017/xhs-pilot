# OPT-001：默认空库、环境配置收口与图片解析 LLM 接入

> **目标**：把部署默认数据状态、环境变量约束和图片解析模型接入方式收口为一套一致、可解释、可验证的实现规则。

## 前序依赖

Phase 6 完成（产品化基线已在主线落地）

## 参考章节

- `docs/CONVENTIONS.md`
- `docs/optimizations/CONVENTIONS.md`
- `docs/phases/phase-6-productization.md`
- `README.md`
- `implementation_plan.md` 第十四章 14.1、14.2、14.7-14.9

## 具体任务

### 1. 默认部署空库与手动 seed 边界

- 部署默认状态必须是：**空库、空列表、空 Dashboard 是正常行为**
- `docker compose up -d --build` 只允许执行迁移，不允许自动注入任何演示数据
- 保留 `npm run seed`，但它的定位固定为：
  - 本地演示命令
  - 冒烟验证命令
  - 非默认部署步骤
- README、示例说明和相关文档必须明确写出：
  - 新部署后默认没有内容
  - 只有显式执行 `npm run seed` 才会插入演示样本
- 对当前开发环境已有的测试数据，提供明确的**手动清理方案**，但不要默认自动清空
- 清理方案至少覆盖：
  - PostgreSQL 业务表数据
  - 本地 `uploads/`
  - Redis 中的队列残留

### 2. `.env` / `.env.example` 与端口真源收口

- 引入 `PORT` 作为唯一监听端口真源
- 本地开发、生产启动、Dockerfile 和 Docker Compose 的端口行为都必须统一到 `PORT`
- `APP_URL` 只表示外部访问地址，不再承担“控制监听端口”的语义
- 若 `APP_URL` 与 `PORT` 端口不一致，必须给出明确提示；可选做法是启动时报错
- `.env.example` 必须以当前真实实现为准，移除未生效或误导字段
- 需要明确整理三类字段：
  - 真正生效的字段
  - 被 Docker Compose 覆盖的字段
  - 当前未使用、应移除或不应继续暴露的字段
- 文档中必须明确点名当前无效或历史残留字段的去留

### 3. 图片解析 LLM 独立 Vision Provider

- 图片解析链路支持独立于文本模型的 provider 配置
- 新增独立视觉配置项：
  - `VISION_BASE_URL`
  - `VISION_API_KEY`
- `LLM_MODEL_VISION` 继续作为视觉模型名字段，不额外再造命名体系
- 视觉链路的配置优先级固定为：
  - 先使用 `VISION_BASE_URL` / `VISION_API_KEY`
  - 若未配置，再回退到 `LLM_BASE_URL` / `LLM_API_KEY`
- 图片解析仍保持当前能力边界：
  - OCR
  - 封面风格结构化分析
  - 失败不阻塞 embedding
- README 必须新增“如何接入图片解析 LLM”的说明，并给出至少三种示例：
  - 文本与视觉共用同一 provider
  - 文本与视觉分别接入不同 provider
  - 使用本地或代理兼容的多模态模型

### 4. 文档与配置说明同步

- README、`.env.example`、相关 phase 文档说明必须同步更新到一致口径
- 所有关于端口、seed、Vision 接入的说明，都必须以当前实现为准，而不是早期设计口径
- 不要只改模板不改 README，也不要只改 README 不改模板

## 禁止事项 ❌

- ❌ 不要顺手扩展到 `s3/r2`
- ❌ 不要引入自动首启 seed
- ❌ 不要把这轮优化扩展成新的认证、多用户或 SaaS 设计
- ❌ 不要把 `OPT` 文档写成进度日志
- ❌ 不要在本轮中顺手修改无关业务逻辑

## 验收检查清单 ✅

- [ ] 新部署默认无样本数据，且不自动 seed
- [ ] `npm run seed` 仍可手动插入演示样本
- [ ] 当前开发环境有明确可执行的数据清理方案
- [ ] `PORT` 成为唯一监听端口真源
- [ ] `APP_URL` 与端口语义不再混淆
- [ ] `.env.example` 只保留真实有效或明确有用的字段
- [ ] 文档中已明确哪些字段生效、哪些被覆盖、哪些未使用
- [ ] 图片解析支持独立 `VISION_*` provider
- [ ] Vision 配置失败时不阻塞 embedding 链路
- [ ] README 已说明图片解析 LLM 的接入方式
