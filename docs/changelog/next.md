# Next

## 新增

- 新增贡献指南、安全策略、Issue 模板和 PR 模板。
- 新增 `.env.example`，记录 Google OAuth 客户端 ID 配置项。

## 变更

- 桌面开发和预览脚本改为跨平台 Node 启动脚本，移除 Windows 专用 `chcp` / `set` 写法。
- `docs/folo-desktop-comparison.md` 删除已完成的工程治理、社区模板和外部导航防线条目，保留剩余差距。
- Electron webview 附着和跳转统一经过 URL policy，降低外部页面继承主窗口能力或绕过系统浏览器策略的风险。

## 修复

- 待记录。

## 迁移说明

- 当前无。
