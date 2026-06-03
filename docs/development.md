# 开发说明

本文记录 Livo 当前仓库的开发入口、平台差异和常用验证命令。Livo 的主目标仍是本地优先的 Electron 桌面应用，Web 入口用于复用渲染层并验证浏览器兼容路径。

## 前置条件

- Node.js >= 20
- pnpm >= 10

中国大陆网络环境下安装 Electron 可能超时，可在项目根目录 `.npmrc` 配置 Electron 镜像：

```ini
electron_mirror=https://npmmirror.com/mirrors/electron/
```

## 开发入口

### 桌面端

```bash
pnpm dev
```

该命令通过 `electron-vite dev` 启动 Electron 主进程、preload 和 renderer，并打开桌面窗口。桌面端是完整能力入口，包含 SQLite 数据库、主进程服务、系统集成、账号登录窗口、webview、下载和日志能力。

### Web 入口

```bash
pnpm dev:web
```

该命令通过 Vite 启动 `src/web`。Web 入口复用 renderer 的 React 应用，并在启动时由 `src/web/main.tsx` 初始化 `window.api`。浏览器环境没有 Electron 主进程，因此 `src/web/web-api.ts` 使用 IndexedDB、本地存储和浏览器 API 适配 preload 的接口形状。

Web 入口适合验证：

- 通用阅读界面和列表交互
- Web adapter 与 preload API 形状是否保持一致
- 浏览器环境下的基础订阅、导入和 AI 配置流程

Web 入口不等同于完整桌面端。以下能力只能在桌面端完整使用：

| 能力                                 | 桌面端                                    | Web 入口                     |
| ------------------------------------ | ----------------------------------------- | ---------------------------- |
| 核心数据存储                         | SQLite，位于 Electron `userData` 数据目录 | IndexedDB                    |
| 主进程 IPC                           | preload 调用 `ipcRenderer.invoke`         | Web adapter 本地实现同形 API |
| 本机数据/缓存/日志目录               | 支持                                      | 不支持                       |
| 系统文件对话框和原生下载             | 支持                                      | 仅浏览器能力或返回不可用     |
| 账号登录窗口                         | 支持 Electron BrowserWindow               | 不支持                       |
| 内嵌 webview 与桌面媒体策略          | 支持                                      | 不支持或降级                 |
| Electron session、代理和 header 策略 | 支持                                      | 不支持                       |

## 构建和预览

```bash
pnpm build
pnpm preview
pnpm build:web
pnpm preview:web
```

`pnpm build` 构建桌面端产物，`pnpm build:web` 构建 Web 入口到 `dist-web`。预览 Web 产物时使用 `pnpm preview:web`。

## 常用验证

```bash
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test
```

修改跨平台 API 时，优先运行 `pnpm typecheck` 和 `pnpm test -- src/web/web-api-contract.test.ts`，确保 Web adapter 仍满足 preload 的运行时和类型契约。
