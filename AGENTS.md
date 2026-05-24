# Livo 开发指南

## 项目定位

Livo 是一个开源 RSS 阅读器项目，当前以 monorepo 形式维护，目标是提供本地优先、可扩展、支持 AI 能力的多端阅读体验。

当前仓库的主要实现重心：

- `apps/desktop`：Electron 桌面端与 Web 入口
- `apps/harmony`：HarmonyOS 版本与相关实验实现
- `packages/*`：跨端共享类型、规则与纯工具逻辑

## 仓库结构

```text
Livo/
├── apps/
│   ├── desktop/          # 当前桌面端主实现，含 Electron 与 Web 入口
│   └── harmony/          # HarmonyOS 端代码、构建脚本与测试
├── packages/
│   ├── models/           # 跨端共享模型与类型
│   ├── shared/           # 跨端共享配置、规则、发现数据、快捷键等
│   └── utils/            # 跨端纯工具逻辑
├── docs/                 # 设计文档、计划与项目文档
├── .agents/              # 本地 agent / workflow 相关资源
├── .claude/              # 本地 Claude / skill 相关资源
├── package.json          # 根工作区脚本与依赖
├── pnpm-workspace.yaml   # pnpm workspace 配置
└── turbo.json            # Turbo 任务编排配置
```

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
- hvigor / DevEco Studio 工具链

### Workspace

- pnpm workspace
- Turbo
- ESLint
- Prettier

## 目录说明

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

### `packages/models`

跨端共享的数据模型与类型出口。

### `packages/shared`

跨端共享的规则、设置、发现数据、快捷键定义等稳定模块。

### `packages/utils`

尽量不依赖运行时平台的纯工具逻辑，便于复用与测试。

## 开发命令

### 根目录常用命令

```bash
pnpm install
pnpm dev:desktop
pnpm dev:web
pnpm dev:harmony
pnpm typecheck
pnpm lint
pnpm format:check
pnpm build:desktop
pnpm build:web
pnpm build:harmony:debug
```

### Harmony 常用命令

```bash
pnpm prepare:harmony
pnpm build:harmony:debug
pnpm build:harmony:release
pnpm install:harmony:debug
pnpm run:harmony:debug
```

## 测试与验证

### 通用验证

- `pnpm typecheck`
- `pnpm lint`
- `pnpm format:check`

### Harmony 验证

Harmony 目录下有一组 `apps/harmony/tests/*.test.ts` 回归测试，通常通过 Node 直接执行，例如：

```bash
node --test apps/harmony/tests/home-video-grid.test.ts
node --test apps/harmony/tests/source-regressions.test.ts
node --test apps/harmony/tests/video-playable-selection.test.ts
```

需要确认 Harmony 代码可编译时，额外运行：

```bash
pnpm build:harmony:debug
```

## 开发约定

- 文件读写统一使用 UTF-8。
- 修改前先阅读真实代码与调用链，避免盲猜式改动。
- 优先复用现有模块边界与命名方式，不做无关重构。
- 新增或修改行为时，优先补充或更新对应测试。
- 生成物、缓存和本地 IDE 文件不应作为源码改动提交，除非任务明确要求。

## 文档入口

- 项目总览见 [`README.md`](README.md)
- 桌面端说明见 `apps/desktop/README.md`
- 设计与实现文档见 `docs/superpowers/specs` 与 `docs/superpowers/plans`

## 许可证

MIT

<!-- gitnexus:start -->

# GitNexus — Code Intelligence

This project is indexed by GitNexus as **Livo** (8912 symbols, 15022 relationships, 300 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

## Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

## Resources

| Resource                              | Use for                                  |
| ------------------------------------- | ---------------------------------------- |
| `gitnexus://repo/Livo/context`        | Codebase overview, check index freshness |
| `gitnexus://repo/Livo/clusters`       | All functional areas                     |
| `gitnexus://repo/Livo/processes`      | All execution flows                      |
| `gitnexus://repo/Livo/process/{name}` | Step-by-step execution trace             |

## CLI

| Task                                         | Read this skill file                                        |
| -------------------------------------------- | ----------------------------------------------------------- |
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md`       |
| Blast radius / "What breaks if I change X?"  | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?"             | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md`       |
| Rename / extract / split / refactor          | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md`     |
| Tools, resources, schema reference           | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md`           |
| Index, status, clean, wiki CLI commands      | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md`             |

<!-- gitnexus:end -->
