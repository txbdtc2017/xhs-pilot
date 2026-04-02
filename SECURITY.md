# Security Policy

XHS Pilot 当前定位为单用户、自托管、same-origin 的 Web 应用。仓库已开源，但安全问题不应通过公开 issue 直接披露。

## Supported Versions

| Version | Status |
| --- | --- |
| 最新发布版本 | Supported |
| `main` 分支当前代码 | Best effort |
| 旧版本、长期未同步的 fork | Not supported |

## Reporting a Vulnerability

如果你发现了安全问题，请不要公开提交包含利用细节的 issue 或讨论帖。建议按以下顺序处理：

1. 优先使用 GitHub 的私密漏洞报告能力（Private Vulnerability Reporting）。
2. 如果仓库尚未开启该能力，请通过维护者 GitHub 资料页上的非公开联系方式联系维护者。
3. 在维护者确认前，不要公开披露可复现的利用细节、payload、密钥样例或攻击路径。

建议在报告中尽量包含：

- 影响范围和潜在风险
- 受影响的版本、tag 或提交
- 最小复现步骤
- 触发条件、配置前提或部署前提
- 如有可能，提供临时缓解方案

## Response Expectations

- 维护者会尽量在 5 个工作日内确认收到报告
- 完成初步分级后，会继续同步修复或缓解进展
- 在修复发布前，请尽量配合协调披露，不要提前公开技术细节

## Scope Notes

当前安全边界以官方支持范围为准：

- 单用户
- 自托管
- Docker Compose
- `STORAGE_PROVIDER=local`

对于超出当前官方支持边界的自定义部署、修改版镜像、长期偏离 `main` 的 fork 或外围基础设施配置问题，维护者只提供 best-effort 响应。
