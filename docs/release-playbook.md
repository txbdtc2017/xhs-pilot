# XHS Pilot GitHub Release Playbook

> 适用于 XHS Pilot 的首次正式发布和后续小版本发布。

## 发布形态

XHS Pilot 当前的正式发布形态是：

- GitHub 仓库源码
- Git tag
- GitHub Release
- Docker Compose 自托管使用方式

当前不发布：

- 桌面安装包
- App Store / dmg / exe
- GHCR / Docker Hub 官方镜像

## 发布前检查

在 `main` 分支确认以下项目：

1. `npm run check` 通过
2. `docker compose up -d --build` 能启动
3. `curl http://localhost:17789/api/health` 返回正常
4. `README.md`、`.env.example`、`LICENSE` 已同步
5. `docs/assets/screenshots/` 中的截图可用
6. 如需演示数据，`npm run seed` 可成功执行

## 版本建议

建议采用语义化版本：

- `v0.1.0`：第一版公开可用发布
- `v0.1.1`：文档、修复、小改动
- `v0.2.0`：有新的公开能力或部署方式变化

## 本地打 Tag

```bash
git checkout main
git pull --ff-only
npm run check
git tag v0.1.0
```

## 推送代码与 Tag

```bash
git push origin main
git push origin v0.1.0
```

## 在 GitHub 创建 Release

### Web UI

1. 打开仓库的 `Releases`
2. 点击 `Draft a new release`
3. 选择刚推送的 tag，例如 `v0.1.0`
4. 标题写成：`v0.1.0`
5. 粘贴下方模板并按本次版本实际内容调整
6. 发布 Release

### GitHub CLI

如果本机安装并登录了 `gh`：

```bash
gh release create v0.1.0 \
  --title "v0.1.0" \
  --notes-file docs/release-notes-template.md
```

## Release Notes 模板

```md
## Summary

- 首次公开发布 XHS Pilot
- 提供单用户、自托管的小红书内容资产与创作工作台
- 官方支持 Docker Compose + local storage

## Quick Start

1. `git clone https://github.com/txbdtc2017/xhs-pilot.git`
2. `cp .env.example .env`
3. 填写 LLM / Embedding 配置
4. `docker compose up -d --build`
5. 打开 `http://localhost:17789`

## Included

- 样本录入与异步分析
- 样本库与详情页
- 创作工作台
- 风格画像
- 历史链路查看
- PWA 外壳
- 备份与恢复脚本

## Known Limits

- 当前仅官方支持 `STORAGE_PROVIDER=local`
- 当前不支持应用内认证、多用户、离线生成
- 当前通过 Docker Compose 使用，不提供桌面安装包

## Breaking Changes

- None
```

## 发布后检查

1. Release 页面可见，标题与 tag 一致
2. README 截图正常加载
3. `.env.example` 可直接复制使用
4. Actions 中 CI 通过
5. 新用户按 README 能完整跑起来
