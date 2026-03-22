# Contributing to XHS Pilot

感谢你愿意改进 XHS Pilot。

这个项目当前的定位很明确：`单用户`、`自托管`、`Docker Compose`、`STORAGE_PROVIDER=local`。提交变更前，请先判断你的改动是否符合这条边界；超出当前支持范围的能力，更适合先开 issue 讨论，或直接进入 roadmap。

## 开始之前

1. 先阅读 [README.md](README.md) 了解项目定位和启动方式。
2. 如果你的改动会影响发布或产品边界，再看 [docs/release-playbook.md](docs/release-playbook.md) 和 [docs/roadmap.md](docs/roadmap.md)。
3. 优先从 issue 开始，而不是直接提交大改。

## 本地开发

建议使用 Node.js 20。

安装依赖：

```bash
npm install
```

本地开发：

```bash
npm run dev
npm run worker:dev
```

如果你只是想直接使用产品，而不是开发，请按 [README.md](README.md) 里的 Docker Compose 方式启动。

## 提交前检查

提交 PR 前，至少运行：

```bash
npm run check
```

如果你的改动影响部署或配置，建议再验证：

```bash
docker compose config
```

如果你的改动影响了界面、交互或文档截图，请同步更新相关文档和截图。

## 建议的改动范围

欢迎的方向：

- Bug 修复
- 文档完善
- 可观测性、部署和产品化改进
- 在当前产品边界内的体验优化
- 测试补充

需要先讨论的方向：

- 多用户或认证系统
- `s3` / `r2` 存储支持
- 桌面安装包
- 云托管 SaaS 化能力
- 会改变 API 或部署边界的大型重构

## Pull Request 约定

- PR 标题和描述要能直接说明改了什么、为什么改。
- 尽量保持 PR 范围单一，不要把文档、重构、功能和样式大杂烩放在一起。
- 如果存在已知限制或取舍，请在 PR 描述里写清楚。
- 如果改动了用户可见行为，请附截图或录屏。

## Issue 约定

- Bug 报告请尽量附上复现步骤、环境、日志片段。
- 功能请求请先说明使用场景，而不是直接下实现指令。
- 对 roadmap 中已经明确延期的能力，建议在原 issue 中补充场景，而不是重复开新 issue。

## 行为准则

默认按尊重、直接、可验证的方式协作。  
讨论重点放在：复现、约束、权衡、证据。
