# Livo

Livo 是一个基于 Electron + React 的开源 RSS 阅读器，支持本地订阅、全文阅读、搜索、收藏，以及 AI 摘要/翻译/对话能力。

## 当前实现状态（与代码一致）

- 桌面端：Electron 33 + React 19 + TypeScript + Vite
- 状态管理：Zustand
- 本地存储：JSON 文件数据库（`livo-data.json`），非 SQLite
- 订阅刷新：并发刷新 + 条件请求（ETag/Last-Modified）+ 新鲜度 TTL
- 数据维护：按策略清理旧条目，支持手动清理与统计
- AI：支持 OpenAI 兼容接口及多提供商配置

## 项目结构

- `src/main`：主进程（窗口、IPC、数据与服务）
- `src/preload`：安全桥接 API（`window.api`）
- `src/renderer`：React 渲染层 UI
- `src/shared`：共享类型与常量
- `src/web`：Web 版本入口与适配

## 开发命令

```bash
pnpm install
pnpm dev
pnpm dev:web
pnpm typecheck
pnpm build
pnpm build:web
```

## 说明

- 更详细的开发约定、模块说明和实践规范见 `AGENTS.md`。
- 文档最后同步时间：2026-03-07。
