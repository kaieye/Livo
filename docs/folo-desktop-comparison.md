# Folo Desktop 与 Livo 全面对比审查

审查对象：

- Folo：`D:\project\Folo-dev\apps\desktop`，必要时补看其直接依赖的 monorepo 根目录、`packages/internal`、`locales`、`.github`。
- Livo：`D:\project\Livo-project\Livo`。

审查目标不是判断谁的定位更正确，而是找出 Folo 在 RSS 阅读器工程、产品和运行时能力上比 Livo 做得更好的地方，并把这些差距转成 Livo 可落地的改进项。

## 核心判断

Folo 的优势来自三个事实：它是已上线的多端云同步产品；它有完整 monorepo、CI/CD、E2E、发布和商店分发链路；它把 RSS 阅读器从“订阅源 + 条目”的本地应用扩展成了订阅关系、列表、收件箱、AI、集成、自动化、MCP、社区分发的产品平台。

Livo 的优势也很明确：本地优先、SQLite、RSS 抓取、条目去重、刷新日志、Fever 同步、IPC 安全契约、单仓可理解性都更贴近当前定位。不能把 Folo 的云端账号体系和较宽的 Electron 安全配置直接照搬到 Livo。

真正值得 Livo 学的是 Folo 的深模块和接缝：工程自动化、路由级布局、订阅关系模型、同步事务、搜索索引、E2E、AI/MCP/集成入口、桌面原生细节和发布治理。这些能提高杠杆和局部性，不会破坏 Livo 的本地优先路线。

## 总体规模与定位差异

| 维度           | Folo Desktop                                                                                  | Livo                                                                           |
| -------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| 仓库形态       | monorepo 中的 desktop app，依赖 `packages/internal/*`、`api`、`locales`、`plugins`、`.github` | 单应用仓库，`src/main`、`src/preload`、`src/renderer`、`src/web`、`src/shared` |
| 产品定位       | 云端账号、多端同步、Web/desktop/mobile/SSR/CLI/OTA/商店分发                                   | 本地优先桌面 RSS 阅读器，带 Web 入口                                           |
| desktop 文件量 | `apps/desktop` 约 1100+ 文件，且还有 workspace 包                                             | 仓库约 500+ 源文件                                                             |
| 数据中心       | 远端 Follow API + 本地缓存/离线启动                                                           | 本机 SQLite 为核心数据源                                                       |
| 更成熟处       | 发布、CI、E2E、多端复用、集成生态、AI 产品化、同步事务                                        | 本地 RSS 抓取、SQLite、IPC 契约、安全 preload、单元测试数量                    |

## 1. 工程结构、构建与发布

### Folo 做得更好的地方

Folo 的工程接缝更清楚。根目录用 `pnpm-workspace.yaml` 管理 `apps/*`、`packages/**/*`、`apps/desktop/layer/*`，desktop 内再拆 `layer/main`、`layer/renderer`，两层各自有 `package.json`、`tsconfig.json`、`vitest.config.ts`。这让主进程、渲染层、共享 store/database/component 不是同一个大接口，后续多端复用和构建缓存更自然。

Folo 有任务编排和缓存。`turbo.json` 定义 `build`、`typecheck`、`dev`、`test` 的产物和依赖，`typecheck` 显式依赖 `@follow/electron-main#build`。Livo 当前所有构建动作集中在根 `package.json`，没有跨模块任务图。

Folo 的依赖治理更可控。`pnpm-workspace.yaml` 使用 `catalog` 固定共享版本，用 `overrides`、`patchedDependencies` 管理依赖风险。Livo 已补 `.npmrc`、`.nvmrc`、`engines` 和 Dependabot，但还没有 workspace 级 catalog、overrides 和 patched dependency 治理策略。

Folo 的打包链路明显更成熟。`forge.config.cts` 覆盖 DMG/ZIP、MAS PKG、Windows Squirrel、Microsoft Store AppX、Linux AppImage，包含签名、公证、entitlements、artifact 重命名、sha512、update yml、GitHub publisher 和 Electron fuses。Livo 的 `electron-builder` 配置能覆盖基础平台，但还没有商店、签名、公证、CI artifact 聚合、release attestation 等链路。

Folo 的 Web 构建也更完整。`vite.config.ts` 支持 PWA、legacy fallback、bundle analyzer、mkcert、debug proxy、route builder、HTML minify、多平台 import、i18n 插件和分 chunk。Livo 的 Web 配置更轻，偏“复用 renderer 入口”。

### Livo 当前状态

Livo 的单仓结构对当前规模很清晰，`config/` 集中构建配置，`src/shared` 放共享类型和工具逻辑，根脚本足够启动和构建桌面/Web。并且 Livo 的 `scripts/build/after-pack.mjs` 已经使用 Electron fuses，这点不弱。

短板在更完整的发布治理：已有基础质量门禁、Node/pnpm 约束、Dependabot、release plan、changelog 草稿和基础三平台打包配置，但还没有 runtime release channel 管理、CI artifact 聚合、签名/公证和 release attestation。

### 建议

- P1：补 workspace 级依赖治理策略，明确 overrides、patchedDependencies 和依赖升级规则。
- P1：建立 runtime release channel/version 元数据，以及版本 bump 流程。
- P2：暂不急着 monorepo 化，但可以先把主进程、渲染层、共享模块的构建接口整理清楚。

证据：

- Folo：`D:\project\Folo-dev\pnpm-workspace.yaml`、`turbo.json`、`.npmrc`、`.nvmrc`、`apps/desktop/forge.config.cts`、`apps/desktop/vite.config.ts`、`.github/workflows/build-desktop.yml`、`.github/workflows/lint.yml`
- Livo：`package.json`、`config/electron-builder.config.mjs`、`config/electron.vite.config.ts`、`config/vite.config.web.ts`、`scripts/build/after-pack.mjs`

## 2. Electron 主进程、窗口与系统集成

### Folo 做得更好的地方

Folo 的启动链路更分层。`before-bootstrap` 处理 dev/e2e `userData` 和 privileged `app://` scheme；`BootstrapManager` 处理单实例、协议、session 请求/响应头、cookie 迁移、热更新清理；`AppManager` 处理菜单、托盘、代理、更新器、推送、主题。Livo 的 `AppManager` 已经承载数据库、IPC、窗口、托盘、菜单、刷新、Fever、缓存维护、session policy，后续扩展会越来越拥挤。

Folo 的 deep link 是实际产品入口。它同时注册 legacy/new 协议，支持 dev 模式注册，收到 URL 后能分发到添加订阅、discover、feed、list、refresh、auth 等动作。

Folo 的窗口状态管理还有更多平台细节，例如 macOS vibrancy、traffic light 和退出全屏后刷新 bounds 的修复。Livo 已补窗口位置和大小持久化，并在恢复时 clamp 到当前屏幕工作区。

Folo 的外部导航处理覆盖更多路径。它处理 `window.open`、主窗口 `will-navigate`、webview `will-navigate`，http/https 进系统浏览器，自定义协议弹确认，内部协议拦截。Livo 有 `safeOpenExternal`、URL policy、`setWindowOpenHandler`、主窗口 `will-navigate` 和 webview 导航防线，但自定义协议确认与更细的内部协议分发仍可增强。

Folo 的桌面原生细节更多。菜单包含 Quick Add、Discover、Search、Always on top、日志、更新、Debug；托盘有未读数、帮助、日志、更新、reload/devtools；上下文菜单覆盖图片、视频、链接、保存、Inspect 和 Eagle 集成。Livo 的菜单/托盘可用，但更基础。

Folo 的 main -> renderer 反向桥接更强。`callWindowExpose` 让主进程能调用 renderer 注册的 `showSetting`、`quickAdd`、`goToFeed`、`dialog.ask`、`toast` 等能力，所以菜单、协议、通知、更新器都能落到业务动作。Livo 当前主要通过 `app:command` 单向事件发少量命令。

### 不能照搬的地方

Folo 主窗口 `webPreferences` 使用 `nodeIntegration: true`、`contextIsolation: false`、`sandbox: false`。这不适合 Livo。Livo 当前 `contextIsolation: true`、`nodeIntegration: false`，并且有显式 IPC 合同和参数校验，安全性更好。

### 建议

- P1：增强托盘、Window 菜单、Always on top、Dock badge、原生上下文菜单。
- P2：可以借鉴 Folo 的 typed proxy ergonomics，但继续保留 Livo 的 IPC validation 和 error envelope。

证据：

- Folo：`apps/desktop/layer/main/src/before-bootstrap.ts`、`manager/bootstrap.ts`、`manager/app.ts`、`manager/window.ts`、`lib/router.ts`、`menu.ts`、`lib/tray.ts`、`packages/internal/shared/src/bridge.ts`
- Livo：`src/main/index.ts`、`src/main/app-manager.ts`、`src/main/window-manager.ts`、`src/preload/index.ts`、`src/shared/ipc-contracts.ts`、`src/main/ipc/register-channel.ts`

## 3. IPC 与 preload 接口

### Folo 做得更好的地方

Folo 用 `electron-ipc-decorator` 把 IPC 聚合为 service class，再从服务定义推导渲染层代理类型。调用 ergonomics 更好，样板少，按业务模块聚合更自然。

Folo 的反向桥接把很多主进程动作转成渲染层命令，这是深模块的表现：菜单/托盘/协议调用者只知道一个小接口，不需要理解具体页面状态。

### Livo 做得更好的地方

Livo 的显式 `IPC_CONTRACTS`、`registerChannel`、`IpcEnvelope`、`validateIpcArgs` 更可审计，运行时校验更强。preload 只暴露受控 `window.api`，主窗口也保持 `contextIsolation: true` 和 `nodeIntegration: false`。

### 建议

保留 Livo 的安全接口，改进可维护性：

- 按 `feed`、`entry`、`ai`、`settings`、`app`、`agent` 分组生成 typed facade。
- 为 IPC 合同补类型级测试，防止 channel 和参数类型漂移。

证据：

- Folo：`apps/desktop/layer/main/src/ipc/index.ts`、`apps/desktop/layer/main/preload/index.ts`
- Livo：`src/shared/ipc-contracts.ts`、`src/main/ipc/register-channel.ts`、`src/preload/index.ts`

## 4. 渲染层架构、路由与布局

### Folo 做得更好的地方

Folo 的路由级布局更可扩展。React Router 嵌套路由和 `Outlet` 把主布局、时间线、子视图、AI 增强布局、全屏 subview 拆成层级模块。新增 discover、AI、power、action、rsshub 等页面时，不需要继续塞进一个主布局分支。

Livo 当前路由较扁平，很多 path 最终回到 `HomePage` 或 `Layout.tsx` 内部分支。这个实现适合当前规模，但 discover/settings/digest/media/AI 继续增长时，主布局接口会越来越浅，调用者和维护者都要理解太多内部细节。

Folo 的 entry column 拆分更健康。条目列表、网格、item template、hooks、滚动已读、刷新恢复、虚拟化等拆在 `modules/entry-column`。

Folo 的正文渲染接口更深。正文布局用 `ArticleLayout`、`MediaLayout`、`SocialMediaLayout` factory；HTML/Markdown 渲染、ShadowDOM、TOC、readability notice、附件区、转录切换等模块化。

Folo 的 provider 平台层更完整。根 provider 包含 query 持久化、focusable、hotkey、modal stack、toast、context menu、popover、external jump、setting sync、review prompt 等。Livo 有 query、overlay、settings、command、shortcuts、update、metrics，但 focus/modal/toast/command 的统一层弱一些。

### 建议

- P0：建立 route layout 分层，把 discover/settings/digest/media/reader 从 `Layout.tsx` 内部分支逐步迁出。
- P1：抽正文 renderer 接口，评估 ShadowDOM 或至少样式隔离。
- P1：把 command id、快捷键绑定、按钮呈现和执行统一到更深的命令模块。

证据：

- Folo：`apps/desktop/layer/renderer/src/router.tsx`、`pages/(main)/layout.tsx`、`modules/app-layout/MainDestopLayout.tsx`、`modules/app-layout/LAYOUT_ARCHITECTURE.md`、`modules/entry-column/*`、`modules/entry-content/components/layouts/factory.ts`
- Livo：`src/renderer/src/router/routes.tsx`、`src/renderer/src/components/layout/Layout.tsx`、`src/renderer/src/components/entry/EntryList.tsx`、`src/renderer/src/components/entry/EntryContent.tsx`

## 5. 设计系统、交互与可访问性

### Folo 做得更好的地方

Folo 的设计系统更完整。它有 UIKit 语义色、Material/Fill/Text/Control/Interface token、MingCute icon 规范、Framer Motion LazyMotion、spring presets、safe-area/window-padding、reduce motion 和多入口 Tailwind config。Livo 有 tokens 和基础 UI 模块，但业务组件内样式仍较分散。

Folo 的焦点和快捷键范围更系统。全局 focusable、hotkey scope、modal/dropdown/menu scope 能统一处理焦点恢复和快捷键屏蔽。Livo 已有 `tabIndex`、焦点高亮、快捷键 help、scope 思路，但 modal/dropdown 层级接管不如 Folo。

Folo 的错误边界更细。页面、feed not found、entry not found、modal、RSSHub error 等有不同 UI。Livo 有全局和局部 ErrorBoundary，但业务错误类型分层较粗。

Folo 的滚动和已读交互更细。scroll reset、refresh reset、scroll mark read grace period、end padding 等都有独立模块和测试。Livo 有阅读进度、列表滚动加载、条目导航，但自动已读、滚动恢复、刷新后位置策略还不够系统。

### 建议

- P1：把按钮、菜单、弹层、toast、空状态、设置项沉淀为基础 UI 模块。
- P1：建立语义 token，不只维护颜色变量，还覆盖 focus、motion、window safe area、平台差异。
- P2：补 focus scope 和 modal/dropdown 快捷键接管。
- P2：补滚动自动已读 grace period 和刷新后位置恢复。

证据：

- Folo：`apps/desktop/AGENTS.md`、`packages/configs/tailwindcss/web.ts`、`packages/internal/components/assets/colors.css`、`packages/internal/components/src/constants/spring.ts`
- Livo：`src/renderer/src/styles/tokens.css`、`src/renderer/src/styles/globals.css`、`config/tailwind.config.ts`

## 6. 数据模型、订阅关系与同步

### Folo 做得更好的地方

Folo 的领域模型更完整。它不只存 `feeds` 和 `entries`，还拆出 `subscriptions`、`lists`、`inboxes`、`unread`、`collections`、`summaries`、`translations`、`images`、`ai_chat`。这让“订阅关系”和“Feed 元数据”分离，天然支持列表订阅、收件箱、私有订阅、隐藏时间线、收藏集合、多语言摘要/翻译缓存。

Livo 当前把 `folder/category/view/showInAll/provider` 等订阅关系字段放在 `feeds` 表上。短期可用，但后续要做列表、共享订阅、远端账号同步、收件箱时，接口会变浅：调用者必须知道 Feed 元数据和用户订阅关系的耦合细节。

Folo 的 hydration 和 morph 层更成熟。`hydrateDatabaseToStore` 统一把多个领域模块从数据库灌入 store，API/store/DB 之间用 `apiMorph`、`storeDbMorph`、`dbStoreMorph` 转换。这比 Livo renderer store 直接调用 `window.api`、主进程 repository 返回 shared type 更适合长期演进。

Folo 的同步写入模式更成熟。订阅编辑、退订、已读、收藏等使用 transaction：先乐观更新 store，再请求远端，失败 rollback，成功持久化本地 DB。未读状态还有批量队列和本地保护窗口，减少滚动阅读时的请求风暴，避免远端旧数据覆盖本地刚标记的已读。

Folo 的离线启动接口更统一。desktop/web 共用 SQLite-on-IndexedDB 方案和迁移/导出/删除流程。Livo 桌面 SQLite 很扎实，但 Web 是单独 IndexedDB object store，桌面/Web 数据接口不一致。

### Livo 当前状态

Livo 的本地 RSS 抓取链路更强。它有条件 GET、ETag/Last-Modified、失败退避、并发池、刷新日志、Fever 同步、平台专项抓取、条目去重和修复。这部分不应为了模仿 Folo 推倒。

Livo 的 Entry repository 有不错的本地能力：identity key、URL 合并、broken scraper 修复、阅读列表去重、keyset cursor、compact content 裁剪。

### 建议

- P0：补独立 `subscriptions` 模型，把用户订阅关系从 `feeds` 中拆出来。
- P1：补独立 `unread` 或 materialized unread state，把批量已读做成 transaction + rollback + 队列。
- P1：升级搜索，短期可引入 Fuse，本地索引 feeds/entries/subscriptions；长期考虑 SQLite FTS5。
- P2：把 AI summaries/translations/images 等派生结果拆到独立缓存表。
- P2：从 feed/entry/subscription 开始引入 hydrate + morph 层。
- P3：Web 数据层向桌面 SQLite schema 靠拢，必要时再评估 wa-sqlite。

证据：

- Folo：`packages/internal/database/src/schemas/index.ts`、`packages/internal/database/src/db.desktop.ts`、`packages/internal/store/src/hydrate.ts`、`packages/internal/store/src/modules/subscription/store.ts`、`packages/internal/store/src/modules/unread/store.ts`
- Livo：`src/main/database/sqlite-schema.ts`、`src/main/database/repositories/entry-repository.ts`、`src/main/services/feed/feed-refresh.ts`、`src/main/services/entry/entry-ingestion-pipeline.ts`、`src/web/storage.ts`

## 7. 搜索与发现

### Folo 做得更好的地方

Folo 的搜索覆盖面更大。它有本地 DB + Fuse 模糊搜索，覆盖 entries、feeds、subscriptions，并带类型过滤；Electron 还有原生页面内搜索 `CmdF`。

Livo 有 Quick Search，已支持类型过滤；feed 搜索已有基础 ranking，entry 搜索仍是 SQL `LIKE` 但已做标题/摘要/正文命中排序。短板仍在模糊匹配、订阅维度、列表/收件箱维度，以及 Web 端 `getAll()` 后内存过滤。

Folo 的 RSSHub 运营能力更完整：实例管理、使用状态、排序、删除、状态查询、完整 route catalogue 和 analytics 查询。Livo 的 RSSHub discovery 和固定/自定义 instance 使用不错，但没有 Folo 的托管实例管理与状态页能力。

### 建议

- P1：引入本地 Fuse search index，覆盖 feed、entry、subscription，并替代当前轻量 ranking。
- P2：评估 SQLite FTS5，解决大数据量下 `LIKE` 退化。
- P2：RSSHub instance 管理增加健康检查、排序和使用状态。

证据：

- Folo：`apps/desktop/layer/renderer/src/store/search/index.ts`、`apps/desktop/layer/renderer/src/modules/panel/cmdf.tsx`、`apps/desktop/layer/renderer/src/queries/rsshub.ts`
- Livo：`src/renderer/src/store/quick-search-store.ts`、`src/main/database/repositories/entry-repository.ts`、`src/web/storage.ts`

## 8. AI、MCP、自动化与外部集成

### Folo 做得更好的地方

Folo 的 AI 聊天产品化程度更高。它基于 Vercel AI SDK 的 `AbstractChat` / `HttpChatTransport`，支持服务端 `/ai/chat`、断线续流、生成标题事件、本地消息持久化、远端会话同步、消息 metadata、token/provider 展示。Livo 的聊天和 Agent 能力强，但更偏本地面板和 trace，会话协议、断线续流、远端协同较轻。

Folo 的 AI 上下文系统更完整。它有结构化 context block：主视图、当前条目、当前 feed、未读状态、文件附件。快捷指令和任务复用 Lexical rich editor、Mention、Shortcut 插件。Livo 主要把选中条目的内容作为上下文，Agent 工具另有 registry，但聊天输入侧还没有富上下文编辑器。

Folo 的 AI Shortcut 是独立可复用模块。它支持服务端快捷指令和本地自定义快捷指令合并、默认 prompt、用户覆盖、启用/禁用、图标、目标范围、直接发送或预填。Livo 暂无同类抽象。

Folo 的 AI Task 是用户可配置产品能力，支持一次性/每日/每周/每月计划、通知渠道、测试运行和增删改查。Livo 有本地 Task Runner，但它主要承载摘要、翻译、Digest 和 Action effect，不是用户面向的 AI 自动任务。

Folo 的 MCP 是真正的外部工具生态入口。有 MCP 开关、连接列表、CRUD、工具刷新、Notion/Linear/GitHub/Fabric 预设、OAuth 弹窗、连接状态和 tool/resource/prompt 计数。Livo 的 Agent 工具架构清晰，但工具是静态内置，外部工具入口主要是 web search。

Folo 的 BYOK 更平台化。它支持 OpenAI、Google、Vercel AI Gateway、OpenRouter 多 provider 配置并存，消息 metadata 显示 provider、providerType、model、用量。Livo 已有多 provider 配置记忆和 OpenAI-compatible 配置，但运行时仍是单个当前 provider，Anthropic 原生协议会被拒绝，也缺少消息级 provider/用量 metadata。

Folo 的第三方集成覆盖更广。Readwise、Instapaper、Obsidian、Outline、Readeck、Cubox、Zotero、Eagle、qBittorrent、自定义 HTTP 请求和 URL Scheme 都已进入产品。Livo 当前主要是账户/OAuth、Fever、RSSHub、web search、视频代理，知识管理/稍后读/下载器集成明显少。

Folo 的 Action 自动化能力更丰富。它支持 summary、translation、readability、source content、notification、silence、block、star、rewrite rules、webhooks，并有 feed/entry 字段、媒体长度、附件时长等条件。Livo Actions 有 block/star/mark_read/notify/readability/summarize 和 AI semantic 条件，基础正确但集成出口少。

### Livo 当前状态

Livo 不是 AI 弱。它的本地 AI 管线在摘要/翻译 session、配置指纹、段落翻译并发、Digest rerank/reduce、Agent 工具 registry、权限确认和 trace 上很扎实。短板在产品化扩展层：MCP、AI shortcut、外部集成、自定义 webhook、结构化会话 metadata、多 provider 并存和用量展示。

### 建议

- P0：补 MCP 连接层，把 MCP server tools 作为动态 adapter 接入现有 `AgentToolRegistry`。
- P1：补 AI Shortcut，本地版先做快捷指令表、目标范围、默认/自定义 prompt、直接发送/预填。
- P1：补自定义集成：HTTP webhook + URL Scheme + 占位符模板。
- P2：升级聊天会话模型，持久化 message parts、context blocks、tool events、metadata。
- P2：基于现有 Task Runner 做用户可配置 AI Task。
- P3：多 BYOK provider 并存和用量展示。

证据：

- Folo：`apps/desktop/layer/renderer/src/modules/ai-chat/services/index.ts`、`modules/ai-chat/store/transport.ts`、`modules/ai-chat/store/types.ts`、`apps/desktop/layer/renderer/src/queries/mcp.ts`、`modules/settings/tabs/ai/mcp/*`、`modules/settings/tabs/ai/byok/*`、`modules/integration/custom-integration-manager.ts`、`packages/internal/store/src/modules/action/constant.ts`
- Livo：`src/main/services/ai/ai-client.ts`、`provider-protocol.ts`、`ai-pipeline.ts`、`ai-translation.ts`、`src/main/agent/service.ts`、`src/main/agent/default-tools.ts`、`src/shared/actions.ts`、`src/main/services/entry/entry-action-effects.ts`

## 9. 测试、质量门禁与可观测性

### Folo 做得更好的地方

Folo 的优势不在 desktop 单元测试数量。Livo 单应用内测试文件更多，尤其 feed、entry、database、AI、agent、shared 工具逻辑覆盖不少。Folo 更强的是自动化闭环。

Folo 有 GitHub Actions 质量门禁：PR 和 push 会安装依赖、构建 Web/SSR，再跑 format、typecheck、lint、test。Livo 已有 `.github/workflows/quality.yml`，在 PR 和 `main` push 跑 `format:check`、`typecheck`、`lint`、`test`；缺口转向 E2E、构建产物聚合和发布侧 CI。

Folo 有 Playwright E2E，分 web 和 Electron 两个 project，覆盖注册、登录、订阅 onboarding feed、退订、timeline 切换、打开文章、读/未读、双浏览器设置同步；失败保留 trace、截图和视频。

Folo 的 E2E 支撑层更成熟：临时账号、账号清理、recaptcha token 注入、local/prod profile、Electron 临时 `userDataDir`、Electron 启动前自动 build。Livo 本地优先，不需要真实远端账号，但同样需要 fixture RSS 和临时 userData。

Folo 的类型检查更硬。main/renderer 分层 tsconfig 开启 `noUncheckedIndexedAccess` 和 `noImplicitOverride`，renderer 测试脚本有 `vitest --typecheck` 和 `.test-d.ts` 类型级测试。Livo 目前有 `strict: true`，但未开这两个选项，也没有类型级测试。

Folo 的 lint 更像产品级门禁：i18n JSON key 校验、locale 排序、package 版本/重复包校验、禁止调试残留、TSSLint 检查 React 条件渲染泄漏等。Livo 的 ESLint 更基础。

Folo 的错误监控更完整。renderer 初始化 PostHog 和 GA4 tracker，捕获未处理错误和 Promise rejection，React ErrorBoundary 会传 component stack，业务异常也可 `captureException`。Livo 当前主要是本地日志和 renderer error 上报到主进程。

### 建议

- P1：拆分 Vitest 环境：Node 单测 + renderer `happy-dom` / `.tsx` 测试。
- P1：给 IPC contract、command registry、store interface 加 `.test-d.ts`。
- P1：分阶段开启 `noUncheckedIndexedAccess`、`noImplicitOverride`。
- P2：保留本地日志，增加可关闭、隐私默认友好的异常上报 adapter。
- P2：增强日志 rotation、scope、open log file 能力。

证据：

- Folo：`.github/workflows/lint.yml`、`.github/workflows/build-desktop.yml`、`apps/desktop/e2e/playwright.config.ts`、`apps/desktop/e2e/tests/*`、`eslint.config.mjs`、`tsslint.config.ts`、`packages/internal/tracker/*`
- Livo：`package.json`、`config/vitest.config.ts`、`config/eslint.config.mjs`、`config/tsconfig.base.json`、`src/main/services/system/logger.ts`、`src/renderer/src/components/ErrorBoundary.tsx`

## 10. 文档、社区与发行渠道

### Folo 做得更好的地方

Folo 有完整的开源协作入口：`CODE_OF_CONDUCT.md`、issue labeler、similar issues workflow、translator workflow 等自动化治理。Livo 已补 `CONTRIBUTING.md`、`SECURITY.md`、Issue templates、PR template 和 Dependabot，但社区流程自动化仍较轻。

Folo 的 README 是产品分发入口，包含 Web、iOS、Android、macOS、Windows、Linux、Mac App Store、Microsoft Store、GitHub release、社区 AUR/Nix/Homebrew/Scoop 等渠道。Livo README 更像开发说明，产品分发、用户安装和社区入口还比较少。

Folo 有长期 changelog，`apps/desktop/changelog` 从 0.1.x 到 1.9.0 都有版本记录，还有 `next.md` 和 template。Livo 已补 `docs/changelog/next.md` 和 `docs/release/release-plan.md`，但还没有历史版本目录和正式 release note 模板。

Folo 有 artifact attestation、签名策略说明、状态页和社区入口。这些对开源桌面应用的信任很重要。

### 建议

- P1：补 `CODE_OF_CONDUCT.md`、issue labeler、similar issues workflow。
- P1：建立历史版本 changelog 目录和正式 release note 模板。
- P2：README 分成“用户安装”和“开发者启动”两层。
- P2：发布后补签名、公证、artifact provenance 说明。

证据：

- Folo：`README.md`、`CONTRIBUTING.md`、`SECURITY.md`、`.github/ISSUE_TEMPLATE/*`、`.github/PULL_REQUEST_TEMPLATE.md`、`apps/desktop/changelog/*`
- Livo：`README.md`、`AGENTS.md`、`docs/*`

## 不适合直接照搬的点

1. Folo 的 Electron 主窗口安全配置不适合 Livo。Livo 应继续坚持 `contextIsolation: true`、`nodeIntegration: false` 和显式 IPC 合同。

2. Folo 的云端账号/远端 API/多端同步是产品前提，不应直接替代 Livo 的本地优先数据模型。Livo 应只借鉴订阅关系、事务、搜索、缓存这些接口形状。

3. Folo 的大量第三方依赖和 monorepo 分层会带来维护成本。Livo 当前不必一次性 monorepo 化，先提高关键模块深度更有效。

4. Folo 的远程异常监控需要隐私设计。Livo 若接入，必须默认可关闭，明确记录字段，避免破坏本地优先信任。

5. Folo 的 PWA、移动端、SSR、商店分发不是 Livo 近期全部必需。优先顺序应由桌面 RSS 核心路径和本地优先定位决定。

## 建议路线图

### P0：先补影响最大的基础闭环

1. 独立 `subscriptions` 模型，拆开 Feed 元数据和订阅关系。
2. MCP 动态工具接入层，复用现有 Agent 工具注册表。

### P1：增强产品平台能力

1. route layout 分层，把 discover/settings/digest/media/reader 从主布局分支迁出。
2. Fuse 搜索索引，覆盖 feeds、entries、subscriptions。
3. unread materialized state + 批量已读事务。
4. AI Shortcut。
5. 自定义 HTTP webhook / URL Scheme 集成。
6. renderer DOM 测试和类型级测试。

### P2：提高长期维护和发行成熟度

1. 正文 renderer 接口和样式隔离。
2. hydrate + morph 层。
3. AI message parts / context blocks / metadata 持久化。
4. 用户可配置 AI Task。
5. runtime release channel metadata、历史 changelog、签名/公证预留配置。
6. 可关闭的异常上报 adapter。
7. 设计系统语义 token、modal/toast/focus scope。

### P3：按产品路线选择的长期项

1. BYOK 多 provider 并存和用量展示。
2. Web 数据层向桌面 SQLite schema 靠拢。
3. SQLite FTS5。
4. 商店分发、artifact attestation、OTA/hot update。
5. RSSHub 实例状态和托管管理。

## 优先级最高的具体任务

1. 在 SQLite schema 中新增 `subscriptions`，先做最小读写接口。
2. 引入本地 Fuse 搜索 index，替代当前轻量 ranking 和 `LIKE` 搜索。
3. 把 MCP tools 作为动态 adapter 接入现有 `AgentToolRegistry`。

## 证据索引

Folo 关键证据：

- 工程：`D:\project\Folo-dev\pnpm-workspace.yaml`、`turbo.json`、`.github/workflows/*`
- 打包：`D:\project\Folo-dev\apps\desktop\forge.config.cts`
- 主进程：`D:\project\Folo-dev\apps\desktop\layer\main\src\manager\bootstrap.ts`、`manager\app.ts`、`manager\window.ts`
- IPC/桥接：`D:\project\Folo-dev\apps\desktop\layer\main\src\ipc\index.ts`、`D:\project\Folo-dev\packages\internal\shared\src\bridge.ts`
- 渲染层：`D:\project\Folo-dev\apps\desktop\layer\renderer\src\router.tsx`、`modules\app-layout\*`、`modules\entry-column\*`、`modules\entry-content\*`
- 数据：`D:\project\Folo-dev\packages\internal\database\src\schemas\index.ts`、`packages\internal\store\src\hydrate.ts`
- AI/MCP：`D:\project\Folo-dev\apps\desktop\layer\renderer\src\modules\ai-chat\*`、`queries\mcp.ts`、`modules\settings\tabs\ai\mcp\*`
- 测试：`D:\project\Folo-dev\apps\desktop\e2e\playwright.config.ts`、`e2e\tests\*`

Livo 关键证据：

- 工程：`package.json`、`config\electron-builder.config.mjs`、`config\electron.vite.config.ts`
- 主进程：`src\main\app-manager.ts`、`src\main\window-manager.ts`
- IPC/preload：`src\preload\index.ts`、`src\shared\ipc-contracts.ts`、`src\main\ipc\register-channel.ts`
- 渲染层：`src\renderer\src\router\routes.tsx`、`src\renderer\src\components\layout\Layout.tsx`、`EntryList.tsx`、`EntryContent.tsx`
- 数据：`src\main\database\sqlite-schema.ts`、`src\main\database\repositories\entry-repository.ts`、`src\main\services\feed\feed-refresh.ts`
- AI/Agent：`src\main\services\ai\*`、`src\main\agent\*`、`src\shared\actions.ts`
- 测试/质量：`config\vitest.config.ts`、`config\eslint.config.mjs`、`config\tsconfig.base.json`
