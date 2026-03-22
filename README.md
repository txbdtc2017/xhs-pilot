# XHS Pilot

> 面向单用户自托管场景的小红书内容资产、检索与创作工作台。

XHS Pilot 的目标不是“黑盒一键出稿”，而是把样本沉淀、结构化分析、参考检索、策略制定和内容生成串成一条可追踪链路。你可以看到系统参考了哪些样本、为什么这么写，以及历史任务留下了什么结果。

## 功能概览

- 样本录入：支持标题、正文、图片、来源链接、手动标签
- 自动分析：异步完成文本分析、视觉分析和 embedding 入库
- 样本管理：样本库列表、详情页、人工修正、高价值标记
- 创作工作台：任务理解、参考检索、策略快照、流式生成
- 风格画像：手动分组、样本关联、画像列表与详情
- 历史链路：在 `/create?taskId=<id>` 查看参考、策略、输出和反馈
- PWA 外壳：可安装、可缓存静态壳、离线时有友好提示

## 当前支持范围

- 官方支持部署方式：Docker Compose
- 官方支持存储方式：`STORAGE_PROVIDER=local`
- 当前定位：单用户、自托管、same-origin
- 当前不包含：认证、多用户、`s3/r2` 存储、自动首启 seed、离线生成

## 技术栈

| 层 | 技术 |
|----|------|
| 前端 | Next.js 16.2.1 + React 19 |
| 样式 | Vanilla CSS + CSS Variables |
| 后端 | Next.js Route Handlers |
| 异步任务 | BullMQ + Redis |
| 数据库 | PostgreSQL 16 + pgvector |
| LLM 接入 | Vercel AI SDK + OpenAI-compatible APIs |
| 容器化 | Docker Compose |

## 快速开始

```bash
# 1. 克隆仓库并配置环境变量
git clone https://github.com/txbdtc2017/xhs-pilot.git
cd xhs-pilot
cp .env.example .env

# 2. 启动服务
docker compose up -d --build

# 3. 打开应用
open http://localhost:17789
```

### 启动后建议验证

```bash
curl http://localhost:17789/api/health
```

如果你想快速看到非空页面，可以手动执行：

```bash
npm run seed
```

这会插入一组演示样本，用于 Dashboard、样本库和检索链路冒烟，不会在 `docker compose up -d` 时自动执行。

## LLM 配置

XHS Pilot 使用 OpenAI-compatible 接口，主要变量如下：

```bash
LLM_BASE_URL=https://api.openai.com/v1
LLM_API_KEY=sk-xxx
LLM_MODEL_ANALYSIS=gpt-4o
LLM_MODEL_GENERATION=gpt-4o
LLM_MODEL_VISION=gpt-4o

EMBEDDING_BASE_URL=${LLM_BASE_URL}
EMBEDDING_API_KEY=${LLM_API_KEY}
EMBEDDING_MODEL=text-embedding-3-small
```

### OpenAI

```bash
LLM_BASE_URL=https://api.openai.com/v1
LLM_API_KEY=sk-xxx
```

### Ollama

```bash
LLM_BASE_URL=http://host.docker.internal:11434/v1
LLM_API_KEY=ollama
LLM_MODEL_ANALYSIS=qwen2.5
LLM_MODEL_GENERATION=qwen2.5
LLM_MODEL_VISION=qwen2.5vl
```

### DeepSeek

```bash
LLM_BASE_URL=https://api.deepseek.com
LLM_API_KEY=sk-xxx
LLM_MODEL_ANALYSIS=deepseek-chat
LLM_MODEL_GENERATION=deepseek-chat
```

### 中转代理

```bash
LLM_BASE_URL=https://your-proxy.com/v1
LLM_API_KEY=sk-xxx
```

## 运行与验证命令

```bash
# 开发
npm run dev
npm run worker:dev

# 数据库
npm run db:migrate
npm run db:migrate:down

# 演示数据
npm run seed

# 验证
npm run lint
npm test
npm run build
npm run check
```

## 数据备份与恢复

当前 Phase 6 只支持 `Docker Compose + STORAGE_PROVIDER=local`。

```bash
# 备份
bash scripts/backup.sh

# 恢复（必须显式传 --force）
bash scripts/restore.sh backups/xhs-pilot-YYYYMMDD-HHMMSS.tar.gz --force
```

备份包会包含：

- `database.sql.gz`
- `uploads.tar.gz`
- `metadata.json`

## PWA 说明

- 浏览器可安装到主屏幕
- 会缓存静态壳和离线提示页
- 断网时会回退到 `/offline`

当前 PWA 不承诺以下能力：

- 离线创作生成
- 离线样本浏览
- 离线数据库或队列执行

## 安全模型

- `.env` 默认被 `.gitignore` 忽略，不进入版本控制
- 没有任何 `NEXT_PUBLIC_*` secret
- LLM Key 只在服务端读取
- API 默认 same-origin，不开放跨域调用
- 文件上传限制为 JPEG / PNG / WebP，单次最多 9 张，大小受 `MAX_UPLOAD_SIZE_MB` 控制

这是一个单用户自托管工具。若需要公网暴露，请自行通过反向代理、内网访问、Basic Auth 或其他外围手段加固。

## 目录说明

```text
docs/
├── implementation_plan.md
├── roadmap.md
└── phases/

scripts/
├── backup.sh
├── restore.sh
├── seed.sh
└── seed.ts

src/
├── app/
├── agents/
├── lib/
├── queues/
└── worker.ts
```

## 已知限制

- 当前只支持本地文件存储，不支持 `s3/r2`
- 当前 seed 仅提供演示数据，不会自动触发完整分析结果预烘焙
- 历史任务详情入口位于创作工作台内部，不是独立页面
- README 暂未附带稳定截图 / GIF

更多后续能力见 [docs/roadmap.md](./docs/roadmap.md)。

## License

MIT
