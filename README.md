# XHS Pilot

> 🚀 一个带学习能力的小红书内容创作辅助系统 — 沉淀、分析、策略、生成，全链路透明可解释。

## ✨ 核心特性

- **样本沉淀** — 录入爆款笔记，系统自动进行结构化分析
- **认知提取** — LLM 拆解标题策略、内容结构、封面风格、可复用规则
- **智能检索** — 创作时自动匹配相关样本，提供参考依据
- **策略先行** — 先制定创作策略，再生成内容，全程透明可见
- **流式生成** — 标题、正文、封面文案、标签一键生成，实时打字机输出
- **LLM 厂商解耦** — 支持 OpenAI / DeepSeek / Ollama 本地模型 / 任意 OpenAI 兼容 API

## 🏗️ 技术栈

| 层 | 技术 |
|----|------|
| 前端 | Next.js 15 + React 19 (App Router) |
| 样式 | Vanilla CSS + CSS Variables |
| 后端 | Next.js API Routes + Server Actions |
| 异步任务 | BullMQ + Redis |
| 数据库 | PostgreSQL 16 + pgvector |
| 流式生成 | Vercel AI SDK (streamObject + streamText) |
| 容器化 | Docker Compose |

## 🚀 快速开始

```bash
# 1. 克隆 + 配置
git clone https://github.com/txbdtc2017/xhs-pilot.git
cd xhs-pilot
cp .env.example .env    # 编辑 .env 填入 API Key（或配置本地 Ollama）

# 2. 一键启动
docker compose up -d

# 3. 访问
open http://localhost:3000
```

## ⚙️ LLM 配置

编辑 `.env` 文件，修改以下变量即可切换 LLM 服务：

### 使用 OpenAI（默认）
```bash
LLM_BASE_URL=https://api.openai.com/v1
LLM_API_KEY=sk-xxx
LLM_MODEL_ANALYSIS=gpt-4o
```

### 使用 Ollama 本地模型
```bash
LLM_BASE_URL=http://host.docker.internal:11434/v1
LLM_API_KEY=ollama
LLM_MODEL_ANALYSIS=qwen2.5
```

### 使用 DeepSeek
```bash
LLM_BASE_URL=https://api.deepseek.com
LLM_API_KEY=sk-xxx
LLM_MODEL_ANALYSIS=deepseek-chat
```

### 使用中转代理
```bash
LLM_BASE_URL=https://your-proxy.com/v1
LLM_API_KEY=sk-xxx
```

## 💾 数据备份与恢复

```bash
# 备份
bash scripts/backup.sh

# 恢复
bash scripts/restore.sh backup-2025-01-01.tar.gz
```

## 📁 项目结构

```
docs/                    # 设计文档
├── implementation_plan.md   # 完整产品方案
├── roadmap.md               # Phase 2/3 演进规划
└── phases/                  # 分阶段执行计划
    ├── README.md
    ├── phase-1-scaffold.md
    ├── ...
    └── phase-6-productization.md
```

## 📝 开发文档

- [完整产品方案](docs/implementation_plan.md)
- [演进路线图](docs/roadmap.md)
- [分阶段执行指南](docs/phases/README.md)

## 📋 设计原则

1. **所有生成必须有参考依据** — 不做黑盒生成
2. **所有参考必须可解释** — 展示参考了哪篇样本的什么维度
3. **所有策略必须可见** — 先策略后生成，用户可调整
4. **所有样本必须能被复用** — 结构化沉淀，不做高级收藏夹

## 🛡️ 安全说明

- 纯单机自用，无用户认证
- API Key 仅存储在 `.env` 中，不进入版本控制
- 网络暴露风险由用户自行通过内网/防火墙管理

## License

MIT
