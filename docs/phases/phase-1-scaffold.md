# Phase 1：项目脚手架 + 数据库

> **目标**：从零搭建项目骨架，所有基础设施就绪，能跑起来但没有业务逻辑。

## 前序依赖

无（这是第一个阶段）

## 参考章节

- `implementation_plan.md` 第六章（数据结构设计）
- `implementation_plan.md` 第十一章（推荐技术架构）
- `implementation_plan.md` 第十四章 14.1-14.3（安装部署 / 环境配置 / 数据库迁移）
- `implementation_plan.md` 第十四章 14.10（项目目录结构）

## 具体任务

### 1. 初始化 Next.js 项目

```bash
npx -y create-next-app@latest ./ --typescript --app --eslint --no-tailwind --src-dir --import-alias "@/*"
```

> 注意：使用 `--src-dir` 保持 `src/` 目录结构。使用 `--no-tailwind`，样式用 Vanilla CSS + CSS Variables。

安装核心依赖：

```bash
npm install pg pgvector bullmq ioredis ai @ai-sdk/openai pino pino-pretty zod
npm install -D @types/pg node-pg-migrate tsx
```

然后调整目录结构，把代码放到 `src/` 下（按 14.10 节的目录结构）。

### 2. 创建 Docker Compose 配置

按 14.1 节创建：
- `docker-compose.yml` — app + worker + postgres + redis 四个服务
- `Dockerfile` — Next.js 应用镜像
- `.env.example` — 按 14.2 节的完整环境变量（含 LLM 解耦配置）

**postgres 必须使用 `pgvector/pgvector:pg16` 镜像**。

### 3. 创建所有数据库迁移文件

按第六章的 12 张表 + 索引，生成迁移文件：

```
migrations/
├── 001_create-samples.sql
├── 002_create-sample-images.sql
├── 003_create-sample-analysis.sql
├── 004_create-sample-visual-analysis.sql
├── 005_create-sample-embeddings.sql
├── 006_create-style-profiles.sql
├── 007_create-style-profile-samples.sql
├── 008_create-generation-tasks.sql
├── 009_create-task-references.sql
├── 010_create-task-strategy.sql
├── 011_create-generation-outputs.sql
├── 012_create-task-feedback.sql
├── 013_create-indexes.sql
```

需要 `CREATE EXTENSION IF NOT EXISTS vector;` 在第一个迁移文件开头。

### 4. 创建核心库文件（空壳）

按目录结构创建以下文件，只写接口和连接逻辑，不写业务：

- `src/lib/db.ts` — PostgreSQL 连接池（使用 `pg` 库）
- `src/lib/redis.ts` — Redis 连接（使用 `ioredis`）
- `src/lib/storage.ts` — 存储抽象接口 + LocalStorage 实现
- `src/lib/llm.ts` — LLM 客户端工厂（使用 Vercel AI SDK + `createOpenAI()`，从环境变量读取 `LLM_BASE_URL` 和 `LLM_API_KEY`）
- `src/lib/logger.ts` — pino 日志

### 5. 创建 CSS 设计系统基础

- `src/styles/variables.css` — 颜色、间距、字体、圆角等 CSS 变量
- `src/styles/globals.css` — 全局重置 + 基础排版

### 6. 创建 seed 脚本

- `scripts/seed.sh` — 插入 3~5 篇预置样本数据（只有原始数据，不含分析结果）

### 7. 配置 package.json 脚本

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "worker:dev": "tsx watch src/worker.ts",
    "worker:start": "tsx src/worker.ts",
    "db:migrate": "node-pg-migrate up",
    "db:migrate:down": "node-pg-migrate down",
    "seed": "bash scripts/seed.sh"
  }
}
```

### 8. API 健康检查

- `src/app/api/health/route.ts` — 检查 DB + Redis 连接状态

## 禁止事项 ❌

- ❌ 不要实现任何 Agent 逻辑
- ❌ 不要实现任何业务 API（除 health）
- ❌ 不要实现任何前端页面（除默认首页）
- ❌ 不要安装 Tailwind CSS
- ❌ 不要添加用户认证相关的任何东西

## 验收检查清单 ✅

- [ ] `docker compose up -d` 能一键启动所有服务
- [ ] PostgreSQL 连接正常，所有 12 张表 + pgvector 扩展已创建
- [ ] Redis 连接正常
- [ ] `GET /api/health` 返回 `{ db: "ok", redis: "ok" }`
- [ ] `npm run dev` 能正常启动 Next.js 开发服务器
- [ ] `npm run worker:dev` 能正常启动 Worker（虽然没有任务处理）
- [ ] `.env.example` 包含所有环境变量且有注释说明
- [ ] seed 脚本能成功插入预置样本
- [ ] `src/lib/llm.ts` 能通过环境变量创建 LLM 客户端（支持自定义 BASE_URL）
