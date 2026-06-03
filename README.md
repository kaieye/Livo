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
    <img src="https://img.shields.io/badge/License-MIT-0f766e" alt="MIT" />
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

- Node.js >= 20
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

MIT
