# Harmony → Desktop 功能差距分析

> 生成日期：2026-05-27  
> 对比范围：`apps/harmony` (HarmonyOS NEXT, ArkTS/ArkUI) vs `apps/desktop` (Electron/React/TypeScript)  
> 代码量对比（本次抽样口径）：`apps/harmony/entry/src/main/ets` 约 340 个 `.ets/.ts` 文件 / 56,896 行；`apps/desktop` 约 261 个源码文件 / 51,140 行

---

## 零、校验说明

本轮补充基于源码抽样和 GitNexus CLI 复核：

- GitNexus 当前仓库 `Livo` 索引已更新到提交 `4d46825`，`context`/`impact` 等符号级能力可用。
- `gitnexus query` 的 FTS 路径仍提示 `FTS indexes missing`；已通过 `npx gitnexus analyze --force --embeddings` 补齐本地 embeddings，当前可走 exact-scan fallback 返回定义结果。
- Codex 当前会话未暴露 GitNexus MCP resources/tools，实际使用时暂以 CLI 为准：`npx gitnexus context --repo Livo <symbol>`、`npx gitnexus impact --repo Livo <symbol>`。
- 以下差距不再只按 Harmony 文件是否存在判断，而是按 Desktop 现有能力、缺口和迁移成本拆分。

## 一、总体架构差异

### 1.1 导航结构

| 维度     | Harmony                                    | Desktop                                            |
| -------- | ------------------------------------------ | -------------------------------------------------- |
| 根导航   | 四 Tab 底部导航：首页 / 订阅 / 发现 / 设置 | 单页面三栏布局：Sidebar + EntryList + EntryContent |
| 页面路由 | 16 个独立页面（含子设置页）                | 单页应用，通过 Store 状态切换视图                  |
| 设置入口 | 独立 Tab 页 + 多个子页面                   | 弹窗式对话框（SettingsDialog）                     |

Desktop 端缺少 Harmony 中的以下独立页面：

- `pages/Subscriptions` — 订阅管理页面（带 Mode Rail）
- `pages/FeedDetail` — 订阅源详情页（预览卡片、订阅操作）
- `pages/Discover` / `pages/DiscoverPreview` / `pages/DiscoverSubscribeConfig` — 三步发现流程
- `pages/ArticleDetail` — 完整文章详情页（含 AI 辅助面板、内嵌视频等）
- `pages/VideoPlayer` — 全屏视频播放器（原生+WebView 回退）
- `pages/ImageViewer` — 图片查看器
- `pages/AccountLogin` — 账号登录页

### 1.2 核心数据流

```
Harmony:  Page → Coordinator → Repository → RDB (关系数据库)
Desktop:  Component → Store (Zustand) → IPC Handler → SQLite (better-sqlite3)
```

Harmony 端有完整的 **Coordinator 层**（约 40 个文件），负责复杂的数据协调逻辑（分页、刷新、预取、模式切换等），Desktop 端这些逻辑全部压缩在 Store 和 Component 中。

### 1.3 功能完成度量化评估

| 能力域      | 完成度 | 说明                                                                                                                     |
| ----------- | ------ | ------------------------------------------------------------------------------------------------------------------------ |
| AI 基础能力 | 55%    | 有 summarize/translate/chat/stream IPC，EntryContent 内已有摘要/翻译/Chat 入口；缺 Agent 循环、工具调用、权限控制、Trace |
| 媒体播放    | 60%    | 有 CornerPlayer、inline VideoPlayer、YouTube Invidious/Piped 解析、WebView/iframe 回退；缺页面级播放器和统一媒体服务抽象 |
| 订阅管理    | 60%    | Sidebar 内完成大部分操作，但无独立订阅页、无 FeedDetail 页、无 Mode Rail                                                 |
| 发现流程    | 55%    | 有 DiscoverPanel、多平台搜索、订阅列选择；缺预览步骤、页面化配置流程、内置目录浏览体验                                   |
| 设置系统    | 60%    | 有 General/Reading/Data/Accounts/About/AI/Translation/Actions，但缺独立 Appearance/Privacy/RefreshLog/AgentPermissions   |
| 主题外观    | 70%    | 有深浅色、强调色、CSS Token、自定义 CSS；缺 Harmony 等价 ThemePalette 覆盖和独立外观页                                   |
| 数据层      | 55%    | 有 SQLite + IPC + main services，但无 ViewModel 层、无 Coordinator 层，Repository 抽象不完整                             |
| 账号系统    | 70%    | 有 account-auth.ts、account-session.ts、bilibili-followings.ts、YouTube 登录；缺独立登录页和流程化状态页                 |

### 1.4 Desktop 已有能力复核

| 能力              | 当前状态                                                                      | 后续任务应如何表述                                             |
| ----------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------- |
| 文章 AI 摘要/翻译 | `EntryContent.tsx` 已调用 summarize/translate IPC 并展示结果                  | 改为抽取 `ArticleAIAssistViewModel`、补 FeatureCard 和重试策略 |
| AI Chat 流式输出  | `ai-handlers.ts` 与 `ai-chat-store.ts` 已有 stream IPC                        | 改为接入 Agent loop、工具调用、Trace、确认机制                 |
| YouTube 视频解析  | `video-proxy.ts` 已有 Invidious/Piped 回退，renderer 有 `youtube-playback.ts` | 改为统一 main/renderer 解析逻辑、补测试、做页面化播放器        |
| 音频播放          | `CornerPlayer` + `usePlayerStore` 已支持播放/暂停/进度/倍速/下载              | 改为抽象 AudioPlaybackService、补全局 AudioMiniBar 体验        |
| 强调色            | `appearance.ts` 已支持 8 色和自定义 hex，并写入 CSS variables                 | 改为补 ThemePalette token 覆盖、拆 AppearanceSettings          |
| 收藏视图          | Sidebar 已有 `starred` 入口，EntryStore 支持 starred filter                   | 改为增强 FavoritesPanel 的排序、筛选、批量操作                 |
| OPML              | `feed-handlers.ts` 已支持导入/导出、进度和并发导入                            | 改为补导入后刷新日志、失败明细、批次可观测性                   |
| 多平台发现        | `discover-handlers.ts` 已有 YouTube/X/Instagram/Bilibili 搜索                 | 改为补预览页、配置页和内置目录浏览                             |
| React Router      | 依赖已存在，但 renderer 未挂载路由树                                          | 改为启用/接入路由，不需要新增依赖                              |
| Markdown 渲染     | `react-markdown` 依赖已存在，但 AIChatPanel 未接入                            | 改为接入现有依赖并加安全渲染策略                               |

### 1.5 Desktop 端技术债风险

以下巨型文件是当前架构的主要风险点，迁移过程中需要重点拆分：

| 文件                   | 行数 | 风险说明                                                        |
| ---------------------- | ---- | --------------------------------------------------------------- |
| `EntryList.tsx`        | 3279 | 内联了首页分页、模式切换、社交渲染、视频播放、AI 摘要等全部逻辑 |
| `entry-store.ts`       | 620  | 集中了所有 Entry 状态管理，缺少按功能域拆分                     |
| `GeneralSettings.tsx`  | ~800 | 合并了外观、阅读、通用设置，职责过重                            |
| `AccountsSettings.tsx` | 1044 | 账号设置逻辑过于集中，可拆分登录/同步/导出子模块                |
| `Layout.tsx`           | 220+ | 当前三栏布局耦合了 Discover/Entry/Feed 多重视图切换逻辑         |

---

## 二、AI 能力差距（关键）

### 2.1 Livo Agent 系统

**Harmony 端已实现完整的 Agent 系统**（约 15 个文件），Desktop 端**完全没有**。

#### Harmony Agent 架构：

```
LivoAgentService → LivoAgentLoop → ChatCompletionRunner + ToolRegistry
                                      ↓
                            (8 类工具, 30+ 个工具)
```

#### Agent 工具分类：

| 工具类别             | 文件                | 工具数量 | 说明                                   |
| -------------------- | ------------------- | -------- | -------------------------------------- |
| NavigationAgentTools | `tools/navigation/` | 8 个     | 打开/切换页面、导航到设置等            |
| FeedAgentTools       | `tools/feed/`       | 6+ 个    | 列出订阅、添加订阅、刷新、删除、搜索   |
| EntryAgentTools      | `tools/entry/`      | 6+ 个    | 今日更新、未读列表、收藏列表、文章详情 |
| SettingsAgentTools   | `tools/settings/`   | 5+ 个    | 改主题、改语言、改AI配置、查看设置     |
| DiscoverAgentTools   | `tools/discover/`   | 3 个     | 浏览内置源、添加内置订阅               |
| AccountAgentTools    | `tools/account/`    | 3 个     | 账号状态、登录、登出                   |
| DataAgentTools       | `tools/data/`       | 2+ 个    | 导出OPML、清理数据                     |
| ExternalAgentTools   | `tools/external/`   | 1 个     | 网络搜索                               |

#### Agent 核心能力：

- **多轮工具调用**（MAX_AGENT_ROUNDS = 5）
- **权限控制**（read/navigate/mutate/destructive/external 五级）
- **确认机制**（写入/删除/外链类操作需用户确认）
- **工具追踪**（ToolTraceRecorder 记录每轮工具调用详情）
- **Typewriter 流式输出**
- **会话历史持久化**（ChatHistoryStore）
- **Prompt Injection 防护**

#### Desktop 端 AI 现状：

- `ai-handlers.ts` 已提供 **summarize / translate / chat / chatStream** IPC
- `EntryContent.tsx` 已有 AI 摘要、AI 翻译、AI Chat 操作入口和结果展示
- `AIChatPanel` 已有基础对话 UI，但仍不能操作应用
- 主要缺口是 Agent 循环、工具调用、权限控制、确认机制、Trace 面板和持久化会话

### 2.2 Article AI Assist

Harmony 端有专门的 **文章 AI 辅助子系统**：

- `ArticleAssistService` — 总结、翻译、本地化
- `ArticleAIAssistViewModel` — 文章详情页内的 AI 操作状态管理
- 多 Provider 支持：MiniMax、DeepSeek、OpenAI、Anthropic、GLM、Custom
- 三重重试策略（TranslationPipeline）
- 专门的 Provider Protocol 抽象层

Desktop 端已有基础文章摘要/翻译 UI，但这些逻辑内联在 `EntryContent.tsx` 中；缺少 Harmony 的 `ArticleAIAssistViewModel`、独立 FeatureCard、Provider Protocol 抽象和 TranslationPipeline 等可测试结构。

---

## 三、媒体能力差距

### 3.1 视频播放

| 能力             | Harmony                        | Desktop                                                                |
| ---------------- | ------------------------------ | ---------------------------------------------------------------------- |
| 全屏视频页面     | ✅ VideoPlayer 页              | ❌ 无（仅有 CornerPlayer 画中画）                                      |
| YouTube 视频解析 | ✅ Invidious/Piped 多实例回退  | ✅ `video-proxy.ts` 已有 Invidious/Piped 回退                          |
| WebView 回退     | ✅ 视频无法直链时用 WebView    | 部分：Bilibili/YouTube 已有 iframe/webview 回退，缺页面级统一入口      |
| 横竖屏切换       | ✅ 自动旋转                    | N/A (桌面端)                                                           |
| 视频保存到本地   | ✅ MediaSaveService            | ❌                                                                     |
| 内嵌视频播放     | ✅ ArticleDetail 内 Video 组件 | 部分：EntryContent/宽视图已有 VideoPlayer，缺 ArticleDetail 页面级整合 |

### 3.2 音频播放

| 能力           | Harmony                         | Desktop                                                   |
| -------------- | ------------------------------- | --------------------------------------------------------- |
| 音频播放服务   | ✅ AudioPlaybackService (553行) | 部分：`CornerPlayer` + `usePlayerStore` 内联实现          |
| AVSession 集成 | ✅ 锁屏/控制中心                | N/A                                                       |
| 后台播放       | ✅ BackgroundTaskService        | N/A                                                       |
| 倍速播放       | ✅ 0.75x ~ 2.0x                 | ✅ 0.5x ~ 2.0x                                            |
| AudioMiniBar   | ✅ 全局悬浮迷你播放条           | 部分：CornerPlayer 具备迷你条形态，缺服务化和全局状态细化 |

### 3.3 图片/媒体

| 能力                  | Harmony                   | Desktop                        |
| --------------------- | ------------------------- | ------------------------------ |
| 图片查看器            | ✅ ImageViewer 页面       | ❌（仅有 OverlayMediaGallery） |
| Live Photo / 动态照片 | ✅ MovingPhotoService     | ❌                             |
| 图片保存              | ✅ MediaSaveService       | ❌                             |
| 图片画廊              | ✅ EntryImageGallery 组件 | 部分（OverlayMediaGallery）    |

---

## 四、订阅管理差距

### 4.1 发现流程

Harmony 端有三步递进式发现流程：

```
Discover 搜索 → DiscoverPreview（预览源内容） → DiscoverSubscribeConfig（选择视图/分类/确认订阅）
```

Desktop 端仅有：

- `DiscoverPanel` — 搜索+结果显示在一个面板内
- 已有多平台搜索和订阅列/视图选择的局部能力
- 无独立预览步骤，无页面化的订阅配置步骤，无内置目录的完整浏览体验

### 4.2 订阅源详情

| 能力             | Harmony                         | Desktop |
| ---------------- | ------------------------------- | ------- |
| FeedDetail 页面  | ✅ 独立页面                     | ❌      |
| 订阅源预览卡片   | ✅ FeedDetailPreviewCards       | ❌      |
| Hero Avatar      | ✅ FeedDetailHeroAvatar (369行) | ❌      |
| 编辑订阅源       | ✅ 跳转 DiscoverSubscribeConfig | ❌      |
| 订阅源内文章列表 | ✅                              | ❌      |

### 4.3 OPML 导入导出

| 能力       | Harmony                    | Desktop                                                |
| ---------- | -------------------------- | ------------------------------------------------------ |
| OPML 导出  | ✅ SubscriptionOpmlService | ✅ `feed-handlers.ts` + `opml-parser.ts`               |
| OPML 导入  | ✅ 含自动刷新批处理        | ✅ ImportProgressModal + 进度事件 + 并发导入           |
| 大文件优化 | ✅ 分批刷新 + 限流         | 部分：已有并发导入，缺刷新日志、失败明细和批次可观测性 |

### 4.4 子订阅页面

Harmony 端有独立的 `Subscriptions` 页面：

- `SubscriptionsModeRail` — Articles/Social/Videos/Pictures 模式切换
- `SubscriptionsContent` — 按分类分组的订阅列表
- `SubscriptionsAvatarHydrationCoordinator` — 头像预加载

Desktop 端所有订阅管理在 Sidebar 中完成，无独立页面。

---

## 五、首页功能差距

### 5.1 内容模式

| 能力           | Harmony                                 | Desktop                      |
| -------------- | --------------------------------------- | ---------------------------- |
| Mode Rail 切换 | ✅ ContentModeRail (269行)              | ❌                           |
| 四种视图模式   | ✅ Articles/Social/Videos/Pictures      | 部分（Sidebar 按 View 分组） |
| 首页视频网格   | ✅ HomeVideoGrid (384行)                | 部分（VideoGridSection）     |
| 首页图片瀑布流 | ✅ PictureEntryCard (378行)             | 部分（PictureMasonry）       |
| 社交卡片       | ✅ TweetEntryCard + QuotedTweetRenderer | 部分（SocialSummaryCard）    |

### 5.2 数据管理

Harmony 端有完善的 Coordinator 层：

| 组件                       | 行数 | 功能                           |
| -------------------------- | ---- | ------------------------------ |
| HomeFeedPagination         | 930  | 分页加载、候选池、可见窗口计算 |
| HomeFeedSession            | 598  | 会话管理、数据源               |
| HomeEntryDataManager       | 366  | 数据获取与缓存协调             |
| HomeFeedRefresh            | 411  | 下拉刷新逻辑                   |
| HomeFeedGuard              | 146  | Feed 完整性保护                |
| HomeLoadMoreDrain          | 138  | 加载更多防抖/节流              |
| HomeLoadMorePrefetch       | -    | 预取优化                       |
| HomeModeController         | 141  | 模式切换协调                   |
| HomeInlineSearchController | 135  | 首页内搜索                     |

Desktop 端这些逻辑全部在 `EntryList.tsx`（3279行）和 `entry-store.ts`（620行）中内联实现，缺少分层。

---

## 六、设置系统差距

### 6.1 设置页面

| Harmony 独立设置页                    | Desktop Settings Tab            |
| ------------------------------------- | ------------------------------- |
| ✅ Settings (主页)                    | SettingsDialog (弹窗)           |
| ✅ GeneralSettings                    | GeneralSettings tab             |
| ✅ AppearanceSettings                 | ❌（合并在 GeneralSettings 中） |
| ✅ DataControlSettings                | DataSettings tab                |
| ✅ PrivacySettings                    | ❌                              |
| ✅ AboutSettings                      | AboutSettings tab               |
| ✅ AccountsSettingsPanel (456行)      | AccountsSettings tab (1044行)   |
| ✅ AIAssistantSettingsPanel (423行)   | AISettings tab (234行)          |
| ✅ RefreshLogSettingsPanel (214行)    | ❌                              |
| ✅ SubscriptionsSettingsPanel (213行) | ❌（合并在 FeedsSettings 中）   |
| ✅ TranslationFeatureCard (173行)     | TranslationSettings tab         |
| ✅ SummaryFeatureCard (173行)         | ❌                              |

### 6.2 刷新日志

Harmony 端有 `RefreshLogSettingsPanel` 和 `RefreshLogStore`，可以查看每个订阅源的历史刷新状态。Desktop 端无此功能。

---

## 七、主题与外观

| 能力                  | Harmony                              | Desktop                                  |
| --------------------- | ------------------------------------ | ---------------------------------------- |
| 完整主题系统          | ✅ ThemeService + ThemePalette       | 部分（AppearanceProvider）               |
| 深色/浅色模式         | ✅ 含系统跟随                        | ✅                                       |
| 强调色                | ✅ 5种（orange/blue/red/pink/green） | ✅ 8 色 + 自定义 hex，基于 CSS variables |
| 自定义暗色/亮色调色板 | ✅ 精确到每个 UI Token               | 部分：CSS 变量为主，Token 覆盖不足       |
| 页面转场动画          | ✅ PageTransitionEnter/Exit          | ❌                                       |

---

## 八、数据层差距

### 8.1 数据模型

| 维度            | Harmony                                                                 | Desktop                             |
| --------------- | ----------------------------------------------------------------------- | ----------------------------------- |
| Domain Models   | `DomainModels.ets` — Entry, Feed, FeedWithCount, FeedViewType           | 共享 `packages/models/src/types.ts` |
| View Models     | `ViewModels.ets` — EntryCardModel, FeedCardModel, ArticleDetailModel 等 | ❌ 无 ViewModel 层                  |
| Settings Models | `SettingsModels.ets` — HarmonySettings 完整模型                         | 共享类型                            |
| Article Content | `ArticleContentBuilder.ets` — 内容块模型                                | ❌ 直接渲染 HTML                    |

### 8.2 Repository 层

Harmony 端有独立的 Repository 层：

- `FeedRepository.ets` — 订阅源 CRUD + 搜索
- `EntryRepository.ets` — 文章 CRUD + 分页 + 统计
- `RdbTable.ets` — RDB 表抽象

Desktop 端数据访问通过 IPC 处理器直接操作 SQLite，无 Repository 抽象。

### 8.3 数据协调

Harmony 端的 Coordinator 层在 Desktop 端无对应：

- `FeedDetailDataCoordinator` (420行)
- `FeedSubscribeAction` (158行)
- `HomeEntryDataManager` (366行)
- `DiscoverInteractionCoordinator`
- `ArticleEntryLoader` (239行)

---

## 九、账号系统

| 能力              | Harmony                              | Desktop                     |
| ----------------- | ------------------------------------ | --------------------------- |
| 账号登录页        | ✅ AccountLogin 页面 (268行)         | ❌（仅为 Sidebar 中的按钮） |
| 登录 Handler 工厂 | ✅ AccountLoginHandlerFactory        | 部分                        |
| 账号状态管理      | ✅ AccountSessionService (395行)     | ✅ account-auth.ts          |
| Bilibili 关注导入 | ✅ BilibiliFollowingsService (217行) | ✅ bilibili-followings.ts   |

---

## 十、其他差距

### 10.1 网络搜索

- Harmony：`WebSearchService` — DuckDuckGo HTML 搜索（无需 API Key）
- Desktop：❌ 无内置搜索

### 10.2 外部链接处理

- Harmony：`ExternalUrlService` — 统一外链处理
- Desktop：部分（EntryContent 中有 isExternalUrl 检测）

### 10.3 收藏管理

- Harmony：`FavoritesPanel` (252行) — 收藏文章列表
- Desktop：已有 Sidebar `starred` 收藏视图和 Star 操作，但无独立 FavoritesPanel、排序/筛选/批量操作

### 10.4 Markdown 解析

- Harmony：`MarkdownParser.ets` — AI 回复的 Markdown 渲染
- Desktop：已有 `react-markdown` 依赖，但 `AIChatPanel` 尚未接入，需补安全渲染策略

### 10.5 性能监控

- Harmony：`HomePerfLogger` + `HomeScrollIntentTracker`
- Desktop：`PerformanceMetricsProvider` — 基本的渲染性能监控

### 10.6 滚动体验

- Harmony：自定义 `HomeScrollIntentTracker`、`HomeChromeProgressStore`
- Desktop：`useEntryScrollNavigation` — 基本滚动导航

### 10.7 后台任务

- Harmony：`BackgroundTaskService` — 音频播放/数据传输后台保活
- Desktop：N/A（桌面端无此需求）

### 10.8 代理支持

- Harmony：`proxy.ts` 配置
- Desktop：`proxy.ts` (102行)

### 10.9 国际化

- Harmony：系统语言跟随
- Desktop：`i18n.ts` + `zh-CN`/`en` 翻译文件

---

## 十一、Desktop 端的优势

以下能力是 Desktop 端独有的：

| 能力              | 说明                                       |
| ----------------- | ------------------------------------------ |
| 全局快捷键        | GlobalShortcutsProvider + HotkeyScope 系统 |
| 命令面板          | CommandPalette（Ctrl+K，337行）            |
| 快速搜索          | QuickSearch 面板                           |
| 画中画播放器      | CornerPlayer / MediaPlayer                 |
| 分享海报生成      | SharePoster（249行）                       |
| 可拖拽面板宽度    | LocalStorage 持久化                        |
| 右键上下文菜单    | ContextMenu（420行）                       |
| Electron 原生能力 | 托盘、菜单、窗口管理、自动更新             |
| Keyboard 导航     | LayoutFocusTarget + FocusableHotkeyScope   |
| Overlay Stack     | 弹窗栈管理                                 |

---

## 十二、迁移优先级建议

### P0 — 核心功能缺口（影响基本体验）预估工时：8-12 天

1. **完整文章详情页** — Desktop 端目前仅有 EntryContent 组件直接渲染 HTML，缺少 Harmony 的：
   - AI 摘要/翻译面板
   - 社交内容详情（SocialDetail）
   - 图片画廊模式（PictureDetail）
   - 内嵌视频播放
   - 原文/美化视图切换

2. **发现流程完善** — 当前 DiscoverPanel 缺少预览和分类配置步骤

3. **设置系统完善** — 缺少 Appearance、Privacy、RefreshLog、Agent Permissions 等设置

### P1 — AI 能力对齐（差异化竞争力）预估工时：10-15 天

4. **Livo Agent 系统移植** — 将 Agent 循环 + Tool 系统从 ArkTS 移植到 TypeScript/Node.js
5. **AI 辅助阅读** — 文章总结、翻译的 UI 面板
6. **Agent 聊天增强** — 多轮工具调用、确认机制、Trace 面板

### P2 — 媒体能力增强 预估工时：3-5 天

7. **视频播放页** — 复用现有 `video-proxy.ts` / `youtube-playback.ts`，补独立页面和统一打开入口
8. **音频播放产品化** — 将现有 CornerPlayer 抽象为 AudioPlaybackService + AudioMiniBar
9. **视频解析测试与复用** — 合并 main/renderer YouTube 解析逻辑，补 Invidious/Piped 回归测试

### P3 — 体验优化 预估工时：4-7 天

10. **内容模式 Rail** — 首页/订阅页的模式快速切换
11. **页面转场动画** — 视图切换时的过渡动画
12. **主题系统完善** — 在已有强调色基础上补 ThemePalette token 覆盖和 AppearanceSettings
13. **收藏管理增强** — 在已有 starred 视图基础上补 FavoritesPanel、排序、筛选、批量操作
14. **刷新日志** — 订阅源刷新历史记录
15. **内置订阅源目录** — 分类浏览内置推荐源

### P0.5 — 技术基建（前置条件）预估工时：3-5 天

在 P0 任务开始前，需要先完成以下技术基建：

- 路由方案启用（优先复用已安装的 React Router 7，不新增依赖）
- 页面级组件目录结构（`pages/` 与 `components/` 分离）
- ViewModel 接口层定义
- Coordinator 层原型（从 `EntryList.tsx` 拆分 `HomeFeedCoordinator`）

---

## 十三、不做什么清单（明确排除项）

以下 Harmony 端能力**明确不需要**移植到 Desktop 端，避免过度工程：

| 模块                                          | 排除原因                                                    |
| --------------------------------------------- | ----------------------------------------------------------- |
| `BackgroundTaskService`                       | 桌面端无后台保活需求，Electron 主进程天然常驻               |
| `AVSession 集成`                              | HarmonyOS 锁屏/控制中心 API，桌面端无对应场景               |
| `横竖屏自动旋转`                              | 桌面端无屏幕旋转需求                                        |
| `MovingPhotoService` (动态照片)               | 移动端特有交互，桌面端图片查看器已足够                      |
| `PageTransitionEnter/Exit` (ArkUI 页面栈动画) | Desktop 使用 SPA 视图切换，动画方案完全不同                 |
| `RdbTable` 抽象层                             | Desktop 使用 better-sqlite3，已有直接操作模式，无需额外抽象 |
| `SubscriptionsAvatarHydrationCoordinator`     | 头像预加载可用简单 `Promise.all` 替代，无需独立 Coordinator |

---

## 十四、代码复用建议

### 可跨端复用的逻辑

以下 Harmony 端逻辑可以直接或轻量适配后在 Desktop 端使用：

| 模块           | 当前实现              | 复用方式                      |
| -------------- | --------------------- | ----------------------------- |
| Agent 工具定义 | ArkTS                 | 转为 TypeScript，保持接口一致 |
| 数据模型转换   | LivoModels.ets        | 移到 `packages/models`        |
| RSS 解析       | RssFeedParser/Fetcher | Desktop 已有 rss-parser.ts    |
| 视频 URL 解析  | VideoResolverService  | 转为 Node.js 兼容实现         |
| OPML 处理      | OpmlParser            | 已有 opml-parser.ts           |
| 头像解析       | HttpAvatarResolver    | 已有 feed-avatar.ts           |
| 网络搜索       | WebSearchService      | 可直接在 Node.js 复用思路     |

### 需要重新实现的部分

以下受限于平台差异，需要针对 Desktop 重新设计：

| 模块     | 原因                                |
| -------- | ----------------------------------- |
| 导航路由 | Harmony 用页面栈，Desktop 单页应用  |
| UI 组件  | ArkUI → React 完全不同              |
| 主题系统 | ArkUI 资源系统 vs CSS 变量          |
| 数据库   | RDB → better-sqlite3                |
| 后台任务 | HarmonyOS API → Electron 无对应需求 |

---

## 十五、GitNexus 使用记录

本次复核时遇到两个 GitNexus 使用问题：

1. Codex 当前会话没有暴露 GitNexus MCP resources/tools，`list_mcp_resources` 返回空。当前可行替代方案是使用 CLI：`npx gitnexus status`、`npx gitnexus context --repo Livo <symbol>`、`npx gitnexus impact --repo Livo <symbol>`。
2. `npx gitnexus query --repo Livo ...` 提示 `FTS indexes missing`，单纯 `npx gitnexus analyze --force` 未消除该提示。已执行 `npx gitnexus analyze --force --embeddings`，生成 8,473 个 embeddings 后，`query` 可通过 exact-scan fallback 返回定义结果，但仍会保留 FTS warning。

后续执行代码修改时仍按 AGENTS 约束：修改符号前优先用 `gitnexus impact --repo Livo <symbol>` 做影响分析；若需要进程级探索而 `query` warning 影响结果，则退回 `context` + `rg` 双轨校验。

---

## 附录：文件清单对比

### Harmony 独有模块（Desktop 需实现）

```
apps/harmony/entry/src/main/ets/
├── common/agent/                          # Agent 系统 (12 文件)
│   ├── LivoAgentLoop.ets                  # Agent 循环核心
│   ├── LivoAgentService.ets               # Agent 服务层
│   ├── DefaultAgentTools.ets              # 默认工具注册
│   ├── AgentTypes.ts                      # Agent 类型定义
│   ├── AgentContextBuilder.ets            # 上下文构建
│   ├── AgentToolExecutor.ets              # 工具执行器
│   ├── AgentTraceStore.ets                # 工具追踪存储
│   ├── PolicyGuard.ets                     # 安全策略
│   ├── ToolRegistry.ets                   # 工具注册表
│   └── tools/                             # 8 类工具
│       ├── navigation/NavigationAgentTools.ets
│       ├── feed/FeedAgentTools.ets
│       ├── entry/EntryAgentTools.ets
│       ├── settings/SettingsAgentTools.ets
│       ├── discover/DiscoverAgentTools.ets
│       ├── account/AccountAgentTools.ets
│       ├── data/DataAgentTools.ets
│       └── external/ExternalAgentTools.ets
├── pages/                                 # 独立页面
│   ├── Subscriptions.ets                  # 订阅页
│   ├── FeedDetail.ets                     # 订阅源详情
│   ├── Discover.ets                       # 发现页
│   ├── DiscoverPreview.ets                # 发现预览
│   ├── DiscoverSubscribeConfig.ets        # 订阅配置
│   ├── ArticleDetail.ets                  # 文章详情 (610行)
│   ├── VideoPlayer.ets                    # 视频播放 (283行)
│   ├── ImageViewer.ets                    # 图片查看
│   ├── AccountLogin.ets                   # 账号登录 (268行)
│   ├── Settings.ets                       # 设置主页
│   ├── GeneralSettings.ets               # 通用设置
│   ├── AppearanceSettings.ets            # 外观设置
│   ├── DataControlSettings.ets           # 数据管理
│   ├── PrivacySettings.ets               # 隐私设置
│   └── AboutSettings.ets                 # 关于
├── common/coordinators/                   # 协调器层 (~40 文件)
│   ├── home/                              # 首页相关
│   ├── article/                           # 文章相关
│   ├── discover/                          # 发现相关
│   ├── feed-detail/                       # 订阅详情相关
│   ├── feed-subscribe/                    # 订阅操作相关
│   ├── index-home/                        # 首页框架相关
│   └── subscriptions/                     # 订阅列表相关
├── common/services/                       # 服务层 (40+ 文件)
│   ├── AudioPlaybackService.ets           # 音频播放
│   ├── BackgroundTaskService.ets          # 后台任务
│   ├── MovingPhotoService.ets             # 动态照片
│   ├── MediaSaveService.ets               # 媒体保存
│   ├── WebSearchService.ets               # 网络搜索
│   ├── VideoResolverService.ets           # 视频解析
│   ├── SubscriptionOpmlService.ets        # OPML管理
│   ├── ThemeService.ets                   # 主题服务
│   ├── RefreshLogStore.ets                # 刷新日志
│   └── ... 更多
└── common/components/                     # UI 组件 (80+ 文件)
    ├── HomeModeEntriesPage.ets            # 模式入口页
    ├── ContentModeRail.ets                # 模式切换栏
    ├── HomeVideoGrid.ets                  # 视频网格
    ├── TweetEntryCard.ets                 # 社交卡片
    ├── PictureEntryCard.ets               # 图片卡片
    ├── AudioMiniBar.ets                   # 音频迷你栏
    ├── AIChatPanel.ets                    # AI聊天面板
    ├── EntryImageGallery.ets              # 图片画廊
    ├── FeedDetailView.ets                 # 订阅详情视图
    ├── FavoritesPanel.ets                 # 收藏面板
    ├── BottomTabs.ets                     # 底部导航
    └── ... 更多
```
