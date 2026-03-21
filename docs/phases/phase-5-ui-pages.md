# Phase 5：剩余 UI 页面

> **目标**：完成所有前端页面 — Dashboard、样本库、样本详情、风格画像。系统 UI 完整可用。

## 前序依赖

Phase 4 完成（创作工作台可用，所有 API 和 Agent 已就绪）

## 参考章节

- `implementation_plan.md` 第五章 5.1-5.3, 5.5（四个页面设计）
- `implementation_plan.md` 第五章 5.4 RSC 约束表（组件渲染环境）
- `implementation_plan.md` 第八章 8.2（API 契约 — Dashboard + 风格画像部分）

## 具体任务

### 1. Dashboard 总览页

**`src/app/page.tsx`** — **Server Component**

| 区域 | 数据 |
|------|------|
| 核心数据卡片 | 总样本数、本周新增、高价值样本数、风格画像数 |
| 分布图表 | 赛道分布（饼图）、内容类型分布（柱图） |
| 最近活动 | 最近录入的 5 篇样本、最近 5 个生成任务 |
| 热门参考 | 被引用次数最多的样本 Top 5 |

API：`GET /api/dashboard/stats`

图表可使用轻量级方案（CSS 原生或 `recharts`）。

### 2. 样本库列表页

**`src/app/samples/page.tsx`** — **Server Component**

- 筛选维度：关键词搜索、赛道、内容类型、高价值标记、时间范围
- 卡片展示：封面缩略图 + 标题 + 赛道 + 类型 + 高价值标记 + 被引用次数
- 分页功能
- 点击卡片进入详情页

### 3. 样本详情页

**`src/app/samples/[id]/page.tsx`** — **Server Component（主体）+ Client Component（修正表单）**

分 5 个区域（按 5.3 节）：

| 区域 | 组件类型 |
|------|----------|
| A. 原始内容（标题/正文/图片） | Server |
| B. 解析结果（OCR 文本/自动标签） | Server |
| C. 认知结果（全部分析结果可视化展示） | Server |
| D. 关系网络（相似样本/被引用记录） | Server |
| E. 人工修正（修改标签/标记高价值） | **Client (`"use client"`)** |

认知结果需要将 JSON 数据渲染为可读的卡片/标签形式，不要直接展示 JSON。

### 4. 风格画像页

**列表页** `src/app/styles/page.tsx` — **Server Component**
- 展示所有画像列表（名称、包含样本数、典型标签）
- [创建画像] 按钮

**画像详情/编辑页** `src/app/styles/[id]/page.tsx` — **混合**
- 画像信息展示（Server）
- 包含的样本缩略图列表（Server）
- 编辑画像名称/添加移除样本（Client）

**风格画像 API**（按 8.2 节契约）：

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/style-profiles` | 画像列表 |
| `POST` | `/api/style-profiles` | 创建画像 |
| `PATCH` | `/api/style-profiles/[id]` | 更新画像 |
| `POST` | `/api/style-profiles/[id]/samples` | 添加样本 |
| `DELETE` | `/api/style-profiles/[id]/samples/[sampleId]` | 移除样本 |

Phase 1 的风格画像是**手动分组**，系统只做基于已分组样本的简单信息展示，不做自动归纳。

### 5. 全局布局 + 导航

**`src/app/layout.tsx`**：
- 左侧/顶部导航栏：Dashboard、样本库、创作工作台、风格画像
- 当前页面高亮
- 响应式适配（移动端折叠导航）

### 6. CSS 设计系统完善

补充 `variables.css` 和 `globals.css`：
- 卡片样式
- 表单样式
- 标签/Badge 样式
- 导航栏样式
- 响应式断点

## 禁止事项 ❌

- ❌ 不要修改创作工作台（Phase 4 已完成）
- ❌ 不要实现风格画像的自动归纳/推荐功能
- ❌ 不要实现复盘/反馈页面
- ❌ 不要引入 Tailwind CSS 或其他 CSS 框架
- ❌ 不要实现用户认证相关功能

## 验收检查清单 ✅

- [ ] Dashboard 页面正确展示统计数据和图表
- [ ] 样本库列表页支持筛选和分页
- [ ] 样本详情页分 5 个区域展示，分析结果以卡片形式可读展示
- [ ] 人工修正表单能修改标签、标记高价值、添加备注
- [ ] 风格画像能创建、编辑、添加/移除样本
- [ ] 全局导航功能正常，当前页面高亮
- [ ] 移动端响应式适配基本可用
- [ ] 所有页面视觉一致，使用统一的设计系统
- [ ] Server Component 和 Client Component 边界正确（无 hydration 错误）
