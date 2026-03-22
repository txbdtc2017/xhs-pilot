# Phase 6：产品化收尾

> **目标**：基于已完成的 Phase 1-5 实现，把系统收口为一个可发布、可部署、可验证的开源产品版本。

## 前序依赖

Phase 5 完成（所有 UI 页面可用，系统功能完整）

## 参考章节

- `implementation_plan.md` 第十四章 14.7-14.9（运维/安全/PWA）
- `implementation_plan.md` 第十四章 14.1（安装部署）
- `implementation_plan.md` 第十二章（风险管控）
- `implementation_plan.md` 第十三章（成功判断标准）

## 具体任务

### 1. 运行时与部署真相对齐

- 官方支持部署方式固定为：`Docker Compose`
- 官方支持存储方式固定为：`STORAGE_PROVIDER=local`
- 新增 `GET /uploads/[...path]`，对既有 `/uploads/...` 图片 URL 提供本地文件访问能力
- 保留 `./uploads:/app/uploads` bind mount
- 新增 `.dockerignore`，避免 `.env`、`.next`、`uploads`、日志等进入构建上下文
- 若 `STORAGE_PROVIDER` 不是 `local`，应用启动时直接报错，不再伪装支持 `s3/r2`

### 2. 数据备份与恢复脚本

**`scripts/backup.sh`** 必须：
- 仅支持 `Docker Compose + STORAGE_PROVIDER=local`
- 检查 Compose 服务是否运行
- 导出 PostgreSQL 为 `database.sql.gz`
- 打包 `./uploads` 为 `uploads.tar.gz`
- 生成 `metadata.json`
- 最终产出 `backups/xhs-pilot-YYYYMMDD-HHMMSS.tar.gz`
- 提供 `--help`

**`scripts/restore.sh`** 必须：
- 要求传入归档路径和 `--force`
- 校验归档结构完整
- 重建 `public schema` 后再导入 SQL
- 恢复本地 `./uploads`
- 若 `STORAGE_PROVIDER!=local` 直接拒绝执行
- 提供 `--help`

### 3. 上传限制与安全硬化

- 样本上传仅允许 `image/jpeg`、`image/png`、`image/webp`
- 单文件大小读取 `MAX_UPLOAD_SIZE_MB`
- 单次上传最多 9 张图
- MIME 缺失、空文件、扩展名与 MIME 不匹配时直接拒绝
- API 保持 same-origin，不额外开放 CORS
- 增加基础安全头：
  - `X-Content-Type-Options`
  - `Referrer-Policy`
  - `X-Frame-Options`
- `sw.js` 返回 no-cache 头，避免旧 Service Worker 长驻
- LLM Key 仅允许服务端读取，不引入任何 `NEXT_PUBLIC_*` secret

### 4. PWA 配置

- 不使用 `next-pwa`
- 使用 `app/manifest.ts` 生成 manifest
- 使用 `public/sw.js` 实现最小 Service Worker
- 使用 `app/offline/page.tsx` 作为离线提示页
- 提供 `public/icons/` 图标资源
- 浏览器“添加到主屏幕”可用
- 导航请求失败时回退到 `/offline`

PWA 只承诺：
- 可安装
- 可缓存静态壳
- 离线时有友好提示

PWA 不承诺：
- 离线生成
- 离线样本浏览
- 离线数据库或队列执行

### 5. 历史链路查看入口

- 不新增新的主导航页面
- 复用现有：
  - `GET /api/generate/history`
  - `GET /api/generate/[taskId]`
- 在 `/create` 内增加历史任务区和详情区
- 支持 `/create?taskId=<id>` 深链
- Dashboard 的最近任务和样本详情里的引用任务，都跳转到 `/create?taskId=<id>`

### 6. README、示例配置与 roadmap

- README 需以仓库真实实现为准，而不是早期计划描述
- 新增 `.env.example`
- README 必须覆盖：
  - Docker Compose 一键启动
  - 默认端口 `17789` 与 `PORT` 注入方式
  - `npm run seed` 是手动演示数据命令，不承诺检索链路冒烟
  - Vision provider 独立配置（`VISION_PROTOCOL` 回退到 `LLM_PROTOCOL`，`VISION_*` 继续逐字段回退到 `LLM_*`）
  - OpenAI / Anthropic Messages（Kimi coding）/ Ollama / DeepSeek / 中转代理配置示例
  - Embedding 独立 provider 说明
  - 备份恢复
  - 手动清理开发环境测试数据
  - same-origin 安全模型
  - 已知限制
- `docs/roadmap.md` 记录延期项：
  - `s3/r2` 支持与 provider-aware 备份恢复
  - 首启自动 demo bootstrap
  - 独立历史页 / 对比 / 导出
  - 更强部署安全选项

### 7. 冷启动体验

- 不在 Phase 6 实现自动首启 seed
- `seed.sh` / `seed.ts` 提供 10-12 条演示样本
- seed 只负责插入演示样本，不自动补齐分析、embedding 或检索结果
- 空状态要友好，可选手动 `npm run seed`

### 8. 端到端验证

至少覆盖：

1. 录入一篇带图样本，图片可正常访问
2. 样本进入分析队列，详情页可查看结构化结果
3. 创作时能检索到相关样本
4. 策略区可看到任务理解、参考、策略快照
5. 生成结果区可看到流式输出和结构化结果
6. 在 `/create?taskId=<id>` 查看完整历史链路
7. `bash scripts/backup.sh` 和 `bash scripts/restore.sh ... --force` 可执行
8. PWA 可安装，断网后进入 `/offline`

### 9. Docker 生产镜像优化

- 保留现有多阶段 Dockerfile
- `docker compose up -d --build` 能启动成功
- `uploads` 使用 bind mount，数据库与 Redis 继续使用命名卷
- 容器重启后数据不丢失

## 禁止事项 ❌

- ❌ 不要添加新功能
- ❌ 不要修改核心业务逻辑
- ❌ 不要引入用户认证
- ❌ 不要在本阶段强行实现 `s3/r2`
- ❌ 不要实现自动首启 seed
- ❌ 不要补做 Phase 2/3 才应该出现的能力

## 验收检查清单 ✅

- [ ] `GET /uploads/[...path]` 能正常返回本地图片
- [ ] `scripts/backup.sh` 能导出 `database.sql.gz`、`uploads.tar.gz`、`metadata.json`
- [ ] `scripts/restore.sh` 仅在 `--force` 下执行并成功恢复
- [ ] 上传限制生效：类型 / 大小 / 数量
- [ ] PWA 可安装，离线时进入 `/offline`
- [ ] `/create?taskId=<id>` 可查看完整链路
- [ ] README、`.env.example`、`docs/roadmap.md` 与现状一致
- [ ] `docker compose up -d --build` 一键启动成功
- [ ] `npm run check` 通过
