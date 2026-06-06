# 贡献指南

感谢参与 Livo 开发。提交改动前请先确认改动范围和现有架构边界，避免把无关重构混入功能修复。

## 本地开发

```bash
pnpm install
pnpm dev
```

Web 入口可使用：

```bash
pnpm dev:web
```

## 提交前检查

```bash
pnpm format:check
pnpm typecheck
pnpm lint
pnpm test
```

涉及桌面或 Web 构建时，再执行：

```bash
pnpm build
pnpm build:web
```

## 变更记录

用户可见变更请写入 `docs/changelog/next.md`。发布前检查流程见 `docs/release/release-plan.md`。

## 代码约定

- 优先复用现有模块、类型和 IPC 合同。
- Electron 主窗口保持 `contextIsolation: true`、`nodeIntegration: false`。
- 可恢复错误就近处理并记录；不可恢复错误向上抛出。
- 新增核心业务逻辑或易回归边界时补测试。
