# XHS Pilot — 全局编码约束（所有阶段必读）

> **这份文件必须在每个阶段执行时一起提供给 AI。**
> 它定义了所有阶段共享的规范、接口契约和禁止行为。

---

## 一、核心原则

1. **只做当前阶段要求的事** — 不要"顺手"实现后续阶段的功能
2. **空壳 = 只导出接口，不写业务逻辑** — 如果阶段文档说"创建空壳"，只需要：导出函数签名 + 打印一行日志 + 抛出 `TODO` 注释。不要"预留"任何后续阶段的逻辑
3. **不要自作主张修改目录结构** — 目录结构已经在下方锁定
4. **不要引入文档未提及的第三方库** — 需要的依赖已在各阶段文档中列出
5. **遇到不确定的决定时，选择最简方案** — 不要过度设计

---

## 二、目录结构（锁定，不可修改）

```
xhs-pilot/
├── docker-compose.yml
├── Dockerfile
├── .env.example
├── package.json
├── next.config.js
│
├── migrations/                    # 数据库迁移（node-pg-migrate）
│
├── scripts/
│   ├── backup.sh
│   ├── restore.sh
│   └── seed.sh
│
├── src/
│   ├── app/                       # Next.js App Router
│   │   ├── layout.tsx
│   │   ├── page.tsx               # Dashboard
│   │   ├── samples/
│   │   │   ├── page.tsx           # 样本库列表
│   │   │   └── [id]/
│   │   │       └── page.tsx       # 样本详情
│   │   ├── create/
│   │   │   └── page.tsx           # 创作工作台
│   │   ├── styles/
│   │   │   ├── page.tsx           # 风格画像列表
│   │   │   └── [id]/
│   │   │       └── page.tsx       # 画像详情
│   │   └── api/
│   │       ├── samples/
│   │       │   ├── route.ts       # GET(列表) + POST(创建)
│   │       │   └── [id]/
│   │       │       ├── route.ts   # GET(详情) + PATCH + DELETE
│   │       │       └── status/
│   │       │           └── route.ts  # SSE 分析状态
│   │       ├── generate/
│   │       │   ├── route.ts       # POST(流式生成)
│   │       │   ├── history/
│   │       │   │   └── route.ts
│   │       │   └── [taskId]/
│   │       │       └── route.ts
│   │       ├── style-profiles/
│   │       │   ├── route.ts
│   │       │   └── [id]/
│   │       │       ├── route.ts
│   │       │       └── samples/
│   │       │           └── route.ts
│   │       ├── dashboard/
│   │       │   └── stats/
│   │       │       └── route.ts
│   │       └── health/
│   │           └── route.ts
│   │
│   ├── lib/
│   │   ├── db.ts
│   │   ├── redis.ts
│   │   ├── storage.ts
│   │   ├── llm.ts
│   │   └── logger.ts
│   │
│   ├── agents/
│   │   ├── ingestion.ts
│   │   ├── analysis.ts
│   │   ├── strategy.ts
│   │   ├── generation.ts
│   │   ├── schemas/
│   │   │   ├── analysis.ts
│   │   │   ├── visual-analysis.ts
│   │   │   ├── task-understanding.ts
│   │   │   └── strategy.ts
│   │   └── prompts/
│   │       ├── analysis.ts
│   │       ├── strategy.ts
│   │       └── generation.ts
│   │
│   ├── queues/
│   │   └── index.ts               # BullMQ 队列定义
│   │
│   ├── worker.ts                  # BullMQ Worker 入口
│   │
│   ├── components/
│   │
│   └── styles/
│       ├── globals.css
│       └── variables.css
│
└── public/
    ├── manifest.json
    └── icons/
```

> **如果需要新增文件，必须放在上述结构的对应目录中。不要创建上述结构中不存在的顶级目录。**

---

## 三、核心接口契约（跨阶段依赖）

以下是各模块的导出接口。**所有阶段必须使用这些函数签名，不可随意修改。**

### `src/lib/db.ts`

```typescript
import { Pool } from 'pg';

// 数据库连接池（单例）
export const pool: Pool;

// 通用查询辅助
export async function query<T>(text: string, params?: any[]): Promise<T[]>;
export async function queryOne<T>(text: string, params?: any[]): Promise<T | null>;

// Phase 3 新增
export async function searchSimilarSamples(params: {
  taskEmbedding: number[];
  filters: { track?: string; content_type?: string; is_reference_allowed?: boolean };
  limit?: number;
  similarityThreshold?: number;
}): Promise<SimilarSample[]>;
```

### `src/lib/redis.ts`

```typescript
import Redis from 'ioredis';

export const redis: Redis;
```

### `src/lib/llm.ts`

```typescript
import { createOpenAI } from '@ai-sdk/openai';

// LLM 客户端工厂 — 从环境变量读取配置
export const llmAnalysis: ReturnType<typeof createOpenAI>;   // LLM_MODEL_ANALYSIS
export const llmGeneration: ReturnType<typeof createOpenAI>;  // LLM_MODEL_GENERATION
export const llmVision: ReturnType<typeof createOpenAI>;      // LLM_MODEL_VISION
export const llmEmbedding: ReturnType<typeof createOpenAI>;   // EMBEDDING_MODEL
```

> **Phase 1 的 `llm.ts` 就是这几行**。读取环境变量 → 创建客户端 → 导出。没有额外逻辑。

### `src/lib/storage.ts`

```typescript
export interface StorageProvider {
  upload(file: Buffer, key: string): Promise<string>;
  getUrl(key: string): string;
  delete(key: string): Promise<void>;
}

export const storage: StorageProvider;  // Phase 1 只实现 LocalStorage
```

### `src/lib/logger.ts`

```typescript
import pino from 'pino';

export const logger: pino.Logger;
```

### `src/queues/index.ts`

```typescript
import { Queue } from 'bullmq';

export const analyzeQueue: Queue;  // sample:analyze
export const embedQueue: Queue;    // sample:embed
```

---

## 四、编码规范

### 错误处理

```typescript
// API Route 中统一使用 try-catch + NextResponse
export async function POST(request: Request) {
  try {
    // 业务逻辑
    return NextResponse.json({ data }, { status: 200 });
  } catch (error) {
    logger.error({ error }, '描述错误上下文');
    return NextResponse.json(
      { error: '用户可读的错误信息' },
      { status: 500 }
    );
  }
}
```

### 命名约定

| 类型 | 风格 | 示例 |
|------|------|------|
| 文件名 | kebab-case | `visual-analysis.ts` |
| 函数名 | camelCase | `searchSimilarSamples` |
| 类型/接口 | PascalCase | `SimilarSample` |
| 数据库字段 | snake_case | `content_type` |
| 环境变量 | UPPER_SNAKE | `LLM_BASE_URL` |
| CSS 变量 | --kebab-case | `--color-primary` |

### 导入约定

```typescript
// 使用 @/* 路径别名
import { pool } from '@/lib/db';
import { logger } from '@/lib/logger';
import { analysisSchema } from '@/agents/schemas/analysis';
```

### 日志格式

```typescript
// 用 pino 结构化日志，包含上下文
logger.info({ sampleId, status }, 'Sample analysis completed');
logger.error({ error, sampleId }, 'Analysis failed');
```

---

## 五、全局禁止行为 🚫

| 编号 | 禁止行为 | 原因 |
|------|----------|------|
| G1 | 不要安装 Tailwind CSS | 项目使用 Vanilla CSS |
| G2 | 不要添加任何用户认证代码 | 纯单机自用 |
| G3 | 不要在 Server Component 中使用 React hooks | RSC 约束 |
| G4 | 不要用 `OpenAIStream` 或 `StreamingTextResponse` | Vercel AI SDK v3+ 已废弃 |
| G5 | 不要创建 `user_id` 字段或多用户逻辑 | 无多用户设计 |
| G6 | 不要引入独立 OCR 服务 | Phase 1 用 GPT-4o Vision 端到端 |
| G7 | 不要把生成任务放进 BullMQ | 生成走流式 API，不走队列 |
| G8 | 不要修改已锁定的目录结构 | 所有阶段依赖统一结构 |
| G9 | 不要在当前阶段实现后续阶段的功能 | 避免过度设计 |
| G10 | 不要使用 `any` 类型 | 用 `unknown` + 类型守卫 |

---

## 六、阶段衔接检查点

每个阶段完成后，检查以下内容确保下一阶段能无缝衔接：

| 从 | 到 | 衔接检查 |
|----|----|----------|
| Phase 1 | Phase 2 | `db.ts` 导出 `query()` 和 `queryOne()`；`redis.ts` 导出 `redis` 实例；`llm.ts` 导出 4 个客户端；`storage.ts` 有可用的 `upload()`；BullMQ 队列定义在 `queues/index.ts`；Worker 入口文件存在 |
| Phase 2 | Phase 3 | `sample_analysis` 表有数据；`sample_embeddings` 表有向量；样本 API 可正常 CRUD |
| Phase 3 | Phase 4 | `searchSimilarSamples()` 函数可用且已测试；`taskUnderstandingSchema` 已定义 |
| Phase 4 | Phase 5 | 创作工作台页面可用；所有 Agent 和 Schema 就位；API 契约已实现 |
| Phase 5 | Phase 6 | 所有 5 个页面可用；导航完整；CSS 设计系统完善 |

---

## 七、如何给 AI 下达每个阶段的指令

模板：

```
请执行 XHS Pilot 项目的 Phase X。

全局约束请严格遵守：[附上本文件]
本阶段任务详见：[附上对应 phase-X 文件]
技术方案参考（仅看指定章节）：[附上 implementation_plan.md 的指定章节]

关键提醒：
1. 只完成本阶段的任务，不要提前实现后续阶段的功能
2. 所有文件路径和函数签名必须严格按照全局约束文件定义
3. 遇到文档中未明确的决定，选最简方案并在代码中留 TODO 注释
```
