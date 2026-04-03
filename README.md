# Livo

Livo 是一个开源 RSS 阅读器，面向希望将订阅、阅读、搜索、收藏与 AI 能力整合到同一套本地工作流中的用户。项目采用 monorepo 结构维护，当前重点覆盖 Electron 桌面端，并保留 HarmonyOS 端实现与验证代码。

## 核心特性

- 支持 RSS / Atom 订阅与订阅源自动发现
- 本地优先的数据存储，核心数据保存在本机
- 全文阅读、历史检索、收藏与订阅管理
- 支持 AI 摘要、翻译与内容对话能力
- 支持多提供商配置，包括 OpenAI 兼容接口
- 提供桌面端主应用，并保留 Web 与 Harmony 方向的扩展能力

## 当前状态

当前仓库与代码结构一致的实现状态：

- `apps/desktop` 是当前桌面端主实现
- `apps/desktop/src/web` 提供 Web 入口与适配
- `apps/harmony` 维护 HarmonyOS 代码、构建脚本与回归测试
- `packages/models`、`packages/shared`、`packages/utils` 承担跨端复用职责

## 技术栈

### Desktop / Web

- Electron 33
- React 19
- TypeScript
- Vite
- Zustand
- TailwindCSS 3

### Harmony

- ArkTS
- ArkUI / HarmonyOS NEXT
- hvigor / DevEco Studio

### Workspace

- pnpm workspace
- Turbo
- ESLint
- Prettier

## Monorepo 结构

```text
Livo/
├── apps/
│   ├── desktop/          # Electron 桌面端主实现与 Web 入口
│   └── harmony/          # HarmonyOS 代码、构建脚本与测试
├── packages/
│   ├── models/           # 共享模型与类型
│   ├── shared/           # 共享规则、设置、发现数据、快捷键等
│   └── utils/            # 共享纯工具逻辑
├── docs/                 # 设计文档、计划与补充说明
├── package.json          # 根工作区脚本
├── pnpm-workspace.yaml   # workspace 配置
└── turbo.json            # 任务编排配置
```

## 主要目录说明

### `apps/desktop`

当前桌面端主应用代码，主要包含：

- `src/main`：Electron 主进程
- `src/preload`：安全桥接 API
- `src/renderer`：React 渲染层
- `src/web`：Web 版本入口

### `apps/harmony`

HarmonyOS 代码目录，主要包含：

- `entry/src/main/ets`：页面、组件、服务、模型与工具
- `tests`：Node 可执行的回归测试
- `scripts`：Harmony 开发、构建、安装辅助脚本

### `packages/*`

用于沉淀跨端复用能力：

- `packages/models`：模型与类型
- `packages/shared`：共享配置、常量与规则
- `packages/utils`：纯工具逻辑

## 快速开始

### 1. 安装依赖

```bash
pnpm install
```

### 2. 启动桌面端开发

```bash
pnpm dev:desktop
```

### 3. 启动 Web 开发模式

```bash
pnpm dev:web
```

### 4. 启动 Harmony 开发环境

```bash
pnpm prepare:harmony
pnpm dev:harmony
```

## 常用命令

```bash
pnpm typecheck
pnpm lint
pnpm format:check
pnpm build:desktop
pnpm build:web
pnpm build:harmony:debug
```

## 数据与存储

Livo 目前采用本地优先的数据方案。桌面端核心数据以 JSON 文件形式保存在本机，便于调试、迁移与用户自主控制。项目当前并不依赖中心化在线账户来完成基础订阅与阅读能力。

## AI 能力

项目支持将 AI 能力接入阅读流程，典型用途包括：

- 文章摘要
- 内容翻译
- 基于文章内容的问答

AI 提供商采用可配置方式接入，支持 OpenAI 兼容接口以及多种第三方或本地模型方案。

## 测试与验证

根工作区常用验证命令：

```bash
pnpm typecheck
pnpm lint
pnpm format:check
```

Harmony 目录下还维护了一组可由 Node 直接执行的回归测试，例如：

```bash
node --test apps/harmony/tests/home-video-grid.test.ts
node --test apps/harmony/tests/source-regressions.test.ts
node --test apps/harmony/tests/video-playable-selection.test.ts
```

当需要确认 Harmony 代码可编译时，运行：

```bash
pnpm build:harmony:debug
```

## 开发文档

- 仓库开发约定与协作说明见 [`AGENTS.md`](AGENTS.md)
- 桌面端补充说明见 `apps/desktop/README.md`
- 设计与实现文档见 `docs/superpowers/specs` 与 `docs/superpowers/plans`

## 许可证

MIT
