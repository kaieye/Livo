# Livo

<p align="center">
  <img src="https://img.shields.io/badge/Electron-33-47848f" alt="Electron" />
  <img src="https://img.shields.io/badge/React-19-149eca" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-5.9-3178c6" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-3.4-06b6d4" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/SQLite-3-0f7a8c" alt="SQLite" />
  <img src="https://img.shields.io/badge/OpenAI_SDK-4.x-412991" alt="OpenAI" />
  <img src="https://img.shields.io/badge/Vite-5-646cff" alt="Vite" />
  <a href="./LICENSE">
    <img src="https://img.shields.io/badge/License-AGPL--3.0-0f766e" alt="AGPL-3.0" />
  </a>
</p>

Livo 是一个开源 RSS 阅读器，面向希望将订阅、阅读、搜索、收藏与 AI 能力整合到同一套本地工作流中的用户。当前仓库仅维护桌面端主应用及其 Web 入口，目标是提供本地优先、可扩展、支持 AI 能力的阅读体验。

## 核心特性

- 支持 RSS / Atom 订阅与订阅源自动发现
- 本地优先的数据存储，核心数据保存在本机
- 全文阅读、历史检索、收藏与订阅管理
- 支持 AI 摘要、翻译与内容对话能力
- 支持多提供商配置，包括 OpenAI 兼容接口
- 提供 Electron 桌面端主应用与 Web 入口

## ⚠️ 重要架构原则

**Livo 是一个 RSS 阅读器客户端应用，不是管理后台。**

### 严格禁止的行为

❌ **禁止在 Livo Desktop 中实现后台管理功能**

- 用户管理、角色管理、权限管理
- 审计日志、系统设置、功能开关
- 统计分析、运营数据看板
- 任何需要管理员权限的功能

❌ **禁止在主应用中添加 admin 相关代码**

- 不要创建 `*ManagementPanel.tsx` 组件
- 不要创建 `admin-*.ts` handlers
- 不要在 IPC contracts 中添加 `ADMIN_*` 定义
- 不要在 preload API 中暴露 `admin.*` 对象

### 正确的架构分层

```
┌─────────────────────────────────────────┐
│ Livo Desktop (本仓库)                    │
│ - RSS 订阅管理                           │
│ - 文章阅读与收藏                         │
│ - AI 能力（摘要/翻译/对话）              │
│ - 用户个人设置                           │
│ ✅ 面向普通用户的客户端功能              │
└─────────────────────────────────────────┘
              ↓ REST API
┌─────────────────────────────────────────┐
│ Livo-Server (独立仓库)                   │
│ - NestJS 后端服务                        │
│ - 提供 RSS 聚合、认证、数据同步 API      │
│ ✅ 纯后端逻辑，不包含前端界面            │
└─────────────────────────────────────────┘
              ↑ REST API
┌─────────────────────────────────────────┐
│ Livo-Web (独立仓库)                      │
│ - Next.js Web 应用                       │
│ - 管理员后台界面                         │
│ - 用户管理、角色权限、审计日志           │
│ - 功能开关、系统设置、统计分析           │
│ ✅ 面向管理员的 Web 管理后台             │
└─────────────────────────────────────────┘
```

### 开发时的自检清单

在添加新功能前，问自己：

1. ✅ 这个功能是普通用户使用的吗？
   - 是 → 可以加在 Livo Desktop
   - 否 → 应该加在 Livo-Web

2. ✅ 这个功能需要管理员权限吗？
   - 是 → 必须加在 Livo-Web
   - 否 → 可以考虑 Livo Desktop

3. ✅ 这个功能是操作其他用户数据吗？
   - 是 → 必须加在 Livo-Web
   - 否 → 可以考虑 Livo Desktop

4. ✅ 这个 API 路径包含 `/admin/` 吗？
   - 是 → 禁止在 Livo Desktop 中调用
   - 否 → 可以使用

### 历史教训

**2025-06-08 重大架构错误：**

- 错误地在 Livo Desktop 中添加了用户管理、角色管理、审计日志、功能开关、系统设置等后台管理功能
- 创建了 5 个管理面板组件、4 个管理 stores、32 个 admin IPC handlers
- 混淆了客户端应用和管理后台的职责边界
- 花费大量时间迁移和清理（~1500+ 行代码）

**根本原因：**

- 没有理解项目的架构分层
- 看到后端有 `/admin/*` API 就认为前端也应该有对应界面
- 忽略了 Livo Desktop 是面向普通用户的客户端应用

**预防措施：**

- 本文档添加架构原则说明
- Code Review 时严格检查是否违反分层原则
- 新功能开发前明确功能归属

## 当前状态

当前仓库聚焦单一桌面应用：

- `src/main` — Electron 主进程
- `src/preload` — 安全桥接层
- `src/renderer` — React 渲染层
- `src/web` — Web 端入口与适配
- `src/shared` — 桌面端内部共享类型、设置、发现数据与工具逻辑

## 技术栈

- Electron 33 + React 19 + TypeScript 5.9
- Vite 5 + electron-vite
- Zustand + TanStack Query + React Router
- Tailwind CSS 3.4
- SQLite (better-sqlite3)
- OpenAI SDK（多提供商：OpenAI / Anthropic / DeepSeek / 智谱 / Ollama / 自定义）
- Vitest + ESLint + Prettier

## 仓库结构

```text
Livo/
├── config/                # 构建与工具配置（electron-vite / vite-web / electron-builder / eslint / tailwind / vitest / tsconfig.base）
├── src/
│   ├── main/              # Electron 主进程
│   ├── preload/           # 安全桥接层
│   ├── renderer/          # React 渲染层
│   ├── shared/            # 本地共享类型、规则、设置、工具逻辑
│   └── web/               # Web 端入口与适配
├── scripts/               # 构建与调试脚本
├── docs/                  # 设计文档、计划与补充说明
├── package.json           # 单应用脚本与依赖
└── tsconfig.json          # TypeScript 主配置（继承 config/tsconfig.base.json）
```

## 快速开始

### 前置条件

- Node.js >= 22
- pnpm >= 10

> **中国大陆用户**：安装 Electron 时需设置国内镜像，否则二进制文件下载会超时。
> 在项目根目录 `.npmrc` 中添加：
>
> ```
> electron_mirror=https://npmmirror.com/mirrors/electron/
> ```

### 1. 安装依赖

```bash
pnpm install
```

### 2. 启动桌面端开发

```bash
pnpm dev
```

这会通过 `electron-vite dev` 启动 Electron 窗口并开启 HMR。

如需使用标准 Google OAuth / Sign in with Google，请先创建 Google OAuth
Desktop Client，并在启动前设置 Client ID：

```bash
$env:LIVO_GOOGLE_OAUTH_CLIENT_ID="your-desktop-client-id.apps.googleusercontent.com"
pnpm dev
```

### 3. 启动 Web 开发模式

```bash
pnpm dev:web
```

Web 入口复用渲染层界面，但运行在浏览器环境中，使用 IndexedDB 保存数据，并通过 `src/web/web-api.ts` 提供与 preload 相同形状的 API。它适合验证通用阅读界面和浏览器兼容路径；依赖 Electron 主进程的能力只在桌面端完整可用。

桌面端专有能力包括本机 SQLite 数据目录、系统文件对话框、原生下载、主进程日志目录、Electron 缓存清理、账号登录窗口和内嵌 webview 等。

## 常用命令

```bash
pnpm dev                  # 开发模式启动桌面端
pnpm dev:web              # 开发模式启动 Web 端
pnpm preview              # 预览已构建的桌面端
pnpm build                # 构建桌面端
pnpm build:web            # 构建 Web 端
pnpm typecheck            # 类型检查
pnpm lint                 # 代码检查
pnpm format:check         # 格式检查
pnpm test                 # 运行测试
```

## 数据与存储

Livo 采用本地优先的数据方案。桌面端核心数据保存在 SQLite 数据库中，支持从早期 JSON 格式自动迁移。项目不依赖中心化在线账户来完成基础订阅与阅读能力。

## AI 能力

项目支持将 AI 能力接入阅读流程，典型用途包括：

- 文章摘要
- 内容翻译
- 基于文章内容的问答

AI 提供商采用可配置方式接入，支持 OpenAI 兼容接口以及多种第三方或本地模型方案。

## 测试与验证

```bash
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test
```

## 开发文档

- 仓库开发约定与协作说明见 [`AGENTS.md`](AGENTS.md)
- 开发入口、Web 限制和常用验证见 [`docs/development.md`](docs/development.md)
- 架构分层、IPC 契约和数据路径见 [`docs/architecture.md`](docs/architecture.md)
- 设计与实现文档见 `docs/superpowers/specs` 与 `docs/superpowers/plans`

## 许可证

AGPL-3.0
