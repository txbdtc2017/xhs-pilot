# SuplinkAI FTS-only 模式实现详解

本文档详细描述 SuplinkAI 在无 Embedding Provider 配置时的纯文本搜索(FTS-only)模式实现，包括架构设计、SQLite FTS5 使用、查询处理、多语言支持等所有技术细节。

---

## 目录

1. [FTS-only 模式概述](#1-fts-only-模式概述)
2. [触发条件与检测机制](#2-触发条件与检测机制)
3. [SQLite FTS5 架构](#3-sqlite-fts5-架构)
4. [数据库 Schema 设计](#4数据库-schema-设计)
5. [FTS 查询构建](#5-fts-查询构建)
6. [查询扩展与关键词提取](#6-查询扩展与关键词提取)
7. [多语言停用词支持](#7-多语言停用词支持)
8. [BM25 评分算法](#8-bm25-评分算法)
9. [搜索实现流程](#9-搜索实现流程)
10. [索引构建策略](#10-索引构建策略)
11. [FTS-only vs Hybrid 对比](#11-fts-only-vs-hybrid-对比)
12. [性能优化](#12-性能优化)
13. [边界情况处理](#13-边界情况处理)
14. [配置与状态](#14-配置与状态)

---

## 1. FTS-only 模式概述

### 1.1 什么是 FTS-only 模式

当用户未配置任何 Embedding Provider（缺少 API Key 或本地模型）时，系统自动降级到 **FTS-only** 模式：

- **FTS**: Full Text Search（全文搜索）
- **Only**: 仅使用关键词匹配，不使用向量相似度

### 1.2 核心特点

| 特性 | FTS-only 模式 | Hybrid 模式 |
|------|--------------|-------------|
| **成本** | 免费（纯本地） | 按调用付费 |
| **延迟** | 极低（毫秒级） | 中等（100-300ms） |
| **语义理解** | 无（关键词匹配） | 有（向量相似度） |
| **适用场景** | 精确术语搜索 | 语义/概念搜索 |

### 1.3 架构图

```
┌─────────────────────────────────────────────────────────┐
│                    FTS-only Search                       │
│                   (无 Embedding Provider)                 │
├─────────────────────────────────────────────────────────┤
│                                                          │
│   User Query                                             │
│      │                                                   │
│      ▼                                                   │
│   ┌─────────────────┐                                    │
│   │ Query Expansion │                                    │
│   │ 提取关键词       │                                    │
│   └────────┬────────┘                                    │
│            │                                             │
│            ▼                                             │
│   ┌─────────────────┐                                    │
│   │ Build FTS Query │                                    │
│   │ token1 AND token2                                    │
│   └────────┬────────┘                                    │
│            │                                             │
│            ▼                                             │
│   ┌─────────────────┐                                    │
│   │  SQLite FTS5    │                                    │
│   │  bm25() 评分    │                                    │
│   └────────┬────────┘                                    │
│            │                                             │
│            ▼                                             │
│   ┌─────────────────┐                                    │
│   │  Rank & Return  │                                    │
│   └─────────────────┘                                    │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

## 2. 触发条件与检测机制

### 2.1 Provider 初始化失败检测

```typescript
// src/memory/embeddings.ts:204-211
if (requestedProvider === "auto") {
  // 依次尝试所有 provider...
  for (const provider of REMOTE_EMBEDDING_PROVIDER_IDS) {
    try {
      return await createProvider(provider);
    } catch (err) {
      if (isMissingApiKeyError(err)) {
        missingKeyErrors.push(message);
        continue;  // 继续尝试下一个
      }
      throw err;
    }
  }

  // 全部失败 - 进入 FTS-only 模式
  return {
    provider: null,                    // ← null 表示 FTS-only
    requestedProvider,
    providerUnavailableReason: reason, // 失败原因说明
  };
}
```

### 2.2 缺失 API Key 检测

```typescript
function isMissingApiKeyError(err: unknown): boolean {
  const message = formatErrorMessage(err);
  return message.includes("No API key found for provider");
}
```

### 2.3 状态检测方法

```typescript
// src/memory/manager.ts:589-604
async probeEmbeddingAvailability(): Promise<MemoryEmbeddingProbeResult> {
  // FTS-only mode: embeddings not available but search still works
  if (!this.provider) {
    return {
      ok: false,
      error: this.providerUnavailableReason ?? "No embedding provider available (FTS-only mode)",
    };
  }
  // ...
}

// 通过 status() 查看当前模式
status() {
  const searchMode = this.provider ? "hybrid" : "fts-only";
  return {
    custom: {
      searchMode,                      // "fts-only" 或 "hybrid"
      providerUnavailableReason: this.providerUnavailableReason,
    }
  };
}
```

---

## 3. SQLite FTS5 架构

### 3.1 FTS5 简介

FTS5 (Full Text Search 5) 是 SQLite 的虚拟表扩展，提供高性能全文搜索：

- **倒排索引**: 自动构建词项到文档的映射
- **BM25 评分**: 基于概率的排名算法
- **多语言**: 支持 Unicode 分词
- **轻量级**: 无需外部服务

### 3.2 FTS5 虚拟表创建

```typescript
// src/memory/memory-schema.ts:57-68
params.db.exec(
  `CREATE VIRTUAL TABLE IF NOT EXISTS ${params.ftsTable} USING fts5(
    text,                    -- 可搜索文本内容
    id UNINDEXED,           -- 不索引（仅存储）
    path UNINDEXED,         -- 不索引
    source UNINDEXED,       -- 不索引
    model UNINDEXED,        -- 不索引
    start_line UNINDEXED,   -- 不索引
    end_line UNINDEXED      -- 不索引
  );`
);
```

**UNINDEXED**: 这些列存储在 FTS 表中但不参与搜索，用于返回结果。

### 3.3 Tokenizer 配置

```typescript
// 使用 porter + unicode61 分词器
CREATE VIRTUAL TABLE chunks_fts USING fts5(
  text,
  ...
  tokenize='porter unicode61'
);
```

**分词器说明**:
- `unicode61`: 基于 Unicode 6.1 的分词，支持多语言
- `porter`: Porter 词干提取（英文），将 "running" → "run"

---

## 4. 数据库 Schema 设计

### 4.1 完整表结构

```sql
-- 1. 核心数据表（所有模式都需要）
CREATE TABLE chunks (
  id TEXT PRIMARY KEY,          -- SHA256 哈希作为 ID
  path TEXT NOT NULL,           -- 文件路径
  source TEXT NOT NULL,         -- 'memory' | 'sessions'
  start_line INTEGER NOT NULL,  -- 起始行号
  end_line INTEGER NOT NULL,    -- 结束行号
  hash TEXT NOT NULL,           -- 内容哈希
  model TEXT NOT NULL,          -- 模型名称（FTS-only 时为 "fts-only"）
  text TEXT NOT NULL,           -- 文本内容
  embedding TEXT,               -- JSON 向量（FTS-only 时为空）
  updated_at INTEGER NOT NULL
);

-- 2. 文件元数据表
CREATE TABLE files (
  path TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  hash TEXT NOT NULL,
  mtime INTEGER NOT NULL,
  size INTEGER NOT NULL
);

-- 3. FTS5 虚拟表（FTS-only 模式的核心）
CREATE VIRTUAL TABLE chunks_fts USING fts5(
  text,
  id UNINDEXED,
  path UNINDEXED,
  source UNINDEXED,
  model UNINDEXED,
  start_line UNINDEXED,
  end_line UNINDEXED,
  tokenize='porter unicode61'
);

-- 4. Embedding 缓存表（FTS-only 模式不使用）
CREATE TABLE embedding_cache (
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  provider_key TEXT NOT NULL,
  hash TEXT NOT NULL,
  embedding TEXT NOT NULL,
  dims INTEGER,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (provider, model, provider_key, hash)
);

-- 5. 元数据表
CREATE TABLE meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
```

### 4.2 FTS-only 与 Hybrid 模式的数据差异

| 字段/表 | FTS-only | Hybrid |
|---------|----------|--------|
| `chunks.embedding` | 空字符串 `""` | JSON 向量 |
| `chunks_fts` | ✓ 完整 | ✓ 完整 |
| `chunks_vec` (sqlite-vec) | ✗ 不存在 | ✓ 存在 |
| `embedding_cache` | 不使用 | 使用 |

---

## 5. FTS 查询构建

### 5.1 基础查询构建函数

```typescript
// src/memory/hybrid.ts:33-44
export function buildFtsQuery(raw: string): string | null {
  // 1. 提取字母数字下划线 token
  const tokens = raw
    .match(/[\p{L}\p{N}_]+/gu)   // Unicode 字母、数字、下划线
    ?.map((t) => t.trim())
    .filter(Boolean) ?? [];
  
  if (tokens.length === 0) {
    return null;
  }
  
  // 2. 转义双引号并加引号
  const quoted = tokens.map((t) => `"${t.replaceAll('"', "")}"`);
  
  // 3. 用 AND 连接（所有词都必须出现）
  return quoted.join(" AND ");
}
```

### 5.2 查询示例

| 用户输入 | 构建的 FTS Query |
|---------|-----------------|
| "API documentation" | `"API" AND "documentation"` |
| "user authentication" | `"user" AND "authentication"` |
| "如何处理错误" | `"如何" AND "处理" AND "错误"` |

### 5.3 复杂查询支持

SQLite FTS5 支持更复杂的查询语法：

```sql
-- NEAR 查询（词 proximity）
text NEAR/5("error" "handling")

-- 前缀匹配
"auth*"

-- 短语匹配
"machine learning"

-- OR 查询
"python" OR "javascript"

-- 排除
"programming" NOT "python"
```

---

## 6. 查询扩展与关键词提取

### 6.1 为什么需要查询扩展

用户常输入口语化查询：
- "that thing we discussed about the API"
- "之前讨论的那个方案"
- "昨天说的 bug"

FTS 直接匹配会失败，需要提取关键词：
- → `["discussed", "API"]`
- → `["讨论", "方案"]`
- → `["bug"]`

### 6.2 关键词提取流程

```typescript
// src/memory/query-expansion.ts:723-754
export function extractKeywords(query: string): string[] {
  const tokens = tokenize(query);     // 分词
  const keywords: string[] = [];
  const seen = new Set<string>();

  for (const token of tokens) {
    // 1. 跳过停用词
    if (isStopWord(token)) {
      continue;
    }
    
    // 2. 跳过无效关键词
    if (!isValidKeyword(token)) {
      continue;
    }
    
    // 3. 去重
    if (seen.has(token)) {
      continue;
    }
    
    seen.add(token);
    keywords.push(token);
  }

  return keywords;
}
```

### 6.3 多语言分词

```typescript
// src/memory/query-expansion.ts:661-713
function tokenize(text: string): string[] {
  const tokens: string[] = [];
  const segments = normalized.split(/[\s\p{P}]+/u).filter(Boolean);

  for (const segment of segments) {
    if (/[\u3040-\u30ff]/.test(segment)) {
      // 日语：分离假名和汉字
      const jpParts = segment.match(
        /[a-z0-9_]+|[\u30a0-\u30ffー]+|[\u4e00-\u9fff]+|[\u3040-\u309f]{2,}/g
      ) ?? [];
      // ...
    } else if (/[\u4e00-\u9fff]/.test(segment)) {
      // 中文：提取单字和双字
      const chars = Array.from(segment).filter((c) => /[\u4e00-\u9fff]/.test(c));
      tokens.push(...chars);           // 单字
      for (let i = 0; i < chars.length - 1; i++) {
        tokens.push(chars[i] + chars[i + 1]);  // 双字
      }
    } else if (/[\uac00-\ud7af\3131-\u3163]/.test(segment)) {
      // 韩语：去除助词
      const stem = stripKoreanTrailingParticle(segment);
      // ...
    } else {
      // 其他语言
      tokens.push(segment);
    }
  }

  return tokens;
}
```

### 6.4 关键词验证

```typescript
function isValidKeyword(token: string): boolean {
  // 跳过过短英文词
  if (/^[a-zA-Z]+$/.test(token) && token.length < 3) {
    return false;
  }
  
  // 跳过纯数字
  if (/^\d+$/.test(token)) {
    return false;
  }
  
  // 跳过纯标点
  if (/^[\p{P}\p{S}]+$/u.test(token)) {
    return false;
  }
  
  return true;
}
```

---

## 7. 多语言停用词支持

### 7.1 停用词列表

支持 7 种语言：

```typescript
// src/memory/query-expansion.ts
const STOP_WORDS_EN = new Set(["a", "an", "the", "this", "that", ...]);      // 英文
const STOP_WORDS_ZH = new Set(["的", "了", "是", "我", "你", ...]);          // 中文
const STOP_WORDS_JA = new Set(["これ", "する", "です", ...]);                 // 日语
const STOP_WORDS_KO = new Set(["은", "는", "이", "가", ...]);                // 韩语
const STOP_WORDS_ES = new Set(["el", "la", "de", "y", ...]);                // 西班牙语
const STOP_WORDS_PT = new Set(["o", "a", "de", "e", ...]);                  // 葡萄牙语
const STOP_WORDS_AR = new Set(["ال", "و", "أو", "في", ...]);                // 阿拉伯语
```

### 7.2 停用词分类

**通用停用词类型**:

| 类型 | 英文示例 | 中文示例 |
|------|---------|---------|
| 冠词 | a, an, the | - |
| 代词 | I, you, he, this | 我, 你, 这, 那 |
| 介词 | in, on, at, to | 在, 到, 从 |
| 连词 | and, or, but | 和, 与, 但是 |
| 助动词 | is, are, was, have | 是, 有, 在 |
| 时间词 | yesterday, today | 昨天, 今天 |
| 模糊词 | thing, stuff | 东西, 事情 |

### 7.3 特殊语言处理

**韩语助词去除**:
```typescript
const KO_TRAILING_PARTICLES = [
  "에서", "으로", "에게", "한테",  // 格助词
  "은", "는", "이", "가",          // 主题/主格助词
  "을", "를", "의", "에",          // 宾格/属格助词
  "와", "과", "도", "만",          // 连接助词
];

function stripKoreanTrailingParticle(token: string): string | null {
  for (const particle of KO_TRAILING_PARTICLES) {
    if (token.length > particle.length && token.endsWith(particle)) {
      return token.slice(0, -particle.length);
    }
  }
  return null;
}

// "API를" → "API"
// "논의에" → "논의"
```

---

## 8. BM25 评分算法

### 8.1 BM25 简介

BM25 (Best Match 25) 是基于概率的信息检索排序算法，由 Okapi 系统开发。

**公式**:
```
score(D,Q) = Σ IDF(q_i) * [f(q_i,D) * (k1 + 1)] / [f(q_i,D) + k1 * (1 - b + b * |D|/avgDL)]

其中:
- f(q_i,D): 词 q_i 在文档 D 中的频率
- |D|: 文档长度
- avgDL: 平均文档长度
- k1=1.2, b=0.75 (默认参数)
```

### 8.2 SQLite FTS5 BM25 实现

```typescript
// src/memory/hybrid.ts:46-49
export function bm25RankToScore(rank: number): number {
  // SQLite FTS5 bm25() 返回排名（越小越相关）
  const normalized = Number.isFinite(rank) ? Math.max(0, rank) : 999;
  
  // 转换为 0-1 分数（越大越相关）
  return 1 / (1 + normalized);
}
```

### 8.3 BM25 查询示例

```sql
-- 使用 bm25() 函数获取排名
SELECT 
  id, path, source, start_line, end_line, text,
  bm25(chunks_fts) AS rank
FROM chunks_fts
WHERE chunks_fts MATCH '"API" AND "documentation"'
ORDER BY rank ASC  -- 排名越小越靠前
LIMIT 20;
```

### 8.4 排名转分数

| BM25 Rank | 转换后 Score | 含义 |
|-----------|-------------|------|
| 0 | 1.0 | 完美匹配 |
| 1 | 0.5 | 很好匹配 |
| 2 | 0.33 | 良好匹配 |
| 5 | 0.17 | 一般匹配 |
| 10 | 0.09 | 较弱匹配 |

---

## 9. 搜索实现流程

### 9.1 完整搜索代码

```typescript
// src/memory/manager.ts:220-267
async search(query: string, opts?: { maxResults?: number; minScore?: number }): Promise<MemorySearchResult[]> {
  const maxResults = opts?.maxResults ?? this.settings.query.maxResults;
  const minScore = opts?.minScore ?? this.settings.query.minScore;
  const cleaned = query.trim();
  
  if (!cleaned) {
    return [];
  }

  // FTS-only mode: no embedding provider available
  if (!this.provider) {
    // 1. 检查 FTS 是否可用
    if (!this.fts.enabled || !this.fts.available) {
      log.warn("memory search: no provider and FTS unavailable");
      return [];
    }

    // 2. 提取关键词优化搜索
    const keywords = extractKeywords(cleaned);
    const searchTerms = keywords.length > 0 ? keywords : [cleaned];

    // 3. 用每个关键词搜索并合并结果
    const resultSets = await Promise.all(
      searchTerms.map((term) => this.searchKeyword(term, maxResults).catch(() => []))
    );

    // 4. 合并、去重、保留最高分数
    const seenIds = new Map<string, MemorySearchResult>();
    for (const results of resultSets) {
      for (const result of results) {
        const existing = seenIds.get(result.id);
        if (!existing || result.score > existing.score) {
          seenIds.set(result.id, result);
        }
      }
    }

    // 5. 排序、过滤、截断
    const merged = [...seenIds.values()]
      .toSorted((a, b) => b.score - a.score)
      .filter((entry) => entry.score >= minScore)
      .slice(0, maxResults);

    return merged;
  }

  // Hybrid 模式...
}
```

### 9.2 关键词搜索实现

```typescript
// src/memory/manager-search.ts:136-191
export async function searchKeyword(params: {
  db: DatabaseSync;
  ftsTable: string;
  providerModel: string | undefined;  // FTS-only 时为 undefined
  query: string;
  limit: number;
  sourceFilter: { sql: string; params: SearchSource[] };
}): Promise<SearchRowResult[]> {
  // 1. 构建 FTS 查询
  const ftsQuery = params.buildFtsQuery(params.query);
  if (!ftsQuery) {
    return [];
  }

  // 2. FTS-only 模式：搜索所有模型；Hybrid 模式：只搜索当前模型
  const modelClause = params.providerModel ? " AND model = ?" : "";
  const modelParams = params.providerModel ? [params.providerModel] : [];

  // 3. 执行搜索
  const rows = params.db
    .prepare(
      `SELECT id, path, source, start_line, end_line, text,
              bm25(${params.ftsTable}) AS rank
         FROM ${params.ftsTable}
        WHERE ${params.ftsTable} MATCH ?${modelClause}${params.sourceFilter.sql}
        ORDER BY rank ASC
        LIMIT ?`
    )
    .all(ftsQuery, ...modelParams, ...params.sourceFilter.params, params.limit);

  // 4. 转换为结果格式
  return rows.map((row) => ({
    id: row.id,
    path: row.path,
    startLine: row.start_line,
    endLine: row.end_line,
    score: params.bm25RankToScore(row.rank),
    snippet: truncateUtf16Safe(row.text, params.snippetMaxChars),
    source: row.source,
  }));
}
```

---

## 10. 索引构建策略

### 10.1 FTS-only 模式索引流程

```typescript
// src/memory/manager-embedding-ops.ts:693-806
protected async indexFile(
  entry: MemoryFileEntry | SessionFileEntry,
  options: { source: MemorySource; content?: string }
) {
  // 1. FTS-only mode: skip embedding indexing if no provider
  if (!this.provider) {
    log.debug("Skipping embedding indexing in FTS-only mode", {
      path: entry.path,
      source: options.source,
    });
    // 继续执行 FTS 索引...
  }

  const content = options.content ?? (await fs.readFile(entry.absPath, "utf-8"));
  
  // 2. 分块（不计算 embedding）
  const chunks = chunkMarkdown(content, this.settings.chunking).filter(
    (chunk) => chunk.text.trim().length > 0
  );

  // 3. 删除旧数据
  this.db.prepare(`DELETE FROM chunks WHERE path = ? AND source = ?`)
    .run(entry.path, options.source);

  // 4. 插入新数据（无 embedding）
  for (const chunk of chunks) {
    const id = hashText(`${options.source}:${entry.path}:${chunk.startLine}:${chunk.endLine}:${chunk.hash}`);
    
    this.db.prepare(
      `INSERT INTO chunks (id, path, source, start_line, end_line, hash, model, text, embedding, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      entry.path,
      options.source,
      chunk.startLine,
      chunk.endLine,
      chunk.hash,
      "fts-only",           // ← FTS-only 模式使用固定模型名
      chunk.text,
      "",                   // ← embedding 为空字符串
      Date.now()
    );

    // 5. 插入 FTS 索引
    if (this.fts.enabled && this.fts.available) {
      this.db.prepare(
        `INSERT INTO ${FTS_TABLE} (text, id, path, source, model, start_line, end_line)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(
        chunk.text,
        id,
        entry.path,
        options.source,
        "fts-only",
        chunk.startLine,
        chunk.endLine
      );
    }
  }

  // 6. 更新文件记录
  this.db.prepare(
    `INSERT INTO files (path, source, hash, mtime, size) VALUES (?, ?, ?, ?, ?)`
  ).run(entry.path, options.source, entry.hash, entry.mtimeMs, entry.size);
}
```

### 10.2 同步跳过策略

```typescript
// src/memory/manager-sync-ops.ts:634-638
private async syncMemoryFiles(params: { needsFullReindex: boolean }) {
  // FTS-only mode: skip embedding sync (no provider)
  if (!this.provider) {
    log.debug("Skipping memory file sync in FTS-only mode (no embedding provider)");
    return;  // 完全不进行文件同步
  }
  // Hybrid 模式：继续索引...
}

// src/memory/manager-sync-ops.ts:715-719
private async syncSessionFiles(params: { needsFullReindex: boolean }) {
  // FTS-only mode: skip embedding sync (no provider)
  if (!this.provider) {
    log.debug("Skipping session file sync in FTS-only mode (no embedding provider)");
    return;
  }
  // ...
}
```

---

## 11. FTS-only vs Hybrid 对比

### 11.1 功能对比

| 功能 | FTS-only | Hybrid |
|------|----------|--------|
| **关键词搜索** | ✓ | ✓ |
| **语义搜索** | ✗ | ✓ |
| **向量相似度** | ✗ | ✓ |
| **多语言支持** | ✓ | ✓ |
| **停用词过滤** | ✓ | ✓ |
| **查询扩展** | ✓ | ✓ |
| **MMR 重排序** | ✗ | ✓ |
| **时序衰减** | ✗ | ✓ |
| **Embedding 缓存** | ✗ | ✓ |
| **Batch API** | ✗ | ✓ |

### 11.2 搜索质量对比

**FTS-only 擅长**:
- 精确术语匹配（API、function name、error code）
- 代码片段搜索
- 文档标题搜索

**FTS-only 不擅长**:
- 语义相似（"car" vs "automobile"）
- 概念搜索（"data structure" vs "linked list"）
- 上下文理解

**示例对比**:

| 查询 | FTS-only 结果 | Hybrid 结果 |
|------|--------------|-------------|
| "authentication" | 包含该词的内容 | 包含 auth/login/verify 的内容 |
| "bug fix" | 含这两个词的内容 | 含 error/issue/problem 的内容 |
| "部署方案" | 含"部署"和"方案"的内容 | 含 deploy/release/strategy 的内容 |

### 11.3 性能对比

| 指标 | FTS-only | Hybrid |
|------|----------|--------|
| **搜索延迟** | 1-5ms | 50-200ms |
| **索引延迟** | 10-100ms/文件 | 1-5s/文件 |
| **内存占用** | 低 | 中等 |
| **存储占用** | ~1x 文本大小 | ~2-5x 文本大小 |
| **网络请求** | 0 | 每查询 1-2 次 |
| **API 成本** | 免费 | $0.02-0.10/1K tokens |

---

## 12. 性能优化

### 12.1 FTS 查询优化

**1. 限制候选数量**:
```typescript
const candidates = Math.max(1, Math.floor(maxResults * 2));
// 先取 2x 结果用于过滤
```

**2. 并发关键词搜索**:
```typescript
const resultSets = await Promise.all(
  searchTerms.map((term) => this.searchKeyword(term, candidates))
);
```

**3. 去重策略**:
```typescript
const seenIds = new Map<string, Result>();
for (const results of resultSets) {
  for (const result of results) {
    const existing = seenIds.get(result.id);
    if (!existing || result.score > existing.score) {
      seenIds.set(result.id, result);  // 保留最高分
    }
  }
}
```

### 12.2 索引优化

```sql
-- chunks 表索引
CREATE INDEX idx_chunks_path ON chunks(path);
CREATE INDEX idx_chunks_source ON chunks(source);

-- FTS 表自动维护倒排索引
-- 无需手动创建额外索引
```

### 12.3 内存优化

**分块大小配置**:
```yaml
memorySearch:
  chunking:
    tokens: 500      # 减小块大小降低内存使用
    overlap: 50
```

---

## 13. 边界情况处理

### 13.1 FTS 不可用时的降级

```typescript
// src/memory/manager.ts:234-238
if (!this.provider) {
  if (!this.fts.enabled || !this.fts.available) {
    log.warn("memory search: no provider and FTS unavailable");
    return [];  // 两者都不可用，返回空
  }
  // ...
}
```

**FTS 不可用的原因**:
- SQLite 编译时未启用 FTS5
- 权限不足创建虚拟表
- 存储空间不足

### 13.2 空查询处理

```typescript
const cleaned = query.trim();
if (!cleaned) {
  return [];  // 空查询直接返回
}
```

### 13.3 无结果处理

```typescript
const ftsQuery = buildFtsQuery(params.query);
if (!ftsQuery) {
  return [];  // 无法构建有效查询（如全是停用词）
}
```

### 13.4 模型切换处理

当用户后续配置了 Provider，系统需要：
1. 检测 Provider 可用性变化
2. 标记所有文件为 dirty（需要重新索引）
3. 下次搜索时自动重建索引

```typescript
// 切换时重置索引
resetManager(manager: MemoryIndexManager) {
  (manager as unknown as { resetIndex: () => void }).resetIndex();
  (manager as unknown as { dirty: boolean }).dirty = true;
}
```

---

## 14. 配置与状态

### 14.1 相关配置项

```yaml
agents:
  defaults:
    memorySearch:
      enabled: true
      sources: ["memory", "sessions"]
      
      # FTS-only 时忽略以下配置
      provider: "auto"           # 会被检测为 null
      model: "text-embedding-3-small"
      fallback: "none"
      
      # FTS 相关配置
      query:
        maxResults: 10
        minScore: 0.1            # FTS-only 可适当降低
        hybrid:
          enabled: false         # FTS-only 时无效
      
      # FTS5 配置
      store:
        vector:
          enabled: false         # FTS-only 不需要向量扩展
```

### 14.2 状态查询

```typescript
// 通过 API 或 CLI 查询状态
const status = memoryManager.status();

/*
{
  backend: "builtin",
  provider: "none",              // ← FTS-only 标识
  model: undefined,
  requestedProvider: "auto",
  searchMode: "fts-only",        // ← 当前模式
  fts: {
    enabled: true,
    available: true
  },
  vector: {
    enabled: false,
    available: false
  },
  custom: {
    providerUnavailableReason: "Local embeddings unavailable.\nOr set agents.defaults.memorySearch.provider = 'openai' (remote)."
  }
}
*/
```

### 14.3 日志输出

**FTS-only 模式启动**:
```
[memory] memory embeddings: batch start { provider: null, items: 0 }
[memory] Skipping memory file sync in FTS-only mode (no embedding provider)
[memory] searchMode: fts-only
```

**搜索日志**:
```
[memory] memory search: FTS-only search { query: "API documentation", keywords: ["API", "documentation"] }
```

---

## 附录 A: FTS5 高级用法

### A.1 前缀匹配

```sql
-- 匹配 "doc", "document", "documentation" 等
SELECT * FROM chunks_fts WHERE text MATCH 'doc*';
```

### A.2 NEAR 操作符

```sql
-- "error" 和 "handling" 在 10 个词以内
SELECT * FROM chunks_fts WHERE text MATCH 'error NEAR/10 handling';
```

### A.3 列过滤

```sql
-- 仅搜索特定列（ FTS5 不支持，需通过 JOIN）
SELECT c.* FROM chunks_fts fts
JOIN chunks c ON c.id = fts.id
WHERE fts MATCH 'keyword' AND c.source = 'memory';
```

### A.4 高亮显示

```sql
-- 使用 highlight() 函数
SELECT 
  highlight(chunks_fts, 0, '[', ']') as highlighted_text,
  *
FROM chunks_fts
WHERE chunks_fts MATCH 'API';
```

---

## 附录 B: 文件清单

### FTS-only 核心文件

| 文件 | 职责 |
|------|------|
| `src/memory/hybrid.ts` | FTS 查询构建、BM25 转换 |
| `src/memory/query-expansion.ts` | 关键词提取、停用词、多语言支持 |
| `src/memory/manager-search.ts` | searchKeyword() 实现 |
| `src/memory/memory-schema.ts` | FTS5 表创建 |

### 相关管理文件

| 文件 | FTS-only 相关代码 |
|------|------------------|
| `src/memory/manager.ts` | search() 方法 FTS-only 分支 |
| `src/memory/manager-embedding-ops.ts` | indexFile() 跳过 embedding |
| `src/memory/manager-sync-ops.ts` | syncMemoryFiles() 跳过同步 |
| `src/memory/embeddings.ts` | provider: null 返回 |

---

## 附录 C: 常见问题

### Q: FTS-only 模式下如何获得更好的搜索结果？

**A**: 
1. 使用更精确的关键词
2. 避免口语化表达
3. 使用专业术语
4. 适当降低 `minScore` 阈值

### Q: 能否从 FTS-only 切换到 Hybrid？

**A**: 可以，配置 Provider 后系统会自动检测并重建索引。

### Q: FTS-only 支持正则搜索吗？

**A**: 不支持，FTS5 只支持前缀通配（`word*`）和 NEAR 查询。

### Q: 中文搜索效果如何？

**A**: FTS5 的 unicode61 分词器对中文按字分词，效果尚可。对于专业术语建议使用 Hybrid 模式。

---

**文档版本**: 1.0  
**最后更新**: 2026-03-22  
**作者**: SuplinkAI Team
