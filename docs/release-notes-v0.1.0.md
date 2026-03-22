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
- GitHub 首次发布所需的 README、LICENSE、CI 与发布文档

## Known Limits

- 当前仅官方支持 `STORAGE_PROVIDER=local`
- 当前不支持应用内认证、多用户、离线生成
- 当前通过 Docker Compose 使用，不提供桌面安装包
- 当前不提供 GHCR / Docker Hub 官方镜像

## Breaking Changes

- None
