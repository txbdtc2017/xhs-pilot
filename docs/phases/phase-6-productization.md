# Phase 6：产品化收尾

> **目标**：从"能用"升级到"可发布的开源产品" — 备份恢复、PWA、文档、最终验证。

## 前序依赖

Phase 5 完成（所有 UI 页面可用，系统功能完整）

## 参考章节

- `implementation_plan.md` 第十四章 14.7-14.9（运维/安全/PWA）
- `implementation_plan.md` 第十四章 14.1（安装部署）
- `implementation_plan.md` 第十二章（风险管控）
- `implementation_plan.md` 第十三章（成功判断标准）

## 具体任务

### 1. 数据备份与恢复脚本

**`scripts/backup.sh`**：
```bash
# 导出 PostgreSQL 数据
pg_dump + 压缩
# 打包图片目录
tar uploads/
# 生成带时间戳的归档文件
```

**`scripts/restore.sh`**：
```bash
# 从归档文件恢复 PostgreSQL 数据
# 恢复图片目录
```

两个脚本必须：
- 支持 Docker 环境（通过 `docker exec` 执行）
- 有清晰的使用说明输出
- 生成带日期的归档文件名

### 2. PWA 配置

- `public/manifest.json` — 应用名称 "XHS Pilot"、图标、主题色
- 配置 `next-pwa`（或手动 Service Worker）
- 移动端"添加到主屏幕"可用
- 离线时显示友好提示页面

### 3. 安全检查

- 确认 `.env` 不在版本控制中（`.gitignore` 包含）
- 确认文件上传限制生效（类型 + 大小）
- 确认 LLM API Key 不暴露在前端代码中
- 检查 CORS 配置

### 4. README.md

编写面向开源用户的 README：

```markdown
# XHS Pilot

一句话介绍

## 功能特性（截图/GIF）

## 快速开始（3 步）

## 配置说明
  - 使用 OpenAI
  - 使用 Ollama 本地模型
  - 使用 DeepSeek
  - 使用中转代理

## 数据备份与恢复

## 技术栈

## License
```

### 5. 冷启动体验优化

- 确认 `seed.sh` 脚本能正确预置 10-20 篇高质量样本
- 数据库初始化时自动执行 seed
- 首次访问 Dashboard 不是空白页面

### 6. 端到端验证

按 Phase 1 验收标准完整走一遍：

1. **沉淀**：录入一篇爆文 → 自动分析 → 查看详情页分析结果
2. **理解**：分析结果结构化展示 → 标签 + 摘要 正确
3. **检索**：创作时输入相关主题 → 检索到该样本
4. **策略**：策略透明展示 → 标注了参考来源
5. **生成**：流式输出 → 标题 5 个 + 正文 + 封面文案 + 标签 + 首评
6. **闭环**：在历史任务中能查看完整链路

### 7. Docker 生产镜像优化

- 多阶段构建 Dockerfile（减小镜像大小）
- 确认 `docker compose up -d` 一键启动无报错
- 确认容器重启后数据不丢失（Volume 挂载正确）

## 禁止事项 ❌

- ❌ 不要添加新功能
- ❌ 不要修改核心业务逻辑
- ❌ 不要引入用户认证
- ❌ 不要实现 Phase 2/3 的功能

## 验收检查清单 ✅

- [ ] `scripts/backup.sh` 能成功导出数据
- [ ] `scripts/restore.sh` 能成功恢复数据
- [ ] PWA 可安装到手机主屏幕
- [ ] README.md 完整且包含 Ollama/DeepSeek 配置示例
- [ ] `.env` 不在 git 仓库中
- [ ] 文件上传大小限制生效
- [ ] seed 脚本预置的样本在 Dashboard 上能看到
- [ ] 端到端验证 6 步全部通过
- [ ] `docker compose up -d` 从零一键启动成功
- [ ] 容器重启后数据完好
- [ ] 开源用户修改 `.env` 中的 `LLM_BASE_URL` 后能正常使用
