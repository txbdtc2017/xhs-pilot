# Phase 1: Project Scaffold & Infrastructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Initialize the Next.js project, set up Docker infrastructure, create database migrations for all 12 tables + vector extension, and implement core library shells (DB, Redis, Storage, LLM, Logger).

**Architecture:** Next.js 15 (App Router) with a separate BullMQ Worker for slow tasks. PostgreSQL + pgvector for storage and semantic search. Redis for queuing.

**Tech Stack:** Next.js, TypeScript, PostgreSQL, pgvector, Redis, BullMQ, Vercel AI SDK, Pino, Vanilla CSS.

---

### Task 1: Initialize Next.js Project & Install Dependencies

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `src/` directory.

- [ ] **Step 1: Run create-next-app**
Run: `npx -y create-next-app@latest ./ --typescript --app --eslint --no-tailwind --src-dir --import-alias "@/*"`

- [ ] **Step 2: Install core dependencies**
Run: `npm install pg pgvector bullmq ioredis ai @ai-sdk/openai pino pino-pretty zod`

- [ ] **Step 3: Install dev dependencies**
Run: `npm install -D @types/pg node-pg-migrate tsx`

- [ ] **Step 4: Verify basic project structure**
Ensure `src/app`, `src/lib`, `src/agents`, `src/queues` directories exist or create them.

---

### Task 2: Infrastructure Configuration (Docker & Env)

**Files:**
- Create: `docker-compose.yml`
- Create: `Dockerfile`
- Create: `.env.example`

- [ ] **Step 1: Create Dockerfile**
Create `Dockerfile` for Next.js and Worker.

- [ ] **Step 2: Create docker-compose.yml**
Define `app`, `worker`, `postgres` (pgvector/pgvector:pg16), and `redis` services.

- [ ] **Step 3: Create .env.example**
Populate with all necessary variables from implementation_plan.md section 14.2.

---

### Task 3: Database Migrations

**Files:**
- Create: `migrations/001_create-samples.sql` to `migrations/013_create-indexes.sql`

- [ ] **Step 1: Create migrations directory**
`mkdir migrations`

- [ ] **Step 2: Create 001_create-samples.sql**
Include `CREATE EXTENSION IF NOT EXISTS vector;` and `samples` table.

- [ ] **Step 3: Create 002 to 012 migration files**
Follow schemas in implementation_plan.md Chapter 6.

- [ ] **Step 4: Create 013_create-indexes.sql**
Include pgvector IVFFlat index.

---

### Task 4: Core Library Shells (src/lib)

**Files:**
- Create: `src/lib/db.ts`
- Create: `src/lib/redis.ts`
- Create: `src/lib/storage.ts`
- Create: `src/lib/llm.ts`
- Create: `src/lib/logger.ts`

- [ ] **Step 1: Implement src/lib/logger.ts**
Use `pino` and `pino-pretty`.

- [ ] **Step 2: Implement src/lib/db.ts**
Export `pool`, `query`, and `queryOne`.

- [ ] **Step 3: Implement src/lib/redis.ts**
Export `redis` instance.

- [ ] **Step 4: Implement src/lib/storage.ts**
Interface `StorageProvider` and `LocalStorage` class.

- [ ] **Step 5: Implement src/lib/llm.ts**
Export 4 clients using `createOpenAI`.

---

### Task 5: Queue & Worker Setup

**Files:**
- Create: `src/queues/index.ts`
- Create: `src/worker.ts`

- [ ] **Step 1: Implement src/queues/index.ts**
Define `analyzeQueue` and `embedQueue`.

- [ ] **Step 2: Implement src/worker.ts (skeleton)**
Basic worker loop that logs "Worker started".

---

### Task 6: CSS Design System

**Files:**
- Create: `src/styles/variables.css`
- Modify: `src/styles/globals.css`

- [ ] **Step 1: Create variables.css**
Define colors, spacing, and typography variables.

- [ ] **Step 2: Update globals.css**
Import `variables.css` and set up base resets.

---

### Task 7: Health Check API & Seed Script

**Files:**
- Create: `src/app/api/health/route.ts`
- Create: `scripts/seed.sh`
- Modify: `package.json`

- [ ] **Step 1: Create health check API**
Check DB and Redis connectivity.

- [ ] **Step 2: Create seed.sh**
Insert sample data into `samples` table.

- [ ] **Step 3: Update package.json scripts**
Add `db:migrate`, `worker:dev`, `seed`, etc.

---

### Task 8: Verification

- [ ] **Step 1: Build and start docker-compose**
Run: `docker compose up -d`

- [ ] **Step 2: Run migrations**
Run: `npm run db:migrate`

- [ ] **Step 3: Verify Health Check**
Run: `curl http://localhost:3000/api/health`
Expected: `{ "db": "ok", "redis": "ok" }`
