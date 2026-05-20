# Livo

Livo 是一个开源 RSS 阅读器，面向希望将订阅、阅读、搜索、收藏与 AI 能力整合到同一套本地工作流中的用户。项目采用 monorepo 结构维护，目标是提供本地优先、可扩展、支持 AI 能力的多端阅读体验。

## 核心特性

- 支持 RSS / Atom 订阅与订阅源自动发现
- 本地优先的数据存储，核心数据保存在本机
- 全文阅读、历史检索、收藏与订阅管理
- 支持 AI 摘要、翻译与内容对话能力
- 支持多提供商配置，包括 OpenAI 兼容接口
- 提供 Electron 桌面端主应用，并保留 Web 与 HarmonyOS 方向的扩展能力

## 当前状态

当前实现重心：

- `apps/desktop` — Electron 桌面端主实现与 Web 入口
- `apps/harmony` — HarmonyOS 代码、构建脚本与回归测试
- `packages/*` — 跨端共享模型、规则与纯工具逻辑

## 技术栈

### Desktop / Web

- Electron 33
- React 19 + TypeScript
- Vite
- Zustand + TailwindCSS 3

### Harmony

- ArkTS + ArkUI / HarmonyOS NEXT
- hvigor / DevEco Studio 工具链

### Workspace

- pnpm workspace
- Turbo 任务编排
- ESLint + Prettier

## Monorepo 结构

```text
Livo/
├── apps/
│   ├── desktop/          # Electron 桌面端主实现与 Web 入口
│   └── harmony/          # HarmonyOS 代码、构建脚本与测试
├── packages/
│   ├── models/           # 跨端共享模型与类型
│   ├── shared/           # 跨端共享配置、规则、发现数据、快捷键等
│   └── utils/            # 跨端纯工具逻辑
├── docs/                 # 设计文档、计划与补充说明
├── .agents/              # 本地 agent / workflow 相关资源
├── .claude/              # 本地 Claude / skill 相关资源
├── package.json          # 根工作区脚本
├── pnpm-workspace.yaml   # pnpm workspace 配置
└── turbo.json            # Turbo 任务编排配置
```

## 主要目录说明

### `apps/desktop`

桌面端主应用，包含：

- `src/main`：Electron 主进程
- `src/preload`：安全桥接层
- `src/renderer`：React 渲染层
- `src/web`：Web 端入口与适配

### `apps/harmony`

HarmonyOS 代码目录，包含：

- `entry/src/main/ets`：ArkTS 页面、组件、服务与工具
- `tests`：Node 可执行的 Harmony 回归测试
- `scripts`：Harmony 开发、构建、安装辅助脚本

### `packages/*`

跨端复用模块：

- `packages/models`：数据模型与类型出口
- `packages/shared`：共享配置、常量与快捷键
- `packages/utils`：纯工具逻辑，不依赖运行时平台

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
pnpm dev:desktop
```

这会自动构建共享包（`models`、`shared`、`utils`），然后通过 `electron-vite dev` 启动 Electron 窗口（带 HMR 热更新）。

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
pnpm dev:desktop          # 开发模式启动桌面端
pnpm dev:web              # 开发模式启动 Web 端
pnpm preview:desktop      # 预览已构建的桌面端
pnpm build:desktop        # 构建桌面端
pnpm build:web            # 构建 Web 端
pnpm build:harmony:debug  # 构建 Harmony 调试包
pnpm build:harmony:release # 构建 Harmony 正式包
pnpm typecheck            # 类型检查
pnpm lint                 # 代码检查
pnpm format:check         # 格式检查
pnpm test                 # 运行测试
```

## 数据与存储

Livo 目前采用本地优先的数据方案。桌面端核心数据以 JSON 文件形式保存在本机，便于调试、迁移与用户自主控制。项目不依赖中心化在线账户来完成基础订阅与阅读能力。

## AI 能力

项目支持将 AI 能力接入阅读流程，典型用途包括：

- 文章摘要
- 内容翻译
- 基于文章内容的问答

AI 提供商采用可配置方式接入，支持 OpenAI 兼容接口以及多种第三方或本地模型方案。

## 测试与验证

### 通用验证

```bash
pnpm typecheck
pnpm lint
pnpm format:check
```

### Harmony 回归测试

Harmony 目录下维护了一组可由 Node 直接执行的回归测试：

```bash
node --test apps/harmony/tests/home-video-grid.test.ts
node --test apps/harmony/tests/source-regressions.test.ts
node --test apps/harmony/tests/video-playable-selection.test.ts
```

确认 Harmony 代码可编译时，额外运行：

```bash
pnpm build:harmony:debug
```

## 开发文档

- 仓库开发约定与协作说明见 [`AGENTS.md`](AGENTS.md)
- 桌面端补充说明见 `apps/desktop/README.md`
- 设计与实现文档见 `docs/superpowers/specs` 与 `docs/superpowers/plans`

## 许可证

MIT
