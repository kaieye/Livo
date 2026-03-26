# Livo Monorepo Refactor Todo

目标：将当前单应用 Electron 工程演进为可承载 `desktop`、`harmony` 和未来 `mobile` 的 monorepo，同时尽量保持桌面端可运行，并只抽取真正适合跨端复用的逻辑。

## Phase 1: 建立 Monorepo 骨架

- [x] 新增 `apps/`、`packages/` 目录约定
- [x] 将根目录 `package.json` 改为 workspace 根配置
- [x] 新增 `pnpm-workspace.yaml`
- [x] 新增 `turbo.json`
- [x] 新增根级 `tsconfig.base.json`

## Phase 2: 迁移 Desktop App

- [x] 创建 `apps/desktop`
- [x] 迁移现有 Electron/Web 桌面工程到 `apps/desktop`
- [x] 修正 desktop 的 `package.json`、`tsconfig`、Vite/Electron 配置
- [x] 修正脚本和路径引用，确保 `apps/desktop` 可独立开发和构建

## Phase 3: 抽取首批共享包

- [x] 创建 `packages/models`
- [x] 创建 `packages/utils`
- [x] 创建 `packages/shared`
- [x] 从原 `src/shared` 中挑选纯逻辑、纯类型代码迁入 `packages`
- [x] 更新 desktop 端导入路径，改为引用 `packages/*`

## Phase 4: 为 Harmony 做准备

- [x] 预留 `apps/harmony` 目录
- [x] 补充面向多端的目录说明文档
- [x] 明确哪些模块可以跨端复用，哪些必须平台重写

## Phase 5: 验证与收尾

- [x] 执行类型检查
- [x] 执行关键测试
- [x] 更新 README 和开发指引
- [x] 标记完成项与遗留事项
