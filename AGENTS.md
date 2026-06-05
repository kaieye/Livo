# Livo 开发指南

## 项目定位

Livo 是一个开源 RSS 阅读器项目，当前仓库只维护桌面端主应用与其 Web 入口，目标是提供本地优先、可扩展、支持 AI 能力的阅读体验。

当前仓库的实现重心：

- `src/main`：Electron 主进程
- `src/preload`：安全桥接层
- `src/renderer`：React 渲染层
- `src/web`：Web 端入口与适配
- `src/shared`：桌面端内部共享类型、规则、设置与纯工具逻辑

## 仓库结构

```text
Livo/
├── config/                # 构建与工具配置（electron-vite / vite-web / electron-builder / eslint / tailwind / vitest / tsconfig.base）
├── src/
│   ├── main/              # Electron 主进程
│   ├── preload/           # 安全桥接层
│   ├── renderer/          # React 渲染层
│   ├── shared/            # 本地共享模型、规则、设置、工具逻辑
│   └── web/               # Web 端入口与适配
├── scripts/               # 构建与调试脚本
├── docs/                  # 设计文档、计划与项目文档
├── package.json           # 单应用脚本与依赖
├── postcss.config.cjs     # PostCSS 配置（按约定置于根目录）
└── tsconfig.json          # TypeScript 主配置（继承 config/tsconfig.base.json）
```

## 技术栈

- Electron 33
- React 19
- TypeScript
- Vite
- Zustand
- TailwindCSS 3
- ESLint
- Prettier

## 目录说明

### `src/main`

Electron 主进程代码，包含窗口管理、数据访问、系统集成与主进程服务。

### `src/preload`

预加载脚本与受限桥接 API。

### `src/renderer`

桌面端 React UI，包括页面、组件、状态管理与渲染层工具。

### `src/shared`

应用内部共享模块，承载类型、视图模型、设置、发现数据、快捷键与平台无关工具逻辑。

### `src/web`

浏览器兼容入口与 Web 端适配层。

## 开发命令

```bash
pnpm install
pnpm dev
pnpm dev:web
pnpm typecheck
pnpm lint
pnpm format:check
pnpm build
pnpm build:web
```

## 测试与验证

- `pnpm typecheck`
- `pnpm lint`
- `pnpm format:check`
- `pnpm test`

## 开发约定

- 文件读写统一使用 UTF-8。
- 修改前先阅读真实代码与调用链，避免盲猜式改动。
- 优先复用现有模块边界与命名方式，不做无关重构。
- 新增或修改行为时，优先补充或更新对应测试。
- 生成物、缓存和本地 IDE 文件不应作为源码改动提交，除非任务明确要求。

## 文档入口

- 项目总览见 [`README.md`](README.md)
- 设计与实现文档见 `docs/superpowers/specs` 与 `docs/superpowers/plans`

## 许可证

MIT

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **Livo** (11061 symbols, 20702 relationships, 300 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

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

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/Livo/context` | Codebase overview, check index freshness |
| `gitnexus://repo/Livo/clusters` | All functional areas |
| `gitnexus://repo/Livo/processes` | All execution flows |
| `gitnexus://repo/Livo/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
