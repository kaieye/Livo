# Livo Architecture

## 概述

Livo 是一个 Electron + Web 的 RSS/Feed 聚合阅读器，支持 AI 摘要、多视图（文章/社交媒体/视频/图片）、Fever API 同步。

### 进程模型

| 层       | 路径            | 职责                                 |
| -------- | --------------- | ------------------------------------ |
| Main     | `src/main/`     | 数据库、IPC 处理、后台服务、AI Agent |
| Preload  | `src/preload/`  | 类型安全的 IPC 桥接                  |
| Renderer | `src/renderer/` | React UI、Zustand 状态管理           |
| Shared   | `src/shared/`   | 类型定义、IPC 契约、共享工具函数     |
| Web      | `src/web/`      | 独立 Web 构建目标                    |

### 核心模块关系

```
Renderer (React + Zustand)
    │  IPC (类型安全契约: src/shared/ipc-contracts.ts)
    ▼
Main Process
    ├── handlers/      — IPC 通道注册，编排服务调用
    ├── agent/         — LLM Agent 循环，工具定义
    ├── operations/    — 共享业务操作（handlers 和 agent tools 共用）
    ├── services/      — 业务逻辑（feed 刷新、AI、发现、Fever 同步等）
    ├── database.ts    — getDb() 入口，返回结构化仓储接口
    └── database/      — SqliteAdapter、仓储、清理、索引
```

## 架构深化记录 (2025-07-17)

### 1. 仓储接口层

`database.ts` 从 40 个裸函数导出重构为 `getDb()` 模式，返回 5 个仓储接口：

- `IFeedRepository` — Feed CRUD
- `IEntryRepository` — Entry CRUD + 查询 + 去重
- `IDigestRepository` — AI 摘要窗口与运行记录
- `IFeverRepository` — Fever 账户/映射/同步状态
- `IMaintenanceRepository` — 清理与统计

### 2. 共享操作模块

`src/main/operations/` 提取了 handlers 和 agent tools 的共同编排逻辑：

- `feed-operations.ts` — `addFeed()`（含 warmup/enrichment/view inference）
- `entry-operations.ts` — `markAllRead()`（含 fever write-back）
- `data-operations.ts` — `exportOPML()`

### 3. SettingsProvider

`src/main/services/system/settings-provider.ts` 替换了 `settings-handlers.ts` 中的 `let cachedSettings` 可变单例。支持：

- `get()` — 懒加载规范快照
- `update(partial)` — 合并、持久化、proxy 重载、广播
- `onChange(fn)` — 响应式订阅（返回取消订阅函数）

### 4. Entry 处理器

`entry-handlers.ts` 中 fever write-back 逻辑集中到 `updateEntryWithWriteBack()` 辅助函数。
