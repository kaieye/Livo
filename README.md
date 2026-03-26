# Livo

Livo 是一个基于 Electron + React 的开源 RSS 阅读器，支持本地订阅、全文阅读、搜索、收藏，以及 AI 摘要/翻译/对话能力。

## 当前实现状态（与代码一致）

- 桌面端：Electron 33 + React 19 + TypeScript + Vite
- 状态管理：Zustand
- 本地存储：JSON 文件数据库（`livo-data.json`），非 SQLite
- 订阅刷新：并发刷新 + 条件请求（ETag/Last-Modified）+ 新鲜度 TTL
- 数据维护：按策略清理旧条目，支持手动清理与统计
- AI：支持 OpenAI 兼容接口及多提供商配置

## Monorepo 结构

- `apps/desktop`：当前 Electron 桌面端和 Web 入口
- `apps/harmony`：HarmonyOS 预留目录
- `packages/models`：跨端共享类型与模型
- `packages/shared`：跨端共享的规则、设置、发现数据、快捷键等
- `packages/utils`：跨端纯工具逻辑
- `docs/monorepo-refactor-todo.md`：本轮重构清单与阶段记录

当前桌面端主要源码位于：

- `apps/desktop/src/main`：主进程（窗口、IPC、数据与服务）
- `apps/desktop/src/preload`：安全桥接 API（`window.api`）
- `apps/desktop/src/renderer`：React 渲染层 UI
- `apps/desktop/src/shared`：desktop 兼容出口，逐步转向 `packages/*`
- `apps/desktop/src/web`：Web 版本入口与适配

## 开发命令

```bash
pnpm install
pnpm dev:desktop
pnpm dev:web
pnpm typecheck
pnpm build:desktop
pnpm build:web
```

## 说明

- 根工作区约定与项目说明见 `AGENTS.md`。
- 桌面端包说明见 `apps/desktop/README.md`。
- 当前 monorepo 重构已完成骨架迁移、共享包拆分、类型检查与测试验证。
