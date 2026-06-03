# 架构说明

Livo 当前仓库维护一个本地优先的 Electron 桌面应用及其 Web 入口。架构边界围绕 Electron main/preload/renderer 与浏览器适配层划分，不把服务端 Web 应用的部署模型引入桌面端。

## 分层

```text
src/main      Electron 主进程：窗口、数据访问、系统集成、账号登录、任务运行器
src/preload   安全桥接层：暴露受限 window.api，封装 IPC 调用
src/renderer  React 渲染层：页面、组件、状态管理和 UI 工具
src/shared    跨 main/preload/renderer 的类型、IPC 契约、设置和纯工具逻辑
src/web       浏览器入口：初始化 Web adapter，复用 renderer 应用
```

## 桌面端数据流

桌面端由 renderer 调用 `window.api`，preload 通过 `ipcRenderer.invoke` 发起 IPC 请求。主进程 handler 使用 `registerChannel` 注册通道，先按 `src/shared/ipc-contracts` 校验入参，再执行主进程服务并返回统一 envelope。preload 解包 envelope 后把结果交回 renderer。

```text
renderer -> preload window.api -> IPC envelope -> main handler -> service/repository -> SQLite
```

这条路径的关键约束：

- IPC channel 和参数形状由 shared 契约集中定义。
- 主进程 handler 通过 `registerChannel` 做入参校验、错误包装和日志记录。
- renderer 不直接访问 Node/Electron API。
- 数据库写入最终落到 `SqliteAdapter` 和领域 repository。

## Web 入口数据流

Web 入口没有 Electron 主进程和 preload。`src/web/main.tsx` 初始化 `src/web/web-api.ts`，并把同形 API 挂到 `window.api`，让 renderer 继续使用相同调用方式。

```text
renderer -> web window.api -> web adapter -> IndexedDB / localStorage / browser API
```

Web adapter 的职责是保持接口形状兼容，而不是完整复制桌面能力。涉及系统目录、原生下载、Electron session、账号登录窗口、webview 和主进程日志的接口应返回明确的不可用结果或浏览器降级实现。

## 数据路径

桌面端核心数据保存在 Electron `userData` 下的 `data/livo.db`。首次启动时，如果 SQLite 为空且发现早期 JSON 数据文件，`src/main/database.ts` 会迁移旧数据并把 JSON 文件重命名为备份。

常见桌面路径：

- 数据库：`app.getPath('userData')/data/livo.db`
- 设置：`app.getPath('userData')/data/settings.json`
- 刷新日志：`app.getPath('userData')/data/refresh-logs.json`
- 图片缓存：`app.getPath('userData')/cache`
- 主进程日志：`app.getPath('userData')/logs`

Web 入口使用 IndexedDB 数据库 `livo-web`，不访问桌面端 SQLite 数据，也不共享 Electron `userData` 目录。

## 后台任务

刷新和 AI digest 等长时间操作通过本地 Task Runner 记录 run 状态。实时事件可以用于 UI 提示，但最终状态应以 run 记录为准。桌面端不引入服务端队列；只有在出现跨进程持久队列、崩溃恢复或长期重试需求时，才评估 SQLite-backed job queue。

## 维护边界

- 修改主进程能力时，同步检查 preload API、IPC 契约和 Web adapter 是否需要保持形状兼容。
- 修改 renderer 通用流程时，同时考虑桌面端和 Web 入口的可用能力差异。
- 修改数据模型时，优先补充 SQLite adapter 或 repository 级测试，并确认旧 JSON 迁移路径是否受影响。
- 修改长任务时，优先接入 Task Runner 的 run 状态，而不是只依赖一次性事件。
