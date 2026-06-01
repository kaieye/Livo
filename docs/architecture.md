# Livo 架构说明

## 定位

Livo 是本地优先的 RSS 阅读器。当前仓库维护 Electron 桌面端、浏览器 Web 入口，以及两端共享的类型、规则和纯工具逻辑。

## 运行时分层

```text
src/main      Electron 主进程：窗口、持久化、网络抓取、系统能力、AI 调用
src/preload   安全桥接层：向渲染层暴露受限 API
src/renderer  桌面端 React UI：页面、组件、状态管理、交互编排
src/web       浏览器入口：复用渲染层能力并通过 Web 适配层替换桌面能力
src/shared    平台无关共享层：类型、设置、规则、视图模型映射、纯工具函数
```

主进程拥有 Node/Electron 能力和持久化能力。渲染层不直接访问文件系统、系统 API 或主进程服务，只通过 preload 暴露的 API 与 IPC 通道交互。`shared` 不依赖 Electron、DOM 或 Node 专有能力，保证桌面端和 Web 端都能安全复用。

## 核心数据流

订阅源刷新由主进程发起，抓取结果先经过解析、归一化、去重和规则评估，再写入本地数据层。渲染层通过 IPC 读取 feeds、entries、settings 等视图数据，并在用户操作后把变更请求发回主进程。

```text
feed source
  -> src/main/services/feed-refresh.ts
  -> parser / normalization / action rules
  -> src/main/database.ts
  -> IPC handlers
  -> preload API
  -> renderer stores and React views
```

AI 摘要、翻译、对话等能力由渲染层触发，主进程读取当前 AI 设置、构造请求并调用 provider-compatible client。流式结果通过带 `requestId` 的事件回传，渲染层负责丢弃过期请求的结果，避免文章切换或设置变更后的旧响应污染当前界面。

## 桌面端与 Web 端

桌面端使用 Electron 主进程承担本地持久化、系统集成、后台刷新和 AI 请求。Web 端只能使用浏览器可用能力，依赖 Web 适配层替代桌面专属 API。新增共享逻辑时优先放在 `src/shared`；一旦需要 Node、Electron 或浏览器专属 API，应留在对应运行时目录。

## 主要功能位置

- 订阅刷新：`src/main/services/feed-refresh.ts`
- 本地数据：`src/main/database.ts` 与 `src/main/database/**`
- IPC handlers：`src/main/handlers/**`
- Preload API：`src/preload/index.ts`
- 阅读界面：`src/renderer/src/pages/**`、`src/renderer/src/components/entry/**`
- 设置状态：`src/renderer/src/store/settings-store.ts`、`src/shared/settings.ts`
- AI 服务：`src/main/handlers/ai-handlers.ts`、`src/main/services/ai-client.ts`、`src/main/services/ai-prompts.ts`
- Agent：`src/main/agent/**` 与 `src/shared/agent-contracts.ts`
